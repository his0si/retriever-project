from fastapi import APIRouter, HTTPException
from api.models.user_preferences import (
    UserPreferencesCreate,
    UserPreferencesUpdate,
    UserPreferencesResponse,
    Department
)
from supabase_client import supabase
from services.department_matcher import DepartmentMatcher
import structlog
import json

router = APIRouter(prefix="/user-preferences", tags=["user-preferences"])
logger = structlog.get_logger()

# Initialize department matcher service
department_matcher = DepartmentMatcher()


@router.get("/{user_id}", response_model=UserPreferencesResponse)
async def get_user_preferences(user_id: str):
    """사용자 설정 조회"""
    try:
        response = supabase.table("user_preferences").select("*").eq("user_id", user_id).execute()

        if not response.data or len(response.data) == 0:
            # 기본 설정 반환
            raise HTTPException(status_code=404, detail="사용자 설정을 찾을 수 없습니다")

        data = response.data[0]

        return UserPreferencesResponse(
            id=str(data["id"]),
            user_id=data["user_id"],
            preferred_departments=data.get("preferred_departments", []),
            department_search_enabled=data.get("department_search_enabled", False),
            search_mode=data.get("search_mode", "filter"),
            created_at=str(data["created_at"]),
            updated_at=str(data["updated_at"])
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error("사용자 설정 조회 실패", user_id=user_id, error=str(e))
        raise HTTPException(status_code=500, detail="사용자 설정 조회 중 오류가 발생했습니다")


@router.post("", response_model=UserPreferencesResponse)
async def create_user_preferences(preferences: UserPreferencesCreate):
    """사용자 설정 생성"""
    try:
        logger.info("사용자 설정 생성 시작", user_id=preferences.user_id, departments=len(preferences.preferred_departments))

        # AI를 사용하여 전공 이름을 URL로 매칭
        departments_with_urls = []
        for dept in preferences.preferred_departments:
            logger.info("전공 매칭 시도", department_name=dept.name)

            # AI matching with timeout handling
            try:
                matched_url = await department_matcher.match_department_to_url(dept.name)
                logger.info("전공 매칭 완료", department_name=dept.name, url=matched_url)
            except Exception as e:
                logger.error("전공 매칭 실패, None으로 저장", department_name=dept.name, error=str(e))
                matched_url = None

            departments_with_urls.append({
                "name": dept.name,
                "url": matched_url,
                "enabled": dept.enabled
            })

        # DB에 저장
        data = {
            "user_id": preferences.user_id,
            "preferred_departments": departments_with_urls,
            "department_search_enabled": preferences.department_search_enabled,
            "search_mode": preferences.search_mode
        }

        response = supabase.table("user_preferences").insert(data).execute()

        if not response.data:
            raise HTTPException(status_code=500, detail="사용자 설정 생성 실패")

        created = response.data[0]

        logger.info("사용자 설정 생성 완료", user_id=preferences.user_id)

        return UserPreferencesResponse(
            id=str(created["id"]),
            user_id=created["user_id"],
            preferred_departments=created["preferred_departments"],
            department_search_enabled=created["department_search_enabled"],
            search_mode=created["search_mode"],
            created_at=str(created["created_at"]),
            updated_at=str(created["updated_at"])
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error("사용자 설정 생성 실패", error=str(e))
        raise HTTPException(status_code=500, detail="사용자 설정 생성 중 오류가 발생했습니다")


@router.put("/{user_id}", response_model=UserPreferencesResponse)
async def update_user_preferences(user_id: str, preferences: UserPreferencesUpdate):
    """사용자 설정 업데이트"""
    try:
        # 기존 설정 확인
        existing = supabase.table("user_preferences").select("*").eq("user_id", user_id).execute()

        if not existing.data or len(existing.data) == 0:
            raise HTTPException(status_code=404, detail="사용자 설정을 찾을 수 없습니다")

        update_data = {}

        # preferred_departments 업데이트
        if preferences.preferred_departments is not None:
            departments_with_urls = []
            for dept in preferences.preferred_departments:
                logger.info("전공 업데이트 처리", department_name=dept.name, has_url=bool(dept.url))

                # URL이 없으면 AI로 매칭
                if not dept.url:
                    try:
                        matched_url = await department_matcher.match_department_to_url(dept.name)
                        logger.info("전공 매칭 완료", department_name=dept.name, url=matched_url)
                    except Exception as e:
                        logger.error("전공 매칭 실패, None으로 저장", department_name=dept.name, error=str(e))
                        matched_url = None
                else:
                    matched_url = dept.url

                departments_with_urls.append({
                    "name": dept.name,
                    "url": matched_url,
                    "enabled": dept.enabled
                })
            update_data["preferred_departments"] = departments_with_urls

        # department_search_enabled 업데이트
        if preferences.department_search_enabled is not None:
            update_data["department_search_enabled"] = preferences.department_search_enabled

        # search_mode 업데이트
        if preferences.search_mode is not None:
            update_data["search_mode"] = preferences.search_mode

        # DB 업데이트
        response = supabase.table("user_preferences").update(update_data).eq("user_id", user_id).execute()

        if not response.data:
            raise HTTPException(status_code=500, detail="사용자 설정 업데이트 실패")

        updated = response.data[0]

        logger.info("사용자 설정 업데이트 완료", user_id=user_id)

        return UserPreferencesResponse(
            id=str(updated["id"]),
            user_id=updated["user_id"],
            preferred_departments=updated["preferred_departments"],
            department_search_enabled=updated["department_search_enabled"],
            search_mode=updated["search_mode"],
            created_at=str(updated["created_at"]),
            updated_at=str(updated["updated_at"])
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error("사용자 설정 업데이트 실패", user_id=user_id, error=str(e))
        raise HTTPException(status_code=500, detail="사용자 설정 업데이트 중 오류가 발생했습니다")


@router.delete("/{user_id}")
async def delete_user_preferences(user_id: str):
    """사용자 설정 삭제"""
    try:
        response = supabase.table("user_preferences").delete().eq("user_id", user_id).execute()

        logger.info("사용자 설정 삭제 완료", user_id=user_id)

        return {"message": "사용자 설정이 삭제되었습니다"}

    except Exception as e:
        logger.error("사용자 설정 삭제 실패", user_id=user_id, error=str(e))
        raise HTTPException(status_code=500, detail="사용자 설정 삭제 중 오류가 발생했습니다")
