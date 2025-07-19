from fastapi import APIRouter, HTTPException
import structlog

from models import ChatRequest, ChatResponse
from services.rag import RAGService

logger = structlog.get_logger()
router = APIRouter(prefix="/chat", tags=["chat"])

# RAG 서비스 초기화
rag_service = RAGService()


@router.post("", response_model=ChatResponse)
async def chat(request: ChatRequest):
    """
    RAG를 사용하여 사용자 질문에 답변합니다.
    
    Args:
        request: 채팅 요청 (질문 내용)
        
    Returns:
        ChatResponse: 답변과 소스 정보
    """
    try:
        # RAG 서비스를 통해 답변 생성
        answer, sources = await rag_service.get_answer(request.question)
        
        logger.info(
            "Chat response generated",
            question=request.question,
            sources_count=len(sources)
        )
        
        return ChatResponse(answer=answer, sources=sources)
    
    except Exception as e:
        logger.error("Failed to generate answer", error=str(e))
        raise HTTPException(status_code=500, detail="답변 생성에 실패했습니다")