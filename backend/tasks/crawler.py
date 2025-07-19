from celery import Task
from celery_app import celery_app
from typing import Set, List
import asyncio
from urllib.parse import urljoin, urlparse
import structlog
from playwright.async_api import async_playwright
from collections import deque

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
    """
    logger.info("Starting crawl task", task_id=task_id, root_url=root_url, max_depth=max_depth)
    
    # Run async crawler
    loop = asyncio.new_event_loop()
    asyncio.set_event_loop(loop)
    
    try:
        urls = loop.run_until_complete(
            crawl_async(root_url, max_depth)
        )
        
        logger.info(f"Crawl completed, found {len(urls)} URLs", task_id=task_id)
        
        # Queue each URL for embedding processing
        for url in urls:
            process_url_for_embedding.delay(url)
        
        return {
            "task_id": task_id,
            "status": "completed",
            "urls_found": len(urls),
            "urls": list(urls)
        }
    
    finally:
        loop.close()


async def crawl_async(root_url: str, max_depth: int) -> Set[str]:
    """
    Async crawler using Playwright and BFS
    """
    visited_urls = set()
    to_visit = deque([(root_url, 0)])  # (url, depth)
    domain = urlparse(root_url).netloc
    
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        context = await browser.new_context()
        
        try:
            while to_visit:
                current_url, depth = to_visit.popleft()
                
                if current_url in visited_urls or depth > max_depth:
                    continue
                
                try:
                    page = await context.new_page()
                    await page.goto(current_url, wait_until="networkidle", timeout=30000)
                    
                    visited_urls.add(current_url)
                    logger.info(f"Crawled: {current_url}", depth=depth)
                    
                    if depth < max_depth:
                        # Extract all links
                        links = await page.evaluate('''
                            () => {
                                return Array.from(document.querySelectorAll('a[href]'))
                                    .map(a => a.href)
                                    .filter(href => href && !href.startsWith('#'))
                            }
                        ''')
                        
                        # Filter and add new URLs
                        for link in links:
                            absolute_url = urljoin(current_url, link)
                            parsed = urlparse(absolute_url)
                            
                            # Only follow same domain links
                            if parsed.netloc == domain and absolute_url not in visited_urls:
                                # Skip certain file types
                                if not any(absolute_url.lower().endswith(ext) for ext in ['.pdf', '.jpg', '.png', '.gif', '.zip']):
                                    to_visit.append((absolute_url, depth + 1))
                    
                    await page.close()
                
                except Exception as e:
                    logger.error(f"Error crawling {current_url}: {str(e)}")
                    continue
        
        finally:
            await browser.close()
    
    return visited_urls


@celery_app.task(base=CrawlerTask, name="auto_crawl_websites")
def auto_crawl_websites():
    """
    Automatically crawl predefined websites for new content
    """
    from config import settings
    
    logger.info("Starting automatic crawl of predefined websites")
    
    total_urls_found = 0
    total_new_urls = 0
    
    for root_url in settings.crawl_urls:
        try:
            logger.info(f"Auto-crawling: {root_url}")
            
            # Run async crawler
            loop = asyncio.new_event_loop()
            asyncio.set_event_loop(loop)
            
            try:
                urls = loop.run_until_complete(
                    crawl_async(root_url, settings.max_crawl_depth)
                )
                
                logger.info(f"Found {len(urls)} URLs from {root_url}")
                total_urls_found += len(urls)
                
                # Queue each URL for smart embedding processing
                new_urls = 0
                for url in urls:
                    # Use smart processing that checks content changes
                    result = process_url_for_embedding_smart.delay(url)
                    new_urls += 1
                
                total_new_urls += new_urls
                logger.info(f"Queued {new_urls} URLs for processing from {root_url}")
                
            finally:
                loop.close()
                
        except Exception as e:
            logger.error(f"Failed to auto-crawl {root_url}: {str(e)}")
            continue
    
    result = {
        "status": "completed",
        "total_urls_found": total_urls_found,
        "total_new_urls_queued": total_new_urls,
        "crawled_sites": settings.crawl_urls
    }
    
    logger.info("Auto-crawl completed", **result)
    return result