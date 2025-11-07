from celery import Task
from celery_app import celery_app
from typing import Set, List, Dict
import asyncio
from urllib.parse import urljoin, urlparse
import structlog
from playwright.async_api import async_playwright
from collections import deque
import uuid
import json
from pathlib import Path
from bs4 import BeautifulSoup
import re

from tasks.embeddings import process_url_for_embedding
from tasks.embeddings import process_url_for_embedding_incremental, process_url_for_embedding_smart

logger = structlog.get_logger()

# Domain-level locks for concurrent crawl prevention
domain_locks = {}
domain_locks_lock = asyncio.Lock()

# File download URL patterns to skip
FILE_DOWNLOAD_PATTERNS = [
    r'download',
    r'filedown',
    r'etcresourcedown',
    r'attach',
    r'attachment',
    r'file\.do',
    r'board.*download',
]

# User-Agent pool for rotation to avoid bot detection
USER_AGENTS = [
    # Chrome on Windows
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36",

    # Chrome on macOS
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36",

    # Firefox on Windows
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:121.0) Gecko/20100101 Firefox/121.0",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:120.0) Gecko/20100101 Firefox/120.0",

    # Firefox on macOS
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:121.0) Gecko/20100101 Firefox/121.0",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:120.0) Gecko/20100101 Firefox/120.0",

    # Safari on macOS
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.1 Safari/605.1.15",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15",

    # Edge on Windows
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 Edg/120.0.0.0",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36 Edg/119.0.0.0",
]

def is_file_download_url(url: str) -> bool:
    """Check if URL is a file download endpoint"""
    url_lower = url.lower()
    return any(re.search(pattern, url_lower) for pattern in FILE_DOWNLOAD_PATTERNS)

def get_random_user_agent() -> str:
    """Get a random User-Agent from the pool"""
    import random
    return random.choice(USER_AGENTS)


class CrawlerTask(Task):
    """Base crawler task with retry configuration"""
    autoretry_for = (Exception,)
    retry_kwargs = {'max_retries': 3, 'countdown': 5}
    retry_backoff = True


@celery_app.task(base=CrawlerTask, name="crawl_website")
def crawl_website(task_id: str, root_url: str, max_depth: int = 2):
    """
    웹사이트 크롤링: 지정된 루트 URL에서 시작하여 최대 깊이까지 링크를 수집합니다.
    크롤링 후 스마트 임베딩 처리 작업을 큐에 추가합니다.
    """
    logger.info("🔵 웹사이트 크롤링 시작", task_id=task_id, root_url=root_url, max_depth=max_depth)

    # Run async crawler
    loop = asyncio.new_event_loop()
    asyncio.set_event_loop(loop)

    try:
        url_data_dict = loop.run_until_complete(
            crawl_async(root_url, max_depth)
        )

        logger.info(f"🔵 웹사이트 크롤링 완료 - {len(url_data_dict)}개 URL 발견", task_id=task_id)

        # 배치 크기 제한하여 스마트 임베딩 처리 작업 큐에 추가
        BATCH_SIZE = 50
        embedding_tasks = []

        for i, (url, text_content) in enumerate(url_data_dict.items()):
            if i > 0 and i % BATCH_SIZE == 0:
                # 배치 간 짧은 지연
                import time
                time.sleep(1)

            try:
                # 크롤링한 텍스트를 임베딩 작업에 전달
                task = process_url_for_embedding_smart.delay(url, text_content)
                embedding_tasks.append(task.id)
            except Exception as e:
                logger.warning(f"스마트 임베딩 처리 큐 추가 실패 {url}: {str(e)}")
                continue

        logger.info(f"🔵 {len(embedding_tasks)}개의 스마트 임베딩 처리 작업을 큐에 추가", task_id=task_id)

        return {
            "task_id": task_id,
            "status": "completed",
            "urls_found": len(url_data_dict),
            "embedding_tasks_queued": len(embedding_tasks),
            "urls": list(url_data_dict.keys())
        }

    except Exception as e:
        logger.error("🔴 웹사이트 크롤링 실패", task_id=task_id, error=str(e))
        raise
    finally:
        loop.close()


async def crawl_async(root_url: str, max_depth: int) -> Dict[str, str]:
    """
    Optimized async crawler using Playwright and BFS
    Returns a dictionary of {url: text_content} to avoid re-fetching during embedding
    """
    import random

    domain = urlparse(root_url).netloc

    # Acquire domain-level lock to prevent concurrent crawling of same domain
    async with domain_locks_lock:
        if domain not in domain_locks:
            domain_locks[domain] = asyncio.Lock()
        lock = domain_locks[domain]

    # Wait for lock - only one crawler per domain at a time
    async with lock:
        logger.info(f"🔒 Acquired crawl lock for domain: {domain}")

        # Add random initial delay to prevent overwhelming servers when multiple crawls start simultaneously
        initial_delay = random.uniform(5.0, 15.0)
        logger.info(f"🌐 Starting crawl of {root_url} (max_depth={max_depth}) - waiting {initial_delay:.1f}s before start")
        await asyncio.sleep(initial_delay)

        visited_urls = set()
        url_texts = {}  # Store URL -> text_content mapping
        to_visit = deque([(root_url, 0)])  # (url, depth)

        logger.info(f"🌐 Now crawling {root_url}")

        # Select a random User-Agent for this crawl session
        selected_user_agent = get_random_user_agent()
        logger.info(f"🎭 Using User-Agent: {selected_user_agent[:50]}...")

        async with async_playwright() as p:
            browser = await p.chromium.launch(
                headless=True,
                args=['--no-sandbox', '--disable-dev-shm-usage']  # Better Docker compatibility
            )
            context = await browser.new_context(
                user_agent=selected_user_agent
            )

            try:
                while to_visit:
                    current_url, depth = to_visit.popleft()

                    if current_url in visited_urls or depth > max_depth:
                        continue

                    # Skip file download URLs
                    if is_file_download_url(current_url):
                        logger.info(f"⏭️ Skipping file download URL: {current_url}")
                        visited_urls.add(current_url)
                        continue

                    try:
                        page = await context.new_page()

                        # Retry logic for connection issues
                        max_retries = 3
                        retry_count = 0
                        page_loaded = False

                        # File download URLs should fail fast without retries
                        if is_file_download_url(current_url):
                            max_retries = 1

                        while retry_count < max_retries and not page_loaded:
                            try:
                                # Set a more reasonable timeout for faster crawling
                                await page.goto(current_url, wait_until="domcontentloaded", timeout=30000)
                                page_loaded = True
                            except Exception as goto_error:
                                retry_count += 1
                                if retry_count < max_retries:
                                    wait_time = retry_count * 5  # 5s, 10s, 15s
                                    logger.warning(f"⚠️ Failed to load {current_url} (attempt {retry_count}/{max_retries}), retrying in {wait_time}s: {str(goto_error)}")
                                    await asyncio.sleep(wait_time)
                                else:
                                    raise  # Re-raise on final attempt

                        visited_urls.add(current_url)

                        # Extract text content from the page
                        try:
                            html_content = await page.content()
                            soup = BeautifulSoup(html_content, 'html.parser')

                            # Remove script and style elements
                            for script in soup(["script", "style", "nav", "footer", "header"]):
                                script.decompose()

                            # Try to find main content areas
                            main_content = None
                            for tag in ['main', 'article', 'div[role="main"]', '.content', '#content']:
                                main_content = soup.select_one(tag)
                                if main_content:
                                    break

                            # If no main content found, use body
                            if not main_content:
                                main_content = soup.body if soup.body else soup

                            # Extract text
                            text = main_content.get_text(separator='\n', strip=True)
                            # Clean up text
                            lines = [line.strip() for line in text.split('\n') if line.strip()]
                            text_content = '\n'.join(lines)

                            # Store the extracted text
                            url_texts[current_url] = text_content

                        except Exception as e:
                            logger.warning(f"Failed to extract text from {current_url}: {str(e)}")
                            url_texts[current_url] = ""  # Store empty string on failure

                        logger.info(f"🌐 Crawled: {current_url}", depth=depth, total_found=len(visited_urls))

                        # 요청 사이에 지연 추가 (너무 많은 동시 요청 방지)
                        await asyncio.sleep(2.0)  # 2초 지연으로 크롤링 속도 제한

                        if depth < max_depth:
                            # Extract all links more efficiently
                            links = await page.evaluate('''
                                () => {
                                    const links = Array.from(document.querySelectorAll('a[href]'));
                                    return links.map(a => a.href)
                                        .filter(href => {
                                            if (!href || href.startsWith('#') || href.startsWith('javascript:')) {
                                                return false;
                                            }
                                            const lower = href.toLowerCase();
                                            return !lower.match(/\.(pdf|jpg|jpeg|png|gif|zip|doc|docx|xls|xlsx|ppt|pptx)$/)
                                        });
                                }
                            ''')

                            # Filter and add new URLs (skip file download URLs)
                            for link in links:
                                try:
                                    absolute_url = urljoin(current_url, link)
                                    parsed = urlparse(absolute_url)

                                    # Skip file download URLs
                                    if is_file_download_url(absolute_url):
                                        continue

                                    # Only follow same domain links
                                    if (parsed.netloc == domain and
                                        absolute_url not in visited_urls and
                                        absolute_url not in [item[0] for item in to_visit]):
                                        to_visit.append((absolute_url, depth + 1))
                                except Exception:
                                    continue  # Skip invalid URLs

                        await page.close()

                    except Exception as e:
                        logger.warning(f"⚠️ Failed to crawl {current_url}: {str(e)}")
                        continue

            finally:
                await browser.close()

        logger.info(f"🌐 Crawl completed: {len(url_texts)} URLs found")
        return url_texts