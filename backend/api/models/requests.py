from pydantic import BaseModel, HttpUrl


class CrawlRequest(BaseModel):
    root_url: HttpUrl
    max_depth: int = 2


class ChatRequest(BaseModel):
    question: str
    mode: str = "filter"  # "filter" or "expand"
    user_id: str = "anonymous"  # 사용자 ID (전공 맞춤형 검색용)