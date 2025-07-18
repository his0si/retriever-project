from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, HttpUrl
from typing import List, Optional
import uuid
import structlog

from config import settings
from tasks.crawler import crawl_website
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


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "main:app",
        host=settings.api_host,
        port=settings.api_port,
        reload=settings.api_reload
    )