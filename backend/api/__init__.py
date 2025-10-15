from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from config import settings
from .routes import health_router, crawl_router, chat_router, database_router


def create_app() -> FastAPI:
    """Create and configure FastAPI application"""
    app = FastAPI(
        title="School RAG Chatbot API",
        description="API for crawling school websites and providing RAG-based Q&A",
        version="1.0.0"
    )

    # Configure CORS
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins_list,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    # Include routers
    app.include_router(health_router)
    app.include_router(crawl_router)
    app.include_router(chat_router)
    app.include_router(database_router, prefix="/db", tags=["database"])

    return app