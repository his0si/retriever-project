from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, HttpUrl
from typing import List, Optional
import uuid
import structlog
from datetime import datetime

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
    allow_origins=[
        "http://localhost:3000",
        "http://retrieverproject.duckdns.org",
        "https://retrieverproject.duckdns.org",
        "http://146.56.99.100",
        "https://146.56.99.100"
    ],
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


@app.get("/db/status")
async def get_db_status():
    """Get database status and recent crawling info"""
    try:
        # Qdrant 컬렉션 정보 가져오기
        from qdrant_client import QdrantClient
        
        qdrant_client = QdrantClient(
            url=settings.qdrant_host,
            api_key=settings.qdrant_api_key
        )
        
        logger.info(f"Connecting to Qdrant at {settings.qdrant_host}:{settings.qdrant_port}")
        
        # 컬렉션 정보 - 정확한 개수 가져오기
        try:
            collection_info = qdrant_client.get_collection(settings.qdrant_collection_name)
            total_points = collection_info.points_count
            logger.info(f"✅ Collection '{settings.qdrant_collection_name}' found with {total_points} points")
        except Exception as e:
            logger.error(f"❌ Failed to get collection info: {e}")
            # 대안: 전체 점 개수를 정확히 세기 (scroll 반복)
            try:
                total_points = 0
                next_offset = None
                
                while True:
                    scroll_result = qdrant_client.scroll(
                        collection_name=settings.qdrant_collection_name,
                        limit=1000,
                        offset=next_offset,
                        with_payload=False,
                        with_vectors=False
                    )
                    
                    points, next_offset = scroll_result
                    total_points += len(points)
                    
                    if next_offset is None:  # 더 이상 데이터가 없음
                        break
                        
                logger.info(f"✅ Fallback: Counted {total_points} total points via scroll")
            except Exception as scroll_e:
                logger.error(f"❌ Scroll counting failed: {scroll_e}")
                total_points = 0
        
        # 최근 저장된 데이터 조회 (더 많이 가져와서 정렬)
        try:
            logger.info("📋 Fetching recent data...")
            recent_data = qdrant_client.scroll(
                collection_name=settings.qdrant_collection_name,
                limit=100,  # 더 많이 가져와서 최신 데이터 포함 확률 높이기
                with_payload=True
            )[0]
            
            logger.info(f"📋 Found {len(recent_data)} recent data points")
            
            # updated_at 기준으로 정렬
            recent_items = []
            for point in recent_data:
                if point.payload:
                    item = {
                        "url": point.payload.get("url", "Unknown"),
                        "updated_at": point.payload.get("updated_at", "Unknown"),
                        "chunk_index": point.payload.get("chunk_index", 0),
                        "total_chunks": point.payload.get("total_chunks", 1)
                    }
                    recent_items.append(item)
                    logger.debug(f"📄 Item: {item['url']} - {item['updated_at']}")
            
            # 시간순 정렬 (최신이 먼저, Unknown은 나중에)
            def sort_key(x):
                if x["updated_at"] == "Unknown":
                    return (1, "")  # Unknown은 맨 뒤로
                try:
                    # 시간 문자열을 datetime으로 파싱해서 정렬
                    dt = datetime.fromisoformat(x["updated_at"].replace('Z', '+00:00'))
                    return (0, dt)
                except:
                    return (1, x["updated_at"])  # 파싱 실패시 뒤로
                    
            recent_items.sort(key=sort_key, reverse=True)  # 최신이 먼저
            
            # 상위 10개만 선택
            recent_items = recent_items[:10]
            logger.info(f"📋 Processed {len(recent_items)} items (showing top 10)")
            
        except Exception as e:
            recent_items = []
            logger.error(f"❌ Failed to get recent data: {e}")
        
        return {
            "status": "healthy",
            "total_documents": total_points,
            "collection_name": settings.qdrant_collection_name,
            "recent_updates": recent_items[:5],  # 최근 5개만
            "last_checked": datetime.now().isoformat()
        }
        
    except Exception as e:
        logger.error(f"Failed to get DB status: {e}")
        return {
            "status": "error",
            "error": str(e),
            "last_checked": datetime.now().isoformat()
        }


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