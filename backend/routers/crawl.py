from fastapi import APIRouter, HTTPException
import structlog
import uuid
import json
from pathlib import Path
from datetime import datetime

from models import CrawlRequest, CrawlResponse, CrawlStatusResponse, CrawlSitesResponse, AutoCrawlResponse
from config import settings
from tasks.crawler import crawl_website, auto_crawl_websites

logger = structlog.get_logger()
router = APIRouter(prefix="/crawl", tags=["crawling"])


@router.post("", response_model=CrawlResponse)
async def trigger_crawl(request: CrawlRequest):
    """
    지정된 루트 URL에 대한 크롤링 작업을 시작합니다.
    
    Args:
        request: 크롤링 요청 정보 (URL, 깊이)
    
    Returns:
        CrawlResponse: 크롤링 작업 ID
    """
    try:
        task_id = str(uuid.uuid4())
        
        # 비동기 크롤링 작업 시작
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
        raise HTTPException(status_code=500, detail="크롤링 작업 시작에 실패했습니다")


@router.get("/{task_id}/status", response_model=CrawlStatusResponse)
async def get_crawl_status(task_id: str):
    """
    크롤링 작업의 상태를 조회합니다.
    
    Args:
        task_id: 크롤링 작업 ID
        
    Returns:
        CrawlStatusResponse: 작업 상태 정보
    """
    # TODO: 실제 작업 상태 추적 구현
    return CrawlStatusResponse(
        task_id=task_id,
        status="in_progress",
        message="작업 상태 추적이 구현 예정입니다"
    )


@router.get("/sites", response_model=CrawlSitesResponse)
async def get_crawl_sites():
    """
    설정된 크롤링 사이트 목록을 반환합니다.
    
    Returns:
        CrawlSitesResponse: 크롤링 사이트 설정 정보
    """
    try:
        config_path = Path(__file__).parent.parent / "crawl_sites.json"
        with open(config_path, 'r', encoding='utf-8') as f:
            data = json.load(f)
        
        return CrawlSitesResponse(
            sites=data["sites"],
            settings=data["settings"],
            total_enabled=len([s for s in data["sites"] if s.get("enabled", True)]),
            schedule=settings.crawl_schedule
        )
    
    except Exception as e:
        logger.error("Failed to load crawl sites", error=str(e))
        raise HTTPException(status_code=500, detail="크롤링 사이트 설정을 불러오는데 실패했습니다")


@router.post("/auto", response_model=AutoCrawlResponse)
async def trigger_auto_crawl():
    """
    미리 정의된 웹사이트들에 대한 자동 크롤링을 수동으로 시작합니다.
    
    Returns:
        AutoCrawlResponse: 자동 크롤링 작업 정보
    """
    try:
        task = auto_crawl_websites.delay()
        
        logger.info("Manual auto-crawl triggered", task_id=task.id)
        
        return AutoCrawlResponse(
            task_id=task.id,
            status="triggered",
            message="자동 크롤링 작업이 시작되었습니다",
            sites=settings.crawl_urls
        )
    
    except Exception as e:
        logger.error("Failed to trigger auto-crawl", error=str(e))
        raise HTTPException(status_code=500, detail="자동 크롤링 시작에 실패했습니다") 