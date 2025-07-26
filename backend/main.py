from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import structlog

from config import settings
from middleware.security import SecurityMiddleware
from api.routers import health, crawl, chat, database
from core.scheduler import crawl_scheduler

# Configure structured logging
logger = structlog.get_logger()

# Initialize FastAPI app
app = FastAPI(
    title="School RAG Chatbot API",
    description="API for crawling school websites and providing RAG-based Q&A",
    version="1.0.0"
)

# Add security middleware
app.add_middleware(
    SecurityMiddleware,
    rate_limit_requests=100,
    rate_limit_window=60
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

# Include routers
app.include_router(health.router)
app.include_router(crawl.router)
app.include_router(chat.router)
app.include_router(database.router)


@app.on_event("startup")
async def startup_event():
    """Initialize services on startup"""
    logger.info("Starting up RAG Chatbot API")
    crawl_scheduler.start()
    logger.info("RAG service initialized")


@app.on_event("shutdown") 
async def shutdown_event():
    """Cleanup on shutdown"""
    crawl_scheduler.shutdown()
    logger.info("RAG Chatbot API shutdown complete")


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "main:app",
        host=settings.api_host,
        port=settings.api_port,
        reload=settings.api_reload
    )