from celery import Task
from celery_app import celery_app
from typing import Set, List
import asyncio
from urllib.parse import urljoin, urlparse
import structlog
from playwright.async_api import async_playwright
from collections import deque
import uuid
import json
from pathlib import Path

from tasks.embeddings import process_url_for_embedding
from tasks.embeddings import process_url_for_embedding_incremental, process_url_for_embedding_smart

logger = structlog.get_logger()


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
        urls = loop.run_until_complete(
            crawl_async(root_url, max_depth)
        )

        logger.info(f"🔵 웹사이트 크롤링 완료 - {len(urls)}개 URL 발견", task_id=task_id)

        # 배치 크기 제한하여 스마트 임베딩 처리 작업 큐에 추가
        BATCH_SIZE = 50
        embedding_tasks = []

        for i in range(0, len(urls), BATCH_SIZE):
            batch = list(urls)[i:i + BATCH_SIZE]
            for url in batch:
                try:
                    task = process_url_for_embedding_smart.delay(url)
                    embedding_tasks.append(task.id)
                except Exception as e:
                    logger.warning(f"스마트 임베딩 처리 큐 추가 실패 {url}: {str(e)}")
                    continue

        logger.info(f"🔵 {len(embedding_tasks)}개의 스마트 임베딩 처리 작업을 큐에 추가", task_id=task_id)

        return {
            "task_id": task_id,
            "status": "completed",
            "urls_found": len(urls),
            "embedding_tasks_queued": len(embedding_tasks),
            "urls": list(urls)
        }

    except Exception as e:
        logger.error("🔴 웹사이트 크롤링 실패", task_id=task_id, error=str(e))
        raise
    finally:
        loop.close()


async def crawl_async(root_url: str, max_depth: int) -> Set[str]:
    """
    Optimized async crawler using Playwright and BFS
    Focused purely on crawling without embedding processing
    """
    visited_urls = set()
    to_visit = deque([(root_url, 0)])  # (url, depth)
    domain = urlparse(root_url).netloc

    logger.info(f"🌐 Starting crawl of {root_url} (max_depth={max_depth})")

    async with async_playwright() as p:
        browser = await p.chromium.launch(
            headless=True,
            args=['--no-sandbox', '--disable-dev-shm-usage']  # Better Docker compatibility
        )
        context = await browser.new_context(
            user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"
        )

        try:
            while to_visit:
                current_url, depth = to_visit.popleft()

                if current_url in visited_urls or depth > max_depth:
                    continue

                try:
                    page = await context.new_page()

                    # Set a more reasonable timeout for faster crawling
                    await page.goto(current_url, wait_until="domcontentloaded", timeout=30000)

                    visited_urls.add(current_url)
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

                        # Filter and add new URLs
                        for link in links:
                            try:
                                absolute_url = urljoin(current_url, link)
                                parsed = urlparse(absolute_url)

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

    logger.info(f"🌐 Crawl completed: {len(visited_urls)} URLs found")
    return visited_urls