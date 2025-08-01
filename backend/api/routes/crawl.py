from fastapi import APIRouter, HTTPException
from api.models import CrawlRequest, CrawlResponse, CrawlStatusResponse
from tasks.crawler import crawl_website, auto_crawl_websites
from config import settings
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
            "message": "Auto-crawl task started",
            "sites": settings.crawl_urls
        }
    
    except Exception as e:
        logger.error("Failed to trigger auto-crawl", error=str(e))
        raise HTTPException(status_code=500, detail="Failed to trigger auto-crawl")