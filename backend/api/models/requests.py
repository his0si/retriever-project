from pydantic import BaseModel, HttpUrl


class CrawlRequest(BaseModel):
    root_url: HttpUrl
    max_depth: int = 2


class ChatRequest(BaseModel):
    question: str