from fastapi import APIRouter

from models import HealthResponse

router = APIRouter(tags=["health"])


@router.get("/health", response_model=HealthResponse)
async def health_check():
    """
    서비스 상태를 확인하는 헬스체크 엔드포인트입니다.
    
    Returns:
        HealthResponse: 서비스 상태 정보
    """
    return HealthResponse(status="healthy", service="rag-chatbot-api") 