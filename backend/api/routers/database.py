from fastapi import APIRouter
from datetime import datetime
from qdrant_client import QdrantClient
import structlog

from config import settings

logger = structlog.get_logger()
router = APIRouter(prefix="/db", tags=["database"])


@router.get("/status")
async def get_db_status():
    """Get database status and recent crawling info"""
    try:
        # Qdrant 컬렉션 정보 가져오기
        qdrant_client = QdrantClient(
            url=settings.qdrant_host,
            api_key=settings.qdrant_api_key
        )
        
        logger.info(f"Connecting to Qdrant at {settings.qdrant_host}:{settings.qdrant_port}")
        
        # 컬렉션 정보 - 정확한 개수 가져오기
        try:
            collection_info = qdrant_client.get_collection(settings.qdrant_collection_name)
            total_points = collection_info.points_count
            logger.info(f"✅ Collection '{settings.qdrant_collection_name}' found with {total_points} points")
        except Exception as e:
            logger.error(f"❌ Failed to get collection info: {e}")
            # 대안: 전체 점 개수를 정확히 세기 (scroll 반복)
            try:
                total_points = 0
                next_offset = None
                
                while True:
                    scroll_result = qdrant_client.scroll(
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
            except Exception as scroll_e:
                logger.error(f"❌ Scroll counting failed: {scroll_e}")
                total_points = 0
        
        # 최근 저장된 데이터 조회 (더 많이 가져와서 정렬)
        try:
            logger.info("📋 Fetching recent data...")
            recent_data = qdrant_client.scroll(
                collection_name=settings.qdrant_collection_name,
                limit=100,  # 더 많이 가져와서 최신 데이터 포함 확률 높이기
                with_payload=True
            )[0]
            
            logger.info(f"📋 Found {len(recent_data)} recent data points")
            
            # updated_at 기준으로 정렬
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
            
            # 시간순 정렬 (최신이 먼저, Unknown은 나중에)
            def sort_key(x):
                if x["updated_at"] == "Unknown":
                    return (1, "")  # Unknown은 맨 뒤로
                try:
                    # 시간 문자열을 datetime으로 파싱해서 정렬
                    dt = datetime.fromisoformat(x["updated_at"].replace('Z', '+00:00'))
                    return (0, dt)
                except:
                    return (1, x["updated_at"])  # 파싱 실패시 뒤로
                    
            recent_items.sort(key=sort_key, reverse=True)  # 최신이 먼저
            
            # 상위 10개만 선택
            recent_items = recent_items[:10]
            logger.info(f"📋 Processed {len(recent_items)} items (showing top 10)")
            
        except Exception as e:
            recent_items = []
            logger.error(f"❌ Failed to get recent data: {e}")
        
        return {
            "status": "healthy",
            "total_documents": total_points,
            "collection_name": settings.qdrant_collection_name,
            "recent_updates": recent_items[:5],  # 최근 5개만
            "last_checked": datetime.now().isoformat()
        }
        
    except Exception as e:
        logger.error(f"Failed to get DB status: {e}")
        return {
            "status": "error",
            "error": str(e),
            "last_checked": datetime.now().isoformat()
        }