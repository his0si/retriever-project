from .health import router as health_router
from .crawl import router as crawl_router
from .chat import router as chat_router
from .database import router as database_router

__all__ = ['health_router', 'crawl_router', 'chat_router', 'database_router']