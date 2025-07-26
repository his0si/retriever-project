from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, field_validator
from typing import List
import structlog

from services.rag import RAGService
from middleware.security import InputSanitizer

logger = structlog.get_logger()
router = APIRouter(prefix="/chat", tags=["chat"])

# Initialize services
rag_service = RAGService()


class ChatRequest(BaseModel):
    question: str
    
    @field_validator('question')
    def validate_question(cls, v):
        return InputSanitizer.sanitize_text(v, max_length=500)


class ChatResponse(BaseModel):
    answer: str
    sources: List[str]


@router.post("", response_model=ChatResponse)
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