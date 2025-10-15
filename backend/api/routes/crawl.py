from fastapi import APIRouter, HTTPException
from api.models import CrawlRequest, CrawlResponse, CrawlStatusResponse
from tasks.crawler import crawl_website, auto_crawl_websites
from config import settings
from celery_app import celery_app
import uuid
import json
from pathlib import Path
import structlog

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


@router.get("/sites")
async def get_crawl_sites():
    """
    Get list of configured crawl sites
    """
    try:
        config_path = Path(__file__).parent.parent.parent / "crawl_sites.json"
        
        # 파일 존재 여부 확인 및 로깅
        if not config_path.exists():
            logger.error("crawl_sites.json not found", path=str(config_path))
            raise HTTPException(status_code=404, detail="crawl_sites.json file not found")
        
        # 파일을 매번 새로 읽음 (캐싱 방지)
        with open(config_path, 'r', encoding='utf-8') as f:
            data = json.load(f)
        
        logger.info("Loaded crawl sites", 
                   path=str(config_path), 
                   sites_count=len(data.get("sites", [])))
        
        return {
            "sites": data["sites"],
            "settings": data["settings"],
            "schedule": settings.crawl_schedule
        }
    
    except json.JSONDecodeError as e:
        logger.error("Invalid JSON in crawl_sites.json", error=str(e))
        raise HTTPException(status_code=500, detail="Invalid JSON format in crawl_sites.json")
    except Exception as e:
        logger.error("Failed to load crawl sites", error=str(e))
        raise HTTPException(status_code=500, detail="Failed to load crawl sites configuration")


@router.post("/sites/{site_name}/toggle")
async def toggle_site(site_name: str):
    """
    Toggle the enabled status of a specific site
    """
    try:
        config_path = Path(__file__).parent.parent.parent / "crawl_sites.json"
        
        if not config_path.exists():
            raise HTTPException(status_code=404, detail="crawl_sites.json file not found")
        
        # 파일 읽기
        with open(config_path, 'r', encoding='utf-8') as f:
            data = json.load(f)
        
        # 사이트 찾기 및 토글
        site_found = False
        for site in data["sites"]:
            if site["name"] == site_name:
                site["enabled"] = not site.get("enabled", True)
                site_found = True
                logger.info(f"Toggled site {site_name} to {site['enabled']}")
                break
        
        if not site_found:
            raise HTTPException(status_code=404, detail=f"Site '{site_name}' not found")
        
        # 파일에 다시 쓰기
        with open(config_path, 'w', encoding='utf-8') as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
        
        return {
            "site_name": site_name,
            "enabled": next(site["enabled"] for site in data["sites"] if site["name"] == site_name),
            "message": f"Site '{site_name}' toggled successfully"
        }
    
    except Exception as e:
        logger.error(f"Failed to toggle site {site_name}", error=str(e))
        raise HTTPException(status_code=500, detail=f"Failed to toggle site: {str(e)}")


@router.post("/auto", response_model=dict)
async def trigger_auto_crawl():
    """
    Manually trigger automatic crawling of predefined websites
    """
    try:
        task = auto_crawl_websites.delay()

        logger.info("Manual auto-crawl triggered", task_id=task.id)

        return {
            "task_id": task.id,
            "status": "triggered",
            "message": "Auto-crawl task started"
        }

    except Exception as e:
        logger.error("Failed to trigger auto-crawl", error=str(e))
        raise HTTPException(status_code=500, detail="Failed to trigger auto-crawl")