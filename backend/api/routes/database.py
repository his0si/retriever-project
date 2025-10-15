from fastapi import APIRouter, HTTPException
from qdrant_client import QdrantClient
from datetime import datetime
import pytz
from config import settings
import structlog

logger = structlog.get_logger()
router = APIRouter()

# 한국 시간대 설정
KST = pytz.timezone('Asia/Seoul')

def get_kst_now():
    """한국 시간으로 현재 시간 반환"""
    return datetime.now(KST)


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
            # 여러 번 scroll해서 더 많은 데이터 수집
            all_points = []
            next_offset = None
            
            # 최대 1000개까지 가져오기 (10번 * 100개)
            for _ in range(10):
                scroll_result = qdrant_client.scroll(
                    collection_name=settings.qdrant_collection_name,
                    limit=100,
                    offset=next_offset,
                    with_payload=True,
                    with_vectors=False
                )
                points, next_offset = scroll_result
                all_points.extend(points)
                
                if next_offset is None or len(all_points) >= 1000:
                    break
            
            recent_data = all_points
            
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
                    return (1, datetime.min)  # Unknown은 맨 뒤로
                try:
                    # 시간 문자열을 datetime으로 파싱해서 정렬
                    dt_str = x["updated_at"]
                    # 시간대 정보 처리
                    if '+' in dt_str or 'Z' in dt_str:
                        dt = datetime.fromisoformat(dt_str.replace('Z', '+00:00'))
                    else:
                        # naive datetime은 KST로 가정
                        dt = datetime.fromisoformat(dt_str)
                        if dt.tzinfo is None:
                            dt = KST.localize(dt)
                    return (0, dt.timestamp())  # timestamp로 비교
                except Exception as e:
                    logger.debug(f"Failed to parse date {x['updated_at']}: {e}")
                    return (1, datetime.min.timestamp())  # 파싱 실패시 뒤로
                    
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
            "last_checked": get_kst_now().isoformat()
        }
        
    except Exception as e:
        logger.error(f"Failed to get DB status: {e}")
        return {
            "status": "error",
            "error": str(e),
            "last_checked": get_kst_now().isoformat()
        }


@router.get("/search-url")
async def search_url(url: str):
    """Search if a URL exists in the database using efficient filtering"""
    try:
        if not url:
            return {
                "error": "URL is required",
                "found": False
            }
        
        # URL 정규화 (trailing slash 제거 등)
        normalized_url = url.rstrip('/')
        
        # Qdrant 클라이언트 생성
        qdrant_client = QdrantClient(
            url=settings.qdrant_host,
            api_key=settings.qdrant_api_key
        )
        
        logger.info(f"🔍 Searching for URL: {normalized_url}")
        
        # 효율적인 필터링을 사용하여 검색
        found_urls = []
        total_checked = 0
        
        try:
            # URL로 시작하는 모든 문서를 효율적으로 검색
            scroll_result = qdrant_client.scroll(
                collection_name=settings.qdrant_collection_name,
                scroll_filter={
                    "must": [
                        {
                            "key": "url",
                            "match": {
                                "text": normalized_url
                            }
                        }
                    ]
                },
                limit=100,  # 충분한 수의 결과를 가져옴
                with_payload=True,
                with_vectors=False
            )
            
            points, _ = scroll_result
            total_checked = len(points)
            
            # 결과 처리
            for point in points:
                if point.payload and 'url' in point.payload:
                    doc_url = point.payload['url']
                    # URL이 입력된 URL로 시작하는지 확인 (추가 검증)
                    if doc_url.startswith(normalized_url):
                        found_item = {
                            "url": doc_url,
                            "updated_at": point.payload.get('updated_at', 'Unknown'),
                            "chunk_index": point.payload.get('chunk_index', 0),
                            "total_chunks": point.payload.get('total_chunks', 1)
                        }
                        
                        # 중복 제거 (같은 URL의 다른 청크는 한 번만 표시)
                        if not any(item['url'] == doc_url for item in found_urls):
                            found_urls.append(found_item)
                            logger.info(f"✅ Found matching URL: {doc_url}")
            
            logger.info(f"🔍 Efficient search complete. Found {len(found_urls)} matching URLs out of {total_checked} checked")
            
        except Exception as filter_error:
            logger.warning(f"Filter search failed, falling back to full scan: {filter_error}")
            # 필터 검색이 실패하면 기존 방식으로 폴백
            found_urls = []
            total_checked = 0
            next_offset = None
            
            while True:
                scroll_result = qdrant_client.scroll(
                    collection_name=settings.qdrant_collection_name,
                    limit=100,
                    offset=next_offset,
                    with_payload=True,
                    with_vectors=False
                )
                
                points, next_offset = scroll_result
                
                for point in points:
                    total_checked += 1
                    if point.payload and 'url' in point.payload:
                        doc_url = point.payload['url']
                        if doc_url.startswith(normalized_url):
                            found_item = {
                                "url": doc_url,
                                "updated_at": point.payload.get('updated_at', 'Unknown'),
                                "chunk_index": point.payload.get('chunk_index', 0),
                                "total_chunks": point.payload.get('total_chunks', 1)
                            }
                            
                            if not any(item['url'] == doc_url for item in found_urls):
                                found_urls.append(found_item)
                                logger.info(f"✅ Found matching URL: {doc_url}")
                
                if next_offset is None or total_checked >= 1000:
                    break
        
        # 시간순 정렬 (최신 먼저)
        def sort_key(x):
            if x["updated_at"] == "Unknown":
                return datetime.min.timestamp()
            try:
                dt_str = x["updated_at"]
                if '+' in dt_str or 'Z' in dt_str:
                    dt = datetime.fromisoformat(dt_str.replace('Z', '+00:00'))
                else:
                    dt = datetime.fromisoformat(dt_str)
                    if dt.tzinfo is None:
                        dt = KST.localize(dt)
                return dt.timestamp()
            except:
                return datetime.min.timestamp()
        
        found_urls.sort(key=sort_key, reverse=True)
        
        # 최대 20개까지만 반환
        found_urls = found_urls[:20]
        
        return {
            "search_url": normalized_url,
            "found": len(found_urls) > 0,
            "count": len(found_urls),
            "total_checked": total_checked,
            "matching_urls": found_urls,
            "checked_at": get_kst_now().isoformat()
        }
        
    except Exception as e:
        logger.error(f"Failed to search URL: {e}")
        return {
            "error": str(e),
            "found": False,
            "checked_at": get_kst_now().isoformat()
        }