from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.triggers.cron import CronTrigger
import structlog

from config import settings
from tasks.crawler import auto_crawl_websites

logger = structlog.get_logger()


class CrawlScheduler:
    def __init__(self):
        self.scheduler = None
        
    def start(self):
        """Start the auto-crawl scheduler"""
        if not settings.auto_crawl_enabled:
            logger.info("Auto-crawl is disabled in settings")
            return
            
        self.scheduler = BackgroundScheduler()
        
        # Parse cron schedule
        cron_parts = settings.crawl_schedule.split()
        trigger = CronTrigger(
            minute=int(cron_parts[0]) if cron_parts[0] != '*' else None,
            hour=int(cron_parts[1]) if cron_parts[1] != '*' else None,
            day=int(cron_parts[2]) if cron_parts[2] != '*' else None,
            month=int(cron_parts[3]) if cron_parts[3] != '*' else None,
            day_of_week=int(cron_parts[4]) if cron_parts[4] != '*' else None,
        )
        
        self.scheduler.add_job(
            func=lambda: auto_crawl_websites.delay(),
            trigger=trigger,
            id='auto_crawl_job',
            name='Auto Crawl Websites',
            replace_existing=True
        )
        
        self.scheduler.start()
        logger.info(f"Auto-crawl scheduler started: {settings.crawl_schedule}")
        
    def shutdown(self):
        """Shutdown the scheduler"""
        if self.scheduler and self.scheduler.running:
            self.scheduler.shutdown()
            logger.info("Auto-crawl scheduler shutdown")


# Global scheduler instance
crawl_scheduler = CrawlScheduler()