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
    Crawl a website starting from root_url up to max_depth
    크롤링 후 임베딩 작업을 제한된 배치로 큐에 추가
    """
    logger.info("🔵 MANUAL CRAWL STARTED", task_id=task_id, root_url=root_url, max_depth=max_depth)

    # Run async crawler
    loop = asyncio.new_event_loop()
    asyncio.set_event_loop(loop)

    try:
        urls = loop.run_until_complete(
            crawl_async(root_url, max_depth)
        )

        logger.info(f"🔵 CRAWL COMPLETED - Found {len(urls)} URLs", task_id=task_id)

        # 배치 크기 제한하여 임베딩 작업 큐에 추가
        BATCH_SIZE = 50
        embedding_tasks = []

        for i in range(0, len(urls), BATCH_SIZE):
            batch = list(urls)[i:i + BATCH_SIZE]
            for url in batch:
                try:
                    task = process_url_for_embedding_smart.delay(url)
                    embedding_tasks.append(task.id)
                except Exception as e:
                    logger.warning(f"Failed to queue {url}: {str(e)}")
                    continue

        logger.info(f"🔵 QUEUED {len(embedding_tasks)} EMBEDDING TASKS in batches", task_id=task_id)

        return {
            "task_id": task_id,
            "status": "completed",
            "urls_found": len(urls),
            "embedding_tasks_queued": len(embedding_tasks),
            "urls": list(urls)
        }

    except Exception as e:
        logger.error("🔴 CRAWL FAILED", task_id=task_id, error=str(e))
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


def get_enabled_sites():
    """
    Get list of enabled sites from crawl_sites.json
    """
    try:
        config_path = Path(__file__).parent.parent / "crawl_sites.json"
        
        if not config_path.exists():
            logger.error("crawl_sites.json not found", path=str(config_path))
            return []
        
        with open(config_path, 'r', encoding='utf-8') as f:
            data = json.load(f)
        
        enabled_sites = [site["url"] for site in data["sites"] if site.get("enabled") == True]
        logger.info(f"Found {len(enabled_sites)} enabled sites for auto-crawl")
        
        return enabled_sites
    
    except Exception as e:
        logger.error(f"Failed to load enabled sites: {str(e)}")
        return []


@celery_app.task(base=CrawlerTask, name="auto_crawl_websites")
def auto_crawl_websites():
    """
    Automatically crawl predefined websites for new content
    각 사이트를 크롤링하고 임베딩 작업을 제한된 큐로 처리
    """
    from config import settings

    logger.info("🤖 AUTO CRAWL STARTED - JSON SITES")

    # Get enabled sites from crawl_sites.json
    enabled_sites = get_enabled_sites()

    if not enabled_sites:
        logger.warning("⚠️ No enabled sites found for auto-crawl")
        return {
            "status": "completed",
            "total_sites": 0,
            "message": "No enabled sites found"
        }

    logger.info(f"🤖 Processing {len(enabled_sites)} enabled sites")

    total_urls_found = 0
    total_embedding_tasks = 0
    successful_sites = []
    failed_sites = []
    BATCH_SIZE = 50  # 한 번에 50개씩만 큐에 추가

    # 모든 사이트를 순차적으로 크롤링
    for site_index, root_url in enumerate(enabled_sites, 1):
        try:
            logger.info(f"🤖 Site {site_index}/{len(enabled_sites)}: {root_url}")

            # Run async crawler
            loop = asyncio.new_event_loop()
            asyncio.set_event_loop(loop)

            try:
                urls = loop.run_until_complete(
                    crawl_async(root_url, settings.max_crawl_depth)
                )

                logger.info(f"🤖 Found {len(urls)} URLs from {root_url}")
                total_urls_found += len(urls)

                # 배치로 임베딩 작업 큐에 추가
                embedding_tasks = []
                for i in range(0, len(urls), BATCH_SIZE):
                    batch = list(urls)[i:i + BATCH_SIZE]
                    for url in batch:
                        try:
                            task = process_url_for_embedding_smart.delay(url)
                            embedding_tasks.append(task.id)
                        except Exception as e:
                            logger.warning(f"Failed to queue {url}: {str(e)}")
                            continue

                total_embedding_tasks += len(embedding_tasks)
                successful_sites.append({
                    "url": root_url,
                    "urls_found": len(urls),
                    "embedding_tasks_queued": len(embedding_tasks)
                })

                logger.info(f"🤖 Queued {len(embedding_tasks)} embedding tasks for {root_url}")

            finally:
                loop.close()

        except Exception as e:
            logger.error(f"🔴 Failed to crawl {root_url}: {str(e)}")
            failed_sites.append({
                "url": root_url,
                "error": str(e)
            })
            continue

    result = {
        "status": "completed",
        "total_sites": len(enabled_sites),
        "total_urls_found": total_urls_found,
        "total_embedding_tasks_queued": total_embedding_tasks,
        "successful_sites": len(successful_sites),
        "failed_sites": len(failed_sites),
        "successful_site_details": successful_sites,
        "failed_site_details": failed_sites
    }

    logger.info("🤖 AUTO CRAWL COMPLETED",
                sites=len(enabled_sites),
                successful=len(successful_sites),
                failed=len(failed_sites),
                total_urls=total_urls_found,
                total_tasks=total_embedding_tasks)

    return result


@celery_app.task(base=CrawlerTask, name="auto_crawl_batch")
def auto_crawl_batch(site_urls: List[str], batch_number: int, total_batches: int):
    """
    Process a batch of sites for auto-crawling
    각 사이트를 크롤링만 하고, 임베딩은 사이트별로 하나의 배치 작업으로 처리
    """
    from config import settings

    logger.info(f"🤖 BATCH {batch_number}/{total_batches} STARTED - {len(site_urls)} sites")

    total_urls_found = 0
    successful_sites = []
    failed_sites = []

    for site_index, root_url in enumerate(site_urls, 1):
        try:
            logger.info(f"🤖 Batch {batch_number}/{total_batches} - Site {site_index}/{len(site_urls)}: {root_url}")

            # Run async crawler
            loop = asyncio.new_event_loop()
            asyncio.set_event_loop(loop)

            try:
                urls = loop.run_until_complete(
                    crawl_async(root_url, settings.max_crawl_depth)
                )

                logger.info(f"🤖 Batch {batch_number} - Found {len(urls)} URLs from {root_url}")
                total_urls_found += len(urls)

                # 각 URL마다 임베딩 작업을 만드는 대신, 동기적으로 처리
                processed_count = 0
                for url in urls:
                    try:
                        # 동기적으로 임베딩 처리 (큐에 쌓지 않음)
                        process_url_for_embedding_smart(url)
                        processed_count += 1
                    except Exception as e:
                        logger.warning(f"Failed to process {url}: {str(e)}")
                        continue

                successful_sites.append({
                    "url": root_url,
                    "urls_found": len(urls),
                    "urls_processed": processed_count
                })

                logger.info(f"🤖 Batch {batch_number} - Processed {processed_count}/{len(urls)} URLs from {root_url}")

            finally:
                loop.close()

        except Exception as e:
            logger.error(f"🔴 Batch {batch_number} - Failed to crawl {root_url}: {str(e)}")
            failed_sites.append({
                "url": root_url,
                "error": str(e)
            })
            continue

    result = {
        "batch_number": batch_number,
        "total_batches": total_batches,
        "status": "completed",
        "sites_processed": len(site_urls),
        "total_urls_found": total_urls_found,
        "successful_sites": len(successful_sites),
        "failed_sites": len(failed_sites),
        "successful_site_details": successful_sites,
        "failed_site_details": failed_sites
    }

    logger.info(f"🤖 BATCH {batch_number}/{total_batches} COMPLETED",
                sites_processed=len(site_urls),
                successful=len(successful_sites),
                failed=len(failed_sites),
                total_urls=total_urls_found)

    return result