from pydantic import BaseModel, HttpUrl
from typing import List


class CrawlRequest(BaseModel):
    """웹사이트 크롤링 요청 모델"""
    root_url: HttpUrl
    max_depth: int = 2


class CrawlResponse(BaseModel):
    """웹사이트 크롤링 응답 모델"""
    task_id: str


class ChatRequest(BaseModel):
    """채팅 요청 모델"""
    question: str


class ChatResponse(BaseModel):
    """채팅 응답 모델"""
    answer: str
    sources: List[str]


class AutoCrawlResponse(BaseModel):
    """자동 크롤링 응답 모델"""
    task_id: str
    status: str
    message: str
    sites: List[str]


class CrawlStatusResponse(BaseModel):
    """크롤링 상태 응답 모델"""
    task_id: str
    status: str
    message: str


class HealthResponse(BaseModel):
    """헬스체크 응답 모델"""
    status: str
    service: str


class DBStatusResponse(BaseModel):
    """데이터베이스 상태 응답 모델"""
    status: str
    total_documents: int
    collection_name: str
    recent_updates: List[dict]
    last_checked: str


class CrawlSitesResponse(BaseModel):
    """크롤링 사이트 목록 응답 모델"""
    sites: List[dict]
    settings: dict
    total_enabled: int
    schedule: str 