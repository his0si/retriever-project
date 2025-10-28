from fastapi import APIRouter, HTTPException
from api.models import ChatRequest, ChatResponse
from services.rag import RAGService
import structlog

router = APIRouter(prefix="/chat", tags=["chat"])
logger = structlog.get_logger()

# Initialize services
rag_service = RAGService()


@router.post("", response_model=ChatResponse)
async def chat(request: ChatRequest):
    """
    Answer user questions using RAG
    """
    try:
        # Get answer from RAG service
        answer, sources = await rag_service.get_answer(
            question=request.question,
            mode=request.mode
        )

        logger.info(
            "Chat response generated",
            question=request.question,
            mode=request.mode,
            sources_count=len(sources)
        )

        return ChatResponse(answer=answer, sources=sources)

    except Exception as e:
        logger.error("Failed to generate answer", error=str(e))
        raise HTTPException(status_code=500, detail="Failed to generate answer")