from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime


class CrawlResponse(BaseModel):
    task_id: str


class ChatResponse(BaseModel):
    answer: str
    sources: List[str]


class CrawlStatusResponse(BaseModel):
    task_id: str
    status: str
    message: str


class RecentUpdate(BaseModel):
    url: str
    updated_at: str
    chunk_index: int
    total_chunks: int


class DbStatusResponse(BaseModel):
    status: str
    total_documents: int
    collection_name: str
    recent_updates: List[RecentUpdate]
    last_checked: str
    error: Optional[str] = None