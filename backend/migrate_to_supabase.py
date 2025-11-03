"""
데이터 마이그레이션 스크립트: crawl_sites.json → Supabase DB
"""
import json
import asyncio
from pathlib import Path
from supabase_client import supabase
from datetime import time


def load_json_data():
    """Load data from crawl_sites.json"""
    json_path = Path(__file__).parent / "crawl_sites.json"
    with open(json_path, 'r', encoding='utf-8') as f:
        return json.load(f)


async def migrate_data():
    """Migrate data from JSON to Supabase"""
    print("🚀 Starting migration from crawl_sites.json to Supabase...")

    # 1. JSON 데이터 로드
    data = load_json_data()
    sites = data.get("sites", [])

    print(f"📋 Found {len(sites)} sites in crawl_sites.json")

    # 2. 기본 폴더 생성 (매일 새벽 2시)
    print("\n📁 Creating default folder...")
    folder_data = {
        "name": "기본 폴더",
        "schedule_type": "daily",
        "schedule_time": "02:00:00",
        "schedule_day": None,
        "enabled": True
    }

    # 기존 폴더 확인
    existing_folder = supabase.table("crawl_folders").select("*").eq("name", "기본 폴더").execute()

    if existing_folder.data:
        folder_id = existing_folder.data[0]["id"]
        print(f"✅ Default folder already exists (ID: {folder_id})")
    else:
        result = supabase.table("crawl_folders").insert(folder_data).execute()
        folder_id = result.data[0]["id"]
        print(f"✅ Created default folder (ID: {folder_id})")

    # 3. 사이트 데이터 마이그레이션
    print(f"\n📊 Migrating {len(sites)} sites...")

    # 기존 데이터 확인
    existing_sites = supabase.table("scheduled_crawl_sites").select("url").eq("folder_id", folder_id).execute()
    existing_urls = {site["url"] for site in existing_sites.data}

    # 새로 추가할 사이트와 업데이트할 사이트 분리
    new_sites = []
    update_sites = []

    for site in sites:
        site_data = {
            "folder_id": folder_id,
            "name": site["name"],
            "url": site["url"],
            "description": site.get("description", ""),
            "enabled": site.get("enabled", False)
        }

        if site["url"] in existing_urls:
            update_sites.append(site_data)
        else:
            new_sites.append(site_data)

    # 새 사이트 삽입
    if new_sites:
        # 배치로 삽입 (한 번에 50개씩)
        batch_size = 50
        inserted_count = 0
        for i in range(0, len(new_sites), batch_size):
            batch = new_sites[i:i + batch_size]
            try:
                supabase.table("scheduled_crawl_sites").insert(batch).execute()
                inserted_count += len(batch)
            except Exception as e:
                print(f"⚠️  Error inserting batch {i//batch_size + 1}: {e}")
                # 개별 삽입 시도
                for site in batch:
                    try:
                        supabase.table("scheduled_crawl_sites").insert([site]).execute()
                        inserted_count += 1
                    except Exception as e2:
                        print(f"   ❌ Failed to insert {site['name']}: {e2}")

        print(f"✅ Inserted {inserted_count} new sites")
    else:
        print("ℹ️  No new sites to insert")

    # 기존 사이트 업데이트
    if update_sites:
        updated_count = 0
        for site in update_sites:
            try:
                supabase.table("scheduled_crawl_sites").update({
                    "enabled": site["enabled"],
                    "name": site["name"],
                    "description": site["description"]
                }).eq("folder_id", folder_id).eq("url", site["url"]).execute()
                updated_count += 1
            except Exception as e:
                print(f"⚠️  Failed to update {site['name']}: {e}")

        print(f"✅ Updated {updated_count} existing sites")

    # 4. 마이그레이션 결과 확인
    print("\n📈 Migration Summary:")
    folders = supabase.table("crawl_folders").select("*").execute()
    print(f"   - Total folders: {len(folders.data)}")

    all_sites = supabase.table("scheduled_crawl_sites").select("*").execute()
    enabled_count = len([s for s in all_sites.data if s["enabled"]])
    print(f"   - Total sites: {len(all_sites.data)}")
    print(f"   - Enabled sites: {enabled_count}")
    print(f"   - Disabled sites: {len(all_sites.data) - enabled_count}")

    print("\n✅ Migration completed successfully!")


if __name__ == "__main__":
    asyncio.run(migrate_data())
