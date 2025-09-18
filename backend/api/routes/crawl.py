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
        # Get Celery app stats
        inspect = celery_app.control.inspect()

        # Get active tasks
        active_tasks = inspect.active()
        active_count = 0
        active_details = []
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
        scheduled_count = 0
        if scheduled_tasks:
            for worker, tasks in scheduled_tasks.items():
                scheduled_count += len(tasks)

        # Get reserved tasks (queued but not active)
        reserved_tasks = inspect.reserved()
        reserved_count = 0
        reserved_details = []
        if reserved_tasks:
            for worker, tasks in reserved_tasks.items():
                reserved_count += len(tasks)
                for task in tasks:
                    reserved_details.append({
                        "worker": worker,
                        "task_id": task.get('id', 'unknown'),
                        "name": task.get('name', 'unknown'),
                        "args": task.get('args', [])
                    })

        # Get worker stats
        stats = inspect.stats()
        workers_online = len(stats) if stats else 0

        # Extract task totals and processing stats
        total_stats = {}
        processing_stats = {}

        if stats:
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

        # Check if any crawling is currently happening by looking at logs or task names
        is_crawling = any(task.get('name', '').startswith('crawl') or 'crawl' in task.get('name', '')
                         for task_list in active_tasks.values() for task in task_list) if active_tasks else False

        is_processing_embeddings = any(task.get('name', '').find('embedding') != -1
                                     for task_list in active_tasks.values() for task in task_list) if active_tasks else False

        return {
            "queue_status": {
                "active_tasks": active_count,
                "scheduled_tasks": scheduled_count,
                "reserved_tasks": reserved_count,
                "total_pending": active_count + scheduled_count + reserved_count
            },
            "workers": {
                "online": workers_online,
                "details": stats or {}
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
                "has_pending_work": (active_count + scheduled_count + reserved_count) > 0
            },
            "timestamp": str(uuid.uuid4())[:8]  # Simple timestamp for cache busting
        }

    except Exception as e:
        logger.error("Failed to get queue status", error=str(e))
        raise HTTPException(status_code=500, detail=f"Failed to get queue status: {str(e)}")


@router.post("/queue/purge")
async def purge_queue():
    """
    Purge/reset all queued crawling tasks
    """
    try:
        # Purge the main queues
        purged_count = 0

        # Try to purge the default queue
        try:
            result = celery_app.control.purge()
            if result:
                for worker, count in result.items():
                    purged_count += count
        except Exception as purge_error:
            logger.warning("Failed to purge via control.purge", error=str(purge_error))

        # Revoke all active tasks
        inspect = celery_app.control.inspect()
        active_tasks = inspect.active()
        revoked_count = 0

        if active_tasks:
            for worker, tasks in active_tasks.items():
                for task in tasks:
                    try:
                        celery_app.control.revoke(task['id'], terminate=True)
                        revoked_count += 1
                    except Exception:
                        continue

        # Also revoke scheduled tasks
        scheduled_tasks = inspect.scheduled()
        if scheduled_tasks:
            for worker, tasks in scheduled_tasks.items():
                for task in tasks:
                    try:
                        celery_app.control.revoke(task['id'], terminate=True)
                        revoked_count += 1
                    except Exception:
                        continue

        logger.info("Queue purged", purged_count=purged_count, revoked_count=revoked_count)

        return {
            "status": "success",
            "message": "크롤링 큐가 초기화되었습니다",
            "purged_tasks": purged_count,
            "revoked_tasks": revoked_count,
            "total_cleared": purged_count + revoked_count
        }

    except Exception as e:
        logger.error("Failed to purge queue", error=str(e))
        raise HTTPException(status_code=500, detail=f"Failed to purge queue: {str(e)}")


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
        # 활성화된 사이트만 필터링
        config_path = Path(__file__).parent.parent.parent / "crawl_sites.json"
        enabled_sites = []
        
        if config_path.exists():
            with open(config_path, 'r', encoding='utf-8') as f:
                data = json.load(f)
            
            enabled_sites = [site["url"] for site in data["sites"] if site.get("enabled", True)]
            logger.info(f"Auto-crawl will process {len(enabled_sites)} enabled sites")
        
        if not enabled_sites:
            raise HTTPException(status_code=400, detail="No enabled sites found for auto-crawl")
        
        task = auto_crawl_websites.delay()
        
        logger.info("Manual auto-crawl triggered", task_id=task.id, enabled_sites=enabled_sites)
        
        return {
            "task_id": task.id,
            "status": "triggered",
            "message": "Auto-crawl task started",
            "sites": enabled_sites
        }
    
    except Exception as e:
        logger.error("Failed to trigger auto-crawl", error=str(e))
        raise HTTPException(status_code=500, detail="Failed to trigger auto-crawl")