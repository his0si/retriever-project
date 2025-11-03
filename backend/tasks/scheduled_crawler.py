"""
Scheduled crawler tasks for folder-based crawling
"""
import asyncio
import structlog
from celery import Task
from celery_app import celery_app
from supabase_client import supabase
from tasks.crawler import crawl_async
from tasks.embeddings import process_url_for_embedding_smart
from config import settings

logger = structlog.get_logger()


class ScheduledCrawlerTask(Task):
    """Base task for scheduled crawling with proper error handling"""

    def on_failure(self, exc, task_id, args, kwargs, einfo):
        """Handle task failure"""
        logger.error(
            "Scheduled crawl task failed",
            task_id=task_id,
            exception=str(exc),
            traceback=str(einfo)
        )

    def on_success(self, retval, task_id, args, kwargs):
        """Handle task success"""
        logger.info(
            "Scheduled crawl task completed",
            task_id=task_id,
            result=retval
        )


@celery_app.task(base=ScheduledCrawlerTask, name="crawl_folder_sites", time_limit=7200, soft_time_limit=7000)
def crawl_folder_sites(folder_id: str, folder_name: str):
    """
    Crawl all enabled sites in a specific folder

    Args:
        folder_id: UUID of the folder
        folder_name: Name of the folder (for logging)
    """
    logger.info(f"🚀 Starting scheduled crawl for folder: {folder_name} (ID: {folder_id})")

    try:
        # 1. 폴더의 활성화된 사이트 가져오기
        sites_response = supabase.table("scheduled_crawl_sites").select("*").eq("folder_id", folder_id).eq("enabled", True).execute()

        sites = sites_response.data or []
        logger.info(f"📋 Found {len(sites)} enabled sites in folder '{folder_name}'")

        if not sites:
            logger.info(f"⚠️  No enabled sites in folder '{folder_name}'. Skipping.")
            return {
                "status": "completed",
                "folder_id": folder_id,
                "folder_name": folder_name,
                "total_sites": 0,
                "message": "No enabled sites to crawl"
            }

        # 2. 각 사이트 크롤링
        loop = asyncio.get_event_loop()
        if loop.is_closed():
            loop = asyncio.new_event_loop()
            asyncio.set_event_loop(loop)

        total_urls_found = 0
        total_embedding_tasks_queued = 0
        successful_sites = 0
        failed_sites = 0
        site_details = []

        for site_index, site in enumerate(sites, 1):
            site_name = site["name"]
            site_url = site["url"]

            logger.info(f"🔍 [{site_index}/{len(sites)}] Crawling site: {site_name} ({site_url})")

            try:
                # Async crawl
                urls = loop.run_until_complete(
                    crawl_async(site_url, settings.max_crawl_depth)
                )

                urls_count = len(urls)
                total_urls_found += urls_count

                logger.info(f"✅ [{site_index}/{len(sites)}] Found {urls_count} URLs from {site_name}")

                # Queue embedding tasks
                embedding_tasks_queued = 0
                for url in urls:
                    try:
                        task = process_url_for_embedding_smart.delay(url)
                        embedding_tasks_queued += 1
                    except Exception as e:
                        logger.warning(f"Failed to queue embedding task for {url}: {e}")

                total_embedding_tasks_queued += embedding_tasks_queued

                successful_sites += 1
                site_details.append({
                    "site_name": site_name,
                    "site_url": site_url,
                    "urls_found": urls_count,
                    "embedding_tasks_queued": embedding_tasks_queued,
                    "status": "success"
                })

            except Exception as e:
                failed_sites += 1
                logger.error(f"❌ [{site_index}/{len(sites)}] Failed to crawl {site_name}: {str(e)}")
                site_details.append({
                    "site_name": site_name,
                    "site_url": site_url,
                    "urls_found": 0,
                    "embedding_tasks_queued": 0,
                    "status": "failed",
                    "error": str(e)
                })

        # 3. 결과 반환
        result = {
            "status": "completed",
            "folder_id": folder_id,
            "folder_name": folder_name,
            "total_sites": len(sites),
            "successful_sites": successful_sites,
            "failed_sites": failed_sites,
            "total_urls_found": total_urls_found,
            "total_embedding_tasks_queued": total_embedding_tasks_queued,
            "site_details": site_details
        }

        logger.info(
            f"✅ Folder '{folder_name}' crawl completed",
            result=result
        )

        return result

    except Exception as e:
        logger.error(f"❌ Failed to crawl folder '{folder_name}': {str(e)}")
        raise
