import structlog
from api import create_app
from config import settings
from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.triggers.cron import CronTrigger
from tasks.crawler import auto_crawl_websites

# Configure structured logging
logger = structlog.get_logger()

# Create FastAPI app
app = create_app()

# Scheduler instance
scheduler = None


# Scheduler setup
def setup_scheduler():
    """Setup APScheduler for auto-crawling"""
    global scheduler
    
    if settings.auto_crawl_enabled:
        scheduler = BackgroundScheduler()
        
        # Add auto-crawl job
        cron_parts = settings.crawl_schedule.split()
        trigger = CronTrigger(
            minute=int(cron_parts[0]) if cron_parts[0] != '*' else None,
            hour=int(cron_parts[1]) if cron_parts[1] != '*' else None,
            day=int(cron_parts[2]) if cron_parts[2] != '*' else None,
            month=int(cron_parts[3]) if cron_parts[3] != '*' else None,
            day_of_week=int(cron_parts[4]) if cron_parts[4] != '*' else None,
        )
        
        scheduler.add_job(
            func=lambda: auto_crawl_websites.delay(),
            trigger=trigger,
            id='auto_crawl_job',
            name='Auto Crawl Websites',
            replace_existing=True
        )
        
        return scheduler
    return None


@app.on_event("startup")
async def startup_event():
    """Initialize services on startup"""
    logger.info("Starting up RAG Chatbot API")
    
    # Setup scheduler
    scheduler = setup_scheduler()
    if scheduler:
        scheduler.start()
        logger.info(f"Auto-crawl scheduler started: {settings.crawl_schedule}")
    
    logger.info("RAG service initialized")


@app.on_event("shutdown") 
async def shutdown_event():
    """Cleanup on shutdown"""
    if scheduler:
        scheduler.shutdown()
    logger.info("RAG Chatbot API shutdown complete")


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "main:app",
        host=settings.api_host,
        port=settings.api_port,
        reload=settings.api_reload
    )