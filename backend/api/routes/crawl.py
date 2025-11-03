from fastapi import APIRouter, HTTPException
from api.models import CrawlRequest, CrawlResponse, CrawlStatusResponse
from api.models.crawl_schedule import (
    CrawlFolderCreate,
    CrawlFolderUpdate,
    CrawlFolderResponse,
    ScheduledCrawlSiteCreate,
    ScheduledCrawlSiteUpdate,
    ScheduledCrawlSiteResponse,
    FolderWithSitesResponse
)
from tasks.crawler import crawl_website
from config import settings
from celery_app import celery_app
from supabase_client import supabase
import uuid
import json
from pathlib import Path
import structlog
from typing import List

router = APIRouter(prefix="/crawl", tags=["crawl"])
logger = structlog.get_logger()


@router.post("", response_model=CrawlResponse)
async def trigger_crawl(request: CrawlRequest):
    """
    Trigger a crawling task for the given root URL
    """
    try:
        task_id = str(uuid.uuid4())
        
        # Trigger async crawl task
        crawl_website.delay(
            task_id=task_id,
            root_url=str(request.root_url),
            max_depth=request.max_depth
        )
        
        logger.info(
            "Crawl task triggered",
            task_id=task_id,
            root_url=str(request.root_url),
            max_depth=request.max_depth
        )
        
        return CrawlResponse(task_id=task_id)
    
    except Exception as e:
        logger.error("Failed to trigger crawl", error=str(e))
        raise HTTPException(status_code=500, detail="Failed to trigger crawl task")


@router.get("/queue/status")
async def get_queue_status():
    """
    Get RabbitMQ/Celery queue status and statistics with enhanced details
    """
    try:
        import subprocess
        import json

        # Check RabbitMQ queue status via HTTP API
        celery_queue_messages = 0
        try:
            import httpx

            # RabbitMQ Management API
            rabbitmq_url = f"http://{settings.rabbitmq_host}:15672/api/queues/%2F/celery"
            auth = (settings.rabbitmq_user, settings.rabbitmq_pass)

            with httpx.Client() as client:
                response = client.get(rabbitmq_url, auth=auth, timeout=5.0)
                if response.status_code == 200:
                    queue_info = response.json()
                    celery_queue_messages = queue_info.get("messages", 0)
                else:
                    logger.warning(f"RabbitMQ API error: {response.status_code}")

        except Exception as rabbitmq_error:
            logger.warning(f"Failed to get RabbitMQ status via API: {rabbitmq_error}")
            celery_queue_messages = 0

        # Assume celery worker is online (we'll check via celery inspect later)
        workers_online = 1

        # Try to get Celery stats if possible
        active_count = 0
        scheduled_count = 0
        reserved_count = celery_queue_messages
        active_details = []
        reserved_details = []
        total_stats = {}
        processing_stats = {}

        try:
            # Get Celery app stats if available
            inspect = celery_app.control.inspect()

            # Get active tasks
            active_tasks = inspect.active()
            if active_tasks:
                for worker, tasks in active_tasks.items():
                    active_count += len(tasks)
                    for task in tasks:
                        active_details.append({
                            "worker": worker,
                            "task_id": task.get('id', 'unknown'),
                            "name": task.get('name', 'unknown'),
                            "args": task.get('args', []),
                            "kwargs": task.get('kwargs', {}),
                            "time_start": task.get('time_start'),
                            "worker_pid": task.get('worker_pid')
                        })

            # Get scheduled tasks
            scheduled_tasks = inspect.scheduled()
            if scheduled_tasks:
                for worker, tasks in scheduled_tasks.items():
                    scheduled_count += len(tasks)

            # Get reserved tasks (queued but not active)
            reserved_tasks = inspect.reserved()
            if reserved_tasks:
                for worker, tasks in reserved_tasks.items():
                    reserved_count = len(tasks)
                    for task in tasks:
                        reserved_details.append({
                            "worker": worker,
                            "task_id": task.get('id', 'unknown'),
                            "name": task.get('name', 'unknown'),
                            "args": task.get('args', [])
                        })

            # Get worker stats
            stats = inspect.stats()
            if stats:
                workers_online = len(stats)
                for worker, worker_stats in stats.items():
                    if 'total' in worker_stats:
                        total_stats[worker] = worker_stats['total']

                    # Calculate processing rate (tasks per minute)
                    uptime = worker_stats.get('uptime', 0)
                    total_tasks = sum(worker_stats.get('total', {}).values())
                    if uptime > 0:
                        processing_stats[worker] = {
                            "total_processed": total_tasks,
                            "uptime_seconds": uptime,
                            "tasks_per_minute": round((total_tasks / uptime) * 60, 2) if uptime > 0 else 0,
                            "tasks_per_hour": round((total_tasks / uptime) * 3600, 2) if uptime > 0 else 0
                        }

        except Exception as celery_error:
            logger.warning(f"Failed to get Celery stats, using fallback: {celery_error}")
            # Use fallback values from Docker/RabbitMQ
            reserved_count = celery_queue_messages

        # Determine activity status
        is_crawling = any(task.get('name', '').startswith('crawl') or 'crawl' in task.get('name', '')
                         for task in active_details) if active_details else False

        is_processing_embeddings = any(task.get('name', '').find('embedding') != -1
                                     for task in active_details) if active_details else False

        # Only show embedding processing if crawling is NOT active and we have embedding tasks
        if not is_crawling and celery_queue_messages > 0 and workers_online > 0:
            is_processing_embeddings = True

        return {
            "queue_status": {
                "active_tasks": active_count,
                "scheduled_tasks": scheduled_count,
                "reserved_tasks": reserved_count,
                "total_pending": active_count + scheduled_count + reserved_count,
                "rabbitmq_messages": celery_queue_messages
            },
            "workers": {
                "online": workers_online,
                "details": {}
            },
            "task_details": {
                "active": active_details,
                "reserved": reserved_details
            },
            "processing_stats": processing_stats,
            "total_stats": total_stats,
            "current_activity": {
                "is_crawling": is_crawling,
                "is_processing_embeddings": is_processing_embeddings,
                "has_pending_work": (active_count + scheduled_count + reserved_count + celery_queue_messages) > 0
            },
            "timestamp": str(uuid.uuid4())[:8]  # Simple timestamp for cache busting
        }

    except Exception as e:
        logger.error("Failed to get queue status", error=str(e))
        raise HTTPException(status_code=500, detail=f"Failed to get queue status: {str(e)}")


@router.post("/queue/purge")
async def purge_queue():
    """
    Completely purge all tasks from RabbitMQ queue and revoke active tasks
    """
    try:
        import httpx

        revoked_count = 0
        purged_count = 0

        # Step 1: Revoke all active tasks
        try:
            inspect = celery_app.control.inspect()
            active_tasks = inspect.active()

            if active_tasks:
                for worker, tasks in active_tasks.items():
                    for task in tasks:
                        task_id = task.get('id')
                        if task_id:
                            # Revoke task with terminate=True to kill the worker process
                            celery_app.control.revoke(task_id, terminate=True, signal='SIGKILL')
                            revoked_count += 1
                            logger.info(f"Revoked active task: {task_id}")
        except Exception as revoke_error:
            logger.warning(f"Failed to revoke some active tasks: {revoke_error}")

        # Step 2: Purge RabbitMQ queue
        rabbitmq_url = f"http://{settings.rabbitmq_host}:15672/api/queues/%2F/celery/contents"
        auth = (settings.rabbitmq_user, settings.rabbitmq_pass)

        with httpx.Client() as client:
            # DELETE all messages from the queue
            response = client.delete(rabbitmq_url, auth=auth, timeout=5.0)

            if response.status_code not in [200, 204]:
                logger.error(f"Failed to purge RabbitMQ queue: {response.status_code} - {response.text}")
                raise HTTPException(
                    status_code=500,
                    detail=f"RabbitMQ 큐 초기화 실패: {response.status_code}"
                )

            # Try to get purged count from response
            try:
                result = response.json()
                purged_count = result.get('message_count', 0)
            except:
                purged_count = 0

        total_cleared = revoked_count + purged_count
        logger.info(f"Queue purged: {revoked_count} active tasks revoked, {purged_count} queued messages deleted")

        return {
            "status": "success",
            "message": f"모든 작업이 중지되었습니다",
            "total_cleared": total_cleared,
            "active_revoked": revoked_count,
            "queued_purged": purged_count
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error("Failed to purge queue", error=str(e))
        raise HTTPException(status_code=500, detail=f"큐 초기화 실패: {str(e)}")


@router.get("/{task_id}/status")
async def get_crawl_status(task_id: str):
    """
    Get the status of a crawling task
    """
    # TODO: Implement task status tracking
    return CrawlStatusResponse(
        task_id=task_id,
        status="in_progress",
        message="Task status tracking will be implemented"
    )


# ============================================================================
# Supabase 기반 스케줄 크롤링 API
# ============================================================================

@router.get("/folders", response_model=List[FolderWithSitesResponse])
async def get_crawl_folders():
    """
    Get all crawl folders with their sites
    """
    try:
        # 모든 폴더 조회
        folders_response = supabase.table("crawl_folders").select("*").order("created_at", desc=False).execute()

        if not folders_response.data:
            return []

        # 각 폴더에 대한 사이트 조회
        result = []
        for folder in folders_response.data:
            sites_response = supabase.table("scheduled_crawl_sites").select("*").eq("folder_id", folder["id"]).order("created_at", desc=False).execute()

            folder_data = {
                **folder,
                "sites": sites_response.data or []
            }
            result.append(folder_data)

        logger.info(f"Retrieved {len(result)} folders")
        return result

    except Exception as e:
        logger.error("Failed to get folders", error=str(e))
        raise HTTPException(status_code=500, detail=f"Failed to get folders: {str(e)}")


@router.post("/folders", response_model=CrawlFolderResponse)
async def create_crawl_folder(folder: CrawlFolderCreate):
    """
    Create a new crawl folder
    """
    try:
        folder_data = folder.model_dump()

        # 이름 중복 체크
        existing = supabase.table("crawl_folders").select("*").eq("name", folder.name).execute()
        if existing.data:
            raise HTTPException(status_code=400, detail=f"Folder with name '{folder.name}' already exists")

        # 폴더 생성
        result = supabase.table("crawl_folders").insert(folder_data).execute()

        logger.info(f"Created folder: {folder.name}")
        return result.data[0]

    except HTTPException:
        raise
    except Exception as e:
        logger.error("Failed to create folder", error=str(e))
        raise HTTPException(status_code=500, detail=f"Failed to create folder: {str(e)}")


@router.patch("/folders/{folder_id}", response_model=CrawlFolderResponse)
async def update_crawl_folder(folder_id: str, folder: CrawlFolderUpdate):
    """
    Update an existing crawl folder
    """
    try:
        # 폴더 존재 확인
        existing = supabase.table("crawl_folders").select("*").eq("id", folder_id).execute()
        if not existing.data:
            raise HTTPException(status_code=404, detail=f"Folder with ID '{folder_id}' not found")

        # 업데이트할 데이터만 추출
        update_data = folder.model_dump(exclude_unset=True)

        if not update_data:
            raise HTTPException(status_code=400, detail="No fields to update")

        # 이름 중복 체크 (이름 변경 시)
        if "name" in update_data:
            name_check = supabase.table("crawl_folders").select("*").eq("name", update_data["name"]).neq("id", folder_id).execute()
            if name_check.data:
                raise HTTPException(status_code=400, detail=f"Folder with name '{update_data['name']}' already exists")

        # 폴더 업데이트
        result = supabase.table("crawl_folders").update(update_data).eq("id", folder_id).execute()

        logger.info(f"Updated folder: {folder_id}")
        return result.data[0]

    except HTTPException:
        raise
    except Exception as e:
        logger.error("Failed to update folder", error=str(e))
        raise HTTPException(status_code=500, detail=f"Failed to update folder: {str(e)}")


@router.delete("/folders/{folder_id}")
async def delete_crawl_folder(folder_id: str):
    """
    Delete a crawl folder (and all its sites via CASCADE)
    """
    try:
        # 폴더 존재 확인
        existing = supabase.table("crawl_folders").select("*").eq("id", folder_id).execute()
        if not existing.data:
            raise HTTPException(status_code=404, detail=f"Folder with ID '{folder_id}' not found")

        folder_name = existing.data[0]["name"]

        # 폴더 삭제 (CASCADE로 관련 사이트도 자동 삭제)
        supabase.table("crawl_folders").delete().eq("id", folder_id).execute()

        logger.info(f"Deleted folder: {folder_name} (ID: {folder_id})")
        return {"message": f"Folder '{folder_name}' deleted successfully"}

    except HTTPException:
        raise
    except Exception as e:
        logger.error("Failed to delete folder", error=str(e))
        raise HTTPException(status_code=500, detail=f"Failed to delete folder: {str(e)}")


@router.post("/folders/{folder_id}/sites", response_model=ScheduledCrawlSiteResponse)
async def create_crawl_site(folder_id: str, site: ScheduledCrawlSiteCreate):
    """
    Add a new site to a folder
    """
    try:
        # 폴더 존재 확인
        folder_check = supabase.table("crawl_folders").select("*").eq("id", folder_id).execute()
        if not folder_check.data:
            raise HTTPException(status_code=404, detail=f"Folder with ID '{folder_id}' not found")

        # folder_id 설정
        site_data = site.model_dump()
        site_data["folder_id"] = folder_id

        # URL 중복 체크 (같은 폴더 내)
        existing = supabase.table("scheduled_crawl_sites").select("*").eq("folder_id", folder_id).eq("url", site.url).execute()
        if existing.data:
            raise HTTPException(status_code=400, detail=f"Site with URL '{site.url}' already exists in this folder")

        # 사이트 생성
        result = supabase.table("scheduled_crawl_sites").insert(site_data).execute()

        logger.info(f"Created site: {site.name} in folder {folder_id}")
        return result.data[0]

    except HTTPException:
        raise
    except Exception as e:
        logger.error("Failed to create site", error=str(e))
        raise HTTPException(status_code=500, detail=f"Failed to create site: {str(e)}")


@router.patch("/sites/{site_id}", response_model=ScheduledCrawlSiteResponse)
async def update_crawl_site(site_id: str, site: ScheduledCrawlSiteUpdate):
    """
    Update an existing crawl site
    """
    try:
        # 사이트 존재 확인
        existing = supabase.table("scheduled_crawl_sites").select("*").eq("id", site_id).execute()
        if not existing.data:
            raise HTTPException(status_code=404, detail=f"Site with ID '{site_id}' not found")

        # 업데이트할 데이터만 추출
        update_data = site.model_dump(exclude_unset=True)

        if not update_data:
            raise HTTPException(status_code=400, detail="No fields to update")

        # URL 중복 체크 (URL 변경 시)
        if "url" in update_data:
            folder_id = existing.data[0]["folder_id"]
            url_check = supabase.table("scheduled_crawl_sites").select("*").eq("folder_id", folder_id).eq("url", update_data["url"]).neq("id", site_id).execute()
            if url_check.data:
                raise HTTPException(status_code=400, detail=f"Site with URL '{update_data['url']}' already exists in this folder")

        # 사이트 업데이트
        result = supabase.table("scheduled_crawl_sites").update(update_data).eq("id", site_id).execute()

        logger.info(f"Updated site: {site_id}")
        return result.data[0]

    except HTTPException:
        raise
    except Exception as e:
        logger.error("Failed to update site", error=str(e))
        raise HTTPException(status_code=500, detail=f"Failed to update site: {str(e)}")


@router.delete("/sites/{site_id}")
async def delete_crawl_site(site_id: str):
    """
    Delete a crawl site
    """
    try:
        # 사이트 존재 확인
        existing = supabase.table("scheduled_crawl_sites").select("*").eq("id", site_id).execute()
        if not existing.data:
            raise HTTPException(status_code=404, detail=f"Site with ID '{site_id}' not found")

        site_name = existing.data[0]["name"]

        # 사이트 삭제
        supabase.table("scheduled_crawl_sites").delete().eq("id", site_id).execute()

        logger.info(f"Deleted site: {site_name} (ID: {site_id})")
        return {"message": f"Site '{site_name}' deleted successfully"}

    except HTTPException:
        raise
    except Exception as e:
        logger.error("Failed to delete site", error=str(e))
        raise HTTPException(status_code=500, detail=f"Failed to delete site: {str(e)}")


@router.post("/folders/{folder_id}/execute", response_model=CrawlResponse)
async def execute_folder_crawl(folder_id: str):
    """
    Execute immediate crawl for all enabled sites in a folder
    """
    try:
        # 폴더 확인
        folder = supabase.table("crawl_folders").select("*").eq("id", folder_id).execute()
        if not folder.data:
            raise HTTPException(status_code=404, detail=f"Folder with ID '{folder_id}' not found")

        folder_name = folder.data[0]["name"]

        # 해당 폴더의 활성화된 사이트들만 가져오기
        sites = supabase.table("scheduled_crawl_sites").select("*").eq("folder_id", folder_id).eq("enabled", True).execute()

        if not sites.data:
            raise HTTPException(status_code=400, detail=f"No enabled sites found in folder '{folder_name}'")

        task_id = str(uuid.uuid4())

        # 각 사이트를 크롤링 태스크로 추가
        for site in sites.data:
            crawl_website.delay(
                task_id=f"{task_id}_{site['id']}",
                root_url=site["url"],
                max_depth=2  # 기본 depth 2
            )
            logger.info(f"Queued crawl for site: {site['name']} ({site['url']})")

        logger.info(
            "Folder crawl tasks triggered",
            folder_id=folder_id,
            folder_name=folder_name,
            task_id=task_id,
            site_count=len(sites.data)
        )

        return CrawlResponse(task_id=task_id)

    except HTTPException:
        raise
    except Exception as e:
        logger.error("Failed to execute folder crawl", error=str(e))
        raise HTTPException(status_code=500, detail=f"Failed to execute folder crawl: {str(e)}")