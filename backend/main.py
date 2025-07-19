from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import structlog

from config import settings
from startup import lifespan
from routers import crawl, chat, database, health

# 구조화된 로깅 설정
logger = structlog.get_logger()


def create_app() -> FastAPI:
    app = FastAPI(
        title="School RAG Chatbot API",
        description="학교 웹사이트 크롤링 및 RAG 기반 Q&A를 위한 API",
        version="1.0.0",
        lifespan=lifespan
    )

    # CORS 미들웨어 설정
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["http://localhost:3000"],  # Next.js 기본 포트
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    return app


def register_routers(app: FastAPI) -> None:
    """API 라우터들을 등록합니다."""
    app.include_router(health.router)
    app.include_router(crawl.router)
    app.include_router(chat.router)
    app.include_router(database.router)


# FastAPI 앱 초기화
app = create_app()
register_routers(app)


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "main:app",
        host=settings.api_host,
        port=settings.api_port,
        reload=settings.api_reload
    )