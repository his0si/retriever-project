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
    """
    logger.info("🔵 MANUAL CRAWL STARTED", task_id=task_id, root_url=root_url, max_depth=max_depth)
    
    # Run async crawler
    loop = asyncio.new_event_loop()
    asyncio.set_event_loop(loop)
    
    try:
        urls = loop.run_until_complete(
            crawl_async(root_url, max_depth)
        )
        
        logger.info(f"Crawl completed, found {len(urls)} URLs", task_id=task_id)
        
        # Queue each URL for smart embedding processing (checks content changes)
        for url in urls:
            process_url_for_embedding_smart.delay(url)
        
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
                    await page.goto(current_url, wait_until="networkidle", timeout=60000)
                    
                    visited_urls.add(current_url)
                    logger.info(f"🌐 Crawled: {current_url}", depth=depth)
                    
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
        
        enabled_sites = [site["url"] for site in data["sites"] if site.get("enabled", True)]
        logger.info(f"Found {len(enabled_sites)} enabled sites for auto-crawl")
        
        return enabled_sites
    
    except Exception as e:
        logger.error(f"Failed to load enabled sites: {str(e)}")
        return []


@celery_app.task(base=CrawlerTask, name="auto_crawl_websites")
def auto_crawl_websites():
    """
    Automatically crawl predefined websites for new content
    """
    from config import settings
    
    logger.info("🤖 AUTO CRAWL STARTED - JSON SITES")
    
    # Get enabled sites from crawl_sites.json
    enabled_sites = get_enabled_sites()
    
    if not enabled_sites:
        logger.warning("No enabled sites found for auto-crawl")
        return {
            "status": "completed",
            "total_urls_found": 0,
            "total_new_urls_queued": 0,
            "crawled_sites": [],
            "message": "No enabled sites found"
        }
    
    total_urls_found = 0
    total_new_urls = 0
    
    for root_url in enabled_sites:
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
        "crawled_sites": enabled_sites
    }
    
    logger.info("Auto-crawl completed", **result)
    return result