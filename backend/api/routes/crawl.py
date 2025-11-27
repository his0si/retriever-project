from fastapi import APIRouter, HTTPException
from api.models import CrawlRequest, CrawlResponse, CrawlStatusResponse
from api.models.crawl_schedule import (
    CrawlFolderCreate,
    CrawlFolderUpdate,
    CrawlFolderResponse,
    ScheduledCrawlSiteCreate,
    ScheduledCrawlSiteUpdate,
    ScheduledCrawlSiteResponse,
    FolderWithSitesResponse,
    BatchUpdateSitesRequest
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

        # Check RabbitMQ queue status via HTTP API for both queues
        celery_queue_messages = 0
        embedding_queue_messages = 0
        try:
            import httpx

            # RabbitMQ Management API
            auth = (settings.rabbitmq_user, settings.rabbitmq_pass)

            with httpx.Client() as client:
                # Check celery queue (crawler)
                celery_url = f"http://{settings.rabbitmq_host}:15672/api/queues/%2F/celery"
                response = client.get(celery_url, auth=auth, timeout=5.0)
                if response.status_code == 200:
                    queue_info = response.json()
                    celery_queue_messages = queue_info.get("messages", 0)
                else:
                    logger.warning(f"RabbitMQ API error for celery queue: {response.status_code}")

                # Check embedding queue
                embedding_url = f"http://{settings.rabbitmq_host}:15672/api/queues/%2F/embedding"
                response = client.get(embedding_url, auth=auth, timeout=5.0)
                if response.status_code == 200:
                    queue_info = response.json()
                    embedding_queue_messages = queue_info.get("messages", 0)
                else:
                    logger.warning(f"RabbitMQ API error for embedding queue: {response.status_code}")

        except Exception as rabbitmq_error:
            logger.warning(f"Failed to get RabbitMQ status via API: {rabbitmq_error}")
            celery_queue_messages = 0
            embedding_queue_messages = 0

        # Assume celery worker is online (we'll check via celery inspect later)
        workers_online = 1

        # Try to get Celery stats if possible
        active_count = 0
        scheduled_count = 0
        reserved_count = celery_queue_messages + embedding_queue_messages
        active_details = []
        reserved_details = []
        total_stats = {}
        processing_stats = {}

        # Separate stats for crawler and embedding workers
        crawler_stats = {}
        embedding_stats = {}

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
            worker_details = {}
            stats = inspect.stats()
            if stats:
                workers_online = len(stats)
                for worker, worker_stats in stats.items():
                    if 'total' in worker_stats:
                        total_stats[worker] = worker_stats['total']

                    # Determine worker type
                    is_crawler = 'crawler-worker' in worker
                    is_embedding = 'embedding-worker' in worker

                    # Calculate processing rate (tasks per minute)
                    uptime = worker_stats.get('uptime', 0)
                    total_tasks = sum(worker_stats.get('total', {}).values())

                    stats_obj = {
                        "total_processed": total_tasks,
                        "uptime_seconds": uptime,
                        "tasks_per_minute": round((total_tasks / uptime) * 60, 2) if uptime > 0 else 0,
                        "tasks_per_hour": round((total_tasks / uptime) * 3600, 2) if uptime > 0 else 0,
                        "worker_name": worker
                    }

                    processing_stats[worker] = stats_obj

                    # Separate stats by worker type
                    if is_crawler:
                        crawler_stats = stats_obj
                    elif is_embedding:
                        embedding_stats = stats_obj

                    # Worker details
                    worker_details[worker] = {
                        "pid": worker_stats.get('pid', 'unknown'),
                        "uptime": uptime,
                        "pool": worker_stats.get('pool', {}),
                        "type": "crawler" if is_crawler else "embedding" if is_embedding else "unknown"
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

        # 크롤링이 없고 큐에 메시지가 있으면 임베딩 처리 중일 가능성이 높음
        if not is_crawling and not is_processing_embeddings and celery_queue_messages > 0 and workers_online > 0:
            is_processing_embeddings = True

        # 로깅 추가 (디버깅용)
        logger.info(
            "Queue status check",
            active_count=active_count,
            active_details_count=len(active_details),
            is_crawling=is_crawling,
            is_processing_embeddings=is_processing_embeddings,
            celery_queue_messages=celery_queue_messages,
            active_task_names=[task.get('name', 'unknown') for task in active_details[:3]]
        )

        return {
            "queue_status": {
                "active_tasks": active_count,
                "scheduled_tasks": scheduled_count,
                "reserved_tasks": reserved_count,
                "total_pending": active_count + scheduled_count + reserved_count,
                "rabbitmq_messages": celery_queue_messages + embedding_queue_messages,
                "crawler_queue_messages": celery_queue_messages,
                "embedding_queue_messages": embedding_queue_messages
            },
            "workers": {
                "online": workers_online,
                "details": worker_details
            },
            "task_details": {
                "active": active_details,
                "reserved": reserved_details
            },
            "processing_stats": processing_stats,
            "crawler_stats": crawler_stats,
            "embedding_stats": embedding_stats,
            "total_stats": total_stats,
            "current_activity": {
                "is_crawling": is_crawling,
                "is_processing_embeddings": is_processing_embeddings,
                "has_pending_work": (active_count + scheduled_count + reserved_count + celery_queue_messages + embedding_queue_messages) > 0
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

        # Step 2: Purge RabbitMQ queues (both celery and embedding)
        auth = (settings.rabbitmq_user, settings.rabbitmq_pass)
        celery_purged = 0
        embedding_purged = 0

        with httpx.Client() as client:
            # Purge celery queue
            celery_url = f"http://{settings.rabbitmq_host}:15672/api/queues/%2F/celery/contents"
            response = client.delete(celery_url, auth=auth, timeout=5.0)

            if response.status_code not in [200, 204]:
                logger.error(f"Failed to purge celery queue: {response.status_code} - {response.text}")
            else:
                try:
                    result = response.json()
                    celery_purged = result.get('message_count', 0)
                    logger.info(f"Purged celery queue: {celery_purged} messages")
                except:
                    celery_purged = 0

            # Purge embedding queue
            embedding_url = f"http://{settings.rabbitmq_host}:15672/api/queues/%2F/embedding/contents"
            response = client.delete(embedding_url, auth=auth, timeout=5.0)

            if response.status_code not in [200, 204]:
                logger.error(f"Failed to purge embedding queue: {response.status_code} - {response.text}")
            else:
                try:
                    result = response.json()
                    embedding_purged = result.get('message_count', 0)
                    logger.info(f"Purged embedding queue: {embedding_purged} messages")
                except:
                    embedding_purged = 0

        purged_count = celery_purged + embedding_purged

        total_cleared = revoked_count + purged_count
        logger.info(f"Queue purged: {revoked_count} active tasks revoked, {celery_purged} celery messages + {embedding_purged} embedding messages = {purged_count} total deleted")

        return {
            "status": "success",
            "message": f"모든 작업이 중지되었습니다 (크롤링: {celery_purged}개, 임베딩: {embedding_purged}개)",
            "total_cleared": total_cleared,
            "active_revoked": revoked_count,
            "queued_purged": purged_count,
            "celery_purged": celery_purged,
            "embedding_purged": embedding_purged
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

        # 폴더의 max_depth 가져오기 (기본값 2)
        folder_max_depth = folder.data[0].get("max_depth", 2)

        # 각 사이트를 크롤링 태스크로 추가
        for site in sites.data:
            crawl_website.delay(
                task_id=f"{task_id}_{site['id']}",
                root_url=site["url"],
                max_depth=folder_max_depth
            )
            logger.info(f"Queued crawl for site: {site['name']} ({site['url']}) with max_depth={folder_max_depth}")

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


@router.patch("/folders/{folder_id}/sites/batch-update")
async def batch_update_sites(folder_id: str, request: BatchUpdateSitesRequest):
    """
    Batch update all sites in a folder with the same enabled state
    """
    try:
        # 폴더 존재 확인
        folder = supabase.table("crawl_folders").select("*").eq("id", folder_id).execute()
        if not folder.data:
            raise HTTPException(status_code=404, detail=f"Folder with ID '{folder_id}' not found")

        folder_name = folder.data[0]["name"]

        # 해당 폴더의 모든 사이트 조회
        sites = supabase.table("scheduled_crawl_sites").select("id").eq("folder_id", folder_id).execute()

        if not sites.data:
            logger.info(f"No sites found in folder '{folder_name}', nothing to update")
            return {
                "folder_id": folder_id,
                "folder_name": folder_name,
                "updated_count": 0,
                "total_count": 0,
                "success": True
            }

        # Supabase에서 한 번에 업데이트
        result = supabase.table("scheduled_crawl_sites").update({
            "enabled": request.enabled
        }).eq("folder_id", folder_id).execute()

        updated_count = len(result.data) if result.data else 0
        total_count = len(sites.data)

        logger.info(
            f"Batch updated sites in folder '{folder_name}'",
            folder_id=folder_id,
            enabled=request.enabled,
            updated_count=updated_count,
            total_count=total_count
        )

        return {
            "folder_id": folder_id,
            "folder_name": folder_name,
            "updated_count": updated_count,
            "total_count": total_count,
            "success": True
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error("Failed to batch update sites", error=str(e))
        raise HTTPException(status_code=500, detail=f"Failed to batch update sites: {str(e)}")