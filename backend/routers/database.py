from fastapi import APIRouter, HTTPException
import structlog
from datetime import datetime
from typing import List, Dict, Any, Tuple

from models import DBStatusResponse
from config import settings

logger = structlog.get_logger()
router = APIRouter(prefix="/db", tags=["database"])


def get_qdrant_client():
    """Qdrant 클라이언트 인스턴스를 반환합니다."""
    from qdrant_client import QdrantClient
    
    return QdrantClient(
        host=settings.qdrant_host,
        port=settings.qdrant_port
    )


def get_collection_info(client) -> int:
    """컬렉션 정보를 가져와서 총 점수를 반환합니다."""
    try:
        collection_info = client.get_collection(settings.qdrant_collection_name)
        total_points = collection_info.points_count
        logger.info(f"✅ Collection '{settings.qdrant_collection_name}' found with {total_points} points")
        return total_points
    except Exception as e:
        logger.error(f"❌ Failed to get collection info: {e}")
        # 대안: scroll을 사용하여 점수 계산
        return count_points_via_scroll(client)


def count_points_via_scroll(client) -> int:
    """스크롤을 사용하여 전체 점수를 계산합니다."""
    try:
        total_points = 0
        next_offset = None
        
        while True:
            scroll_result = client.scroll(
                collection_name=settings.qdrant_collection_name,
                limit=1000,
                offset=next_offset,
                with_payload=False,
                with_vectors=False
            )
            
            points, next_offset = scroll_result
            total_points += len(points)
            
            if next_offset is None:  # 더 이상 데이터가 없음
                break
                
        logger.info(f"✅ Fallback: Counted {total_points} total points via scroll")
        return total_points
    except Exception as scroll_e:
        logger.error(f"❌ Scroll counting failed: {scroll_e}")
        return 0


def get_recent_data(client) -> List[Dict[str, Any]]:
    """최근 저장된 데이터를 조회하고 정렬하여 반환합니다."""
    try:
        logger.info("📋 Fetching recent data...")
        recent_data = client.scroll(
            collection_name=settings.qdrant_collection_name,
            limit=100,  # 더 많이 가져와서 최신 데이터 포함 확률 높이기
            with_payload=True
        )[0]
        
        logger.info(f"📋 Found {len(recent_data)} recent data points")
        
        # 페이로드에서 정보 추출
        recent_items = []
        for point in recent_data:
            if point.payload:
                item = {
                    "url": point.payload.get("url", "Unknown"),
                    "updated_at": point.payload.get("updated_at", "Unknown"),
                    "chunk_index": point.payload.get("chunk_index", 0),
                    "total_chunks": point.payload.get("total_chunks", 1)
                }
                recent_items.append(item)
                logger.debug(f"📄 Item: {item['url']} - {item['updated_at']}")
        
        return sort_items_by_time(recent_items)[:10]  # 상위 10개만
        
    except Exception as e:
        logger.error(f"❌ Failed to get recent data: {e}")
        return []


def sort_items_by_time(items: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """시간순으로 아이템들을 정렬합니다."""
    def sort_key(x):
        if x["updated_at"] == "Unknown":
            return (1, "")  # Unknown은 맨 뒤로
        try:
            # 시간 문자열을 datetime으로 파싱해서 정렬
            dt = datetime.fromisoformat(x["updated_at"].replace('Z', '+00:00'))
            return (0, dt)
        except:
            return (1, x["updated_at"])  # 파싱 실패시 뒤로
            
    items.sort(key=sort_key, reverse=True)  # 최신이 먼저
    logger.info(f"📋 Processed {len(items)} items")
    return items


@router.get("/status", response_model=DBStatusResponse)
async def get_db_status():
    """
    데이터베이스 상태와 최근 크롤링 정보를 조회합니다.
    
    Returns:
        DBStatusResponse: 데이터베이스 상태 정보
    """
    try:
        logger.info(f"Connecting to Qdrant at {settings.qdrant_host}:{settings.qdrant_port}")
        
        client = get_qdrant_client()
        
        # 컬렉션 정보 가져오기
        total_points = get_collection_info(client)
        
        # 최근 데이터 조회
        recent_items = get_recent_data(client)
        
        return DBStatusResponse(
            status="healthy",
            total_documents=total_points,
            collection_name=settings.qdrant_collection_name,
            recent_updates=recent_items[:5],  # 최근 5개만
            last_checked=datetime.now().isoformat()
        )
        
    except Exception as e:
        logger.error(f"Failed to get DB status: {e}")
        raise HTTPException(
            status_code=500, 
            detail=f"데이터베이스 상태 조회에 실패했습니다: {str(e)}"
        ) 