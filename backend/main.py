from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, HttpUrl
from typing import List, Optional
import uuid
import structlog

from config import settings
from tasks.crawler import crawl_website, auto_crawl_websites
from services.rag import RAGService

# Configure structured logging
logger = structlog.get_logger()

# Initialize FastAPI app
app = FastAPI(
    title="School RAG Chatbot API",
    description="API for crawling school websites and providing RAG-based Q&A",
    version="1.0.0"
)

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],  # Next.js default port
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize services
rag_service = RAGService()


# Request/Response Models
class CrawlRequest(BaseModel):
    root_url: HttpUrl
    max_depth: int = 2


class CrawlResponse(BaseModel):
    task_id: str


class ChatRequest(BaseModel):
    question: str


class ChatResponse(BaseModel):
    answer: str
    sources: List[str]


# API Endpoints
@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {"status": "healthy", "service": "rag-chatbot-api"}


@app.post("/crawl", response_model=CrawlResponse)
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


@app.post("/chat", response_model=ChatResponse)
async def chat(request: ChatRequest):
    """
    Answer user questions using RAG
    """
    try:
        # Get answer from RAG service
        answer, sources = await rag_service.get_answer(request.question)
        
        logger.info(
            "Chat response generated",
            question=request.question,
            sources_count=len(sources)
        )
        
        return ChatResponse(answer=answer, sources=sources)
    
    except Exception as e:
        logger.error("Failed to generate answer", error=str(e))
        raise HTTPException(status_code=500, detail="Failed to generate answer")


@app.get("/crawl/{task_id}/status")
async def get_crawl_status(task_id: str):
    """
    Get the status of a crawling task
    """
    # TODO: Implement task status tracking
    return {
        "task_id": task_id,
        "status": "in_progress",
        "message": "Task status tracking will be implemented"
    }


@app.get("/crawl/sites")
async def get_crawl_sites():
    """
    Get list of configured crawl sites
    """
    try:
        import json
        from pathlib import Path
        
        config_path = Path(__file__).parent / "crawl_sites.json"
        with open(config_path, 'r', encoding='utf-8') as f:
            data = json.load(f)
        
        return {
            "sites": data["sites"],
            "settings": data["settings"],
            "total_enabled": len([s for s in data["sites"] if s.get("enabled", True)]),
            "schedule": settings.crawl_schedule
        }
    
    except Exception as e:
        logger.error("Failed to load crawl sites", error=str(e))
        raise HTTPException(status_code=500, detail="Failed to load crawl sites configuration")


# Scheduler setup
if settings.auto_crawl_enabled:
    from apscheduler.schedulers.background import BackgroundScheduler
    from apscheduler.triggers.cron import CronTrigger
    
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


@app.on_event("startup")
async def startup_event():
    """Initialize services on startup"""
    logger.info("Starting up RAG Chatbot API")
    
    if settings.auto_crawl_enabled:
        scheduler.start()
        logger.info(f"Auto-crawl scheduler started: {settings.crawl_schedule}")
    
    logger.info("RAG service initialized")


@app.on_event("shutdown") 
async def shutdown_event():
    """Cleanup on shutdown"""
    if settings.auto_crawl_enabled:
        scheduler.shutdown()
    logger.info("RAG Chatbot API shutdown complete")


@app.post("/crawl/auto", response_model=dict)
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


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "main:app",
        host=settings.api_host,
        port=settings.api_port,
        reload=settings.api_reload
    )