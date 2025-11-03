import structlog
from api import create_app
from config import settings
from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.triggers.cron import CronTrigger
from tasks.scheduled_crawler import crawl_folder_sites
from supabase_client import supabase
from datetime import datetime

# Configure structured logging
logger = structlog.get_logger()

# Create FastAPI app
app = create_app()

# Scheduler instance
scheduler = None


# Scheduler setup
def setup_scheduler():
    """Setup APScheduler for folder-based scheduled crawling"""
    global scheduler

    scheduler = BackgroundScheduler()

    try:
        # Supabase에서 활성화된 모든 폴더 가져오기
        folders_response = supabase.table("crawl_folders").select("*").eq("enabled", True).execute()
        folders = folders_response.data or []

        logger.info(f"Setting up scheduler with {len(folders)} enabled folders")

        for folder in folders:
            folder_id = folder["id"]
            folder_name = folder["name"]
            schedule_type = folder["schedule_type"]
            schedule_time = folder["schedule_time"]  # "HH:MM:SS" format
            schedule_day = folder.get("schedule_day")

            # Parse time
            time_parts = schedule_time.split(":")
            hour = int(time_parts[0])
            minute = int(time_parts[1])

            # Create trigger based on schedule type
            if schedule_type == "daily":
                trigger = CronTrigger(hour=hour, minute=minute)
            elif schedule_type == "weekly":
                # schedule_day: 0=일요일, 6=토요일
                trigger = CronTrigger(day_of_week=schedule_day, hour=hour, minute=minute)
            elif schedule_type == "monthly":
                # 매월 1일
                trigger = CronTrigger(day=1, hour=hour, minute=minute)
            else:
                logger.warning(f"Unknown schedule type: {schedule_type} for folder {folder_name}")
                continue

            # Add job to scheduler
            scheduler.add_job(
                func=lambda fid=folder_id, fname=folder_name: crawl_folder_sites.delay(fid, fname),
                trigger=trigger,
                id=f'crawl_folder_{folder_id}',
                name=f'Crawl Folder: {folder_name}',
                replace_existing=True
            )

            logger.info(f"Scheduled folder '{folder_name}' ({schedule_type}): {schedule_time}")

        return scheduler

    except Exception as e:
        logger.error(f"Failed to setup scheduler: {e}")
        return None


@app.on_event("startup")
async def startup_event():
    """Initialize services on startup"""
    logger.info("Starting up RAG Chatbot API")

    # Setup scheduler
    scheduler = setup_scheduler()
    if scheduler:
        scheduler.start()
        logger.info("Scheduled crawl scheduler started")

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