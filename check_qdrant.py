#!/usr/bin/env python3
import sys
import os

# Add backend to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'backend'))

from qdrant_client import QdrantClient
from config import settings
from datetime import datetime, timedelta
import pytz

KST = pytz.timezone('Asia/Seoul')

# Qdrant 클라이언트 생성
qdrant_client = QdrantClient(
    url=settings.qdrant_host,
    api_key=settings.qdrant_api_key
)

print(f"Connecting to Qdrant: {settings.qdrant_host}")
print(f"Collection: {settings.qdrant_collection_name}\n")

# 최근 10분 이내에 저장된 데이터 찾기
now = datetime.now(KST)
ten_minutes_ago = now - timedelta(minutes=10)

print(f"Looking for data updated after: {ten_minutes_ago.isoformat()}")
print("="*80)

# 모든 데이터 스크롤
all_points = []
next_offset = None

for i in range(10):  # 최대 1000개 확인
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

print(f"Checked {len(all_points)} total points\n")

# 최근 업데이트된 데이터 찾기
recent_points = []
kakao_point = None

for point in all_points:
    if point.payload:
        updated_at_str = point.payload.get("updated_at", "")
        url = point.payload.get("url", "")

        # 카카오 URL 찾기
        if "pf.kakao.com" in url:
            kakao_point = point
            print("🎯 FOUND KAKAO URL!")
            print(f"URL: {url}")
            print(f"Updated at: {updated_at_str}")
            print(f"Chunk: {point.payload.get('chunk_index', 0)}/{point.payload.get('total_chunks', 1)}")
            print(f"Text content:\n{'-'*80}")
            print(point.payload.get('text', '(no text)'))
            print(f"{'-'*80}\n")
            break

if not kakao_point:
    print("❌ Kakao URL not found in first 1000 points")
    print("\nShowing 5 most recent points instead:")
    print("="*80)

    # 시간순 정렬
    sorted_points = []
    for point in all_points[:100]:
        if point.payload:
            updated_at_str = point.payload.get("updated_at", "")
            if updated_at_str and updated_at_str != "Unknown":
                try:
                    if '+' in updated_at_str or 'Z' in updated_at_str:
                        dt = datetime.fromisoformat(updated_at_str.replace('Z', '+00:00'))
                    else:
                        dt = datetime.fromisoformat(updated_at_str)
                        if dt.tzinfo is None:
                            dt = KST.localize(dt)
                    sorted_points.append((dt, point))
                except:
                    pass

    sorted_points.sort(key=lambda x: x[0], reverse=True)

    for i, (dt, point) in enumerate(sorted_points[:5], 1):
        print(f"\n{i}. URL: {point.payload.get('url', 'Unknown')}")
        print(f"   Updated: {dt.isoformat()}")
        print(f"   Text preview: {point.payload.get('text', '')[:100]}...")
