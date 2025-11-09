"""
Pydantic models for user preferences (전공 맞춤형 검색 및 검색 모드)
"""
from pydantic import BaseModel, Field, field_validator
from typing import Optional, List


class Department(BaseModel):
    """전공/학과 정보"""
    name: str = Field(..., min_length=1, max_length=100, description="전공/학과 이름 (예: 컴퓨터공학과)")
    url: Optional[str] = Field(None, description="전공 홈페이지 URL (AI가 자동 매칭)")
    enabled: bool = Field(default=True, description="전공 검색 활성화 여부")


class UserPreferencesCreate(BaseModel):
    """사용자 설정 생성"""
    user_id: str = Field(..., min_length=1, description="사용자 ID")
    preferred_departments: List[Department] = Field(default=[], max_length=3, description="선호 전공 (최대 3개)")
    department_search_enabled: bool = Field(default=False, description="전공 맞춤형 검색 활성화")
    search_mode: str = Field(default="filter", pattern="^(filter|expand)$", description="검색 모드")

    @field_validator("preferred_departments")
    @classmethod
    def validate_departments(cls, v):
        if len(v) > 3:
            raise ValueError("최대 3개의 전공만 추가할 수 있습니다")
        return v


class UserPreferencesUpdate(BaseModel):
    """사용자 설정 업데이트"""
    preferred_departments: Optional[List[Department]] = Field(None, max_length=3)
    department_search_enabled: Optional[bool] = None
    search_mode: Optional[str] = Field(None, pattern="^(filter|expand)$")

    @field_validator("preferred_departments")
    @classmethod
    def validate_departments(cls, v):
        if v is not None and len(v) > 3:
            raise ValueError("최대 3개의 전공만 추가할 수 있습니다")
        return v


class UserPreferencesResponse(BaseModel):
    """사용자 설정 응답"""
    id: str
    user_id: str
    preferred_departments: List[Department]
    department_search_enabled: bool
    search_mode: str
    created_at: str
    updated_at: str
