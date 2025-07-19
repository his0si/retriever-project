from contextlib import asynccontextmanager
import structlog
from typing import Optional

from config import settings
from tasks.crawler import auto_crawl_websites

logger = structlog.get_logger()


def create_scheduler():
    """스케줄러 생성 및 설정"""
    if not settings.auto_crawl_enabled:
        return None
        
    from apscheduler.schedulers.background import BackgroundScheduler
    from apscheduler.triggers.cron import CronTrigger
    
    scheduler = BackgroundScheduler()
    
    # 크론 스케줄 파싱
    cron_parts = settings.crawl_schedule.split()
    trigger = CronTrigger(
        minute=int(cron_parts[0]) if cron_parts[0] != '*' else None,
        hour=int(cron_parts[1]) if cron_parts[1] != '*' else None,
        day=int(cron_parts[2]) if cron_parts[2] != '*' else None,
        month=int(cron_parts[3]) if cron_parts[3] != '*' else None,
        day_of_week=int(cron_parts[4]) if cron_parts[4] != '*' else None,
    )
    
    # 자동 크롤링 작업 추가
    scheduler.add_job(
        func=lambda: auto_crawl_websites.delay(),
        trigger=trigger,
        id='auto_crawl_job',
        name='Auto Crawl Websites',
        replace_existing=True
    )
    
    return scheduler


@asynccontextmanager
async def lifespan(app):
    """FastAPI 앱 라이프사이클 관리"""
    # 시작 로직
    logger.info("Starting up RAG Chatbot API")
    
    scheduler = create_scheduler()
    if scheduler:
        scheduler.start()
        logger.info(f"Auto-crawl scheduler started: {settings.crawl_schedule}")
    
    logger.info("RAG service initialized")
    
    yield  # 앱 실행
    
    # 종료 로직
    if scheduler:
        scheduler.shutdown()
        logger.info("Scheduler shutdown complete")
    logger.info("RAG Chatbot API shutdown complete") 