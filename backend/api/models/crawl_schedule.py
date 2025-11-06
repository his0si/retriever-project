"""
Pydantic models for scheduled crawling
"""
from pydantic import BaseModel, Field, field_validator
from typing import Optional
from datetime import time
from uuid import UUID


class CrawlFolderCreate(BaseModel):
    """Create a new crawl folder"""
    name: str = Field(..., min_length=1, max_length=100, description="Folder name")
    schedule_type: str = Field(..., pattern="^(daily|weekly|monthly)$", description="Schedule type")
    schedule_time: str = Field(..., pattern="^([01]?[0-9]|2[0-3]):[0-5][0-9](:[0-5][0-9])?$", description="Schedule time (HH:MM or HH:MM:SS)")
    schedule_day: Optional[int] = Field(None, ge=0, le=6, description="Day of week (0=Sunday, 6=Saturday)")
    max_depth: int = Field(default=2, ge=1, le=5, description="Maximum crawl depth (1-5)")
    enabled: bool = Field(default=True, description="Whether the folder is enabled")

    @field_validator("schedule_day")
    @classmethod
    def validate_schedule_day(cls, v, info):
        """Validate schedule_day based on schedule_type"""
        schedule_type = info.data.get("schedule_type")
        if schedule_type == "weekly" and v is None:
            raise ValueError("schedule_day is required for weekly schedule")
        if schedule_type != "weekly" and v is not None:
            raise ValueError("schedule_day should only be set for weekly schedule")
        return v


class CrawlFolderUpdate(BaseModel):
    """Update an existing crawl folder"""
    name: Optional[str] = Field(None, min_length=1, max_length=100)
    schedule_type: Optional[str] = Field(None, pattern="^(daily|weekly|monthly)$")
    schedule_time: Optional[str] = Field(None, pattern="^([01]?[0-9]|2[0-3]):[0-5][0-9](:[0-5][0-9])?$")
    schedule_day: Optional[int] = Field(None, ge=0, le=6)
    max_depth: Optional[int] = Field(None, ge=1, le=5)
    enabled: Optional[bool] = None


class CrawlFolderResponse(BaseModel):
    """Response model for crawl folder"""
    id: str
    name: str
    schedule_type: str
    schedule_time: str
    schedule_day: Optional[int]
    max_depth: int = 2  # Default value for backward compatibility
    enabled: bool
    created_at: str
    updated_at: str


class ScheduledCrawlSiteCreate(BaseModel):
    """Create a new scheduled crawl site"""
    folder_id: str = Field(..., description="Folder UUID")
    name: str = Field(..., min_length=1, max_length=200, description="Site name")
    url: str = Field(..., pattern="^https?://", description="Site URL")
    description: Optional[str] = Field(None, max_length=500, description="Site description")
    enabled: bool = Field(default=True, description="Whether the site is enabled")


class ScheduledCrawlSiteUpdate(BaseModel):
    """Update an existing scheduled crawl site"""
    name: Optional[str] = Field(None, min_length=1, max_length=200)
    url: Optional[str] = Field(None, pattern="^https?://")
    description: Optional[str] = Field(None, max_length=500)
    enabled: Optional[bool] = None


class ScheduledCrawlSiteResponse(BaseModel):
    """Response model for scheduled crawl site"""
    id: str
    folder_id: str
    name: str
    url: str
    description: Optional[str]
    enabled: bool
    created_at: str
    updated_at: str


class FolderWithSitesResponse(BaseModel):
    """Response model for folder with its sites"""
    id: str
    name: str
    schedule_type: str
    schedule_time: str
    schedule_day: Optional[int]
    max_depth: int = 2  # Default value for backward compatibility
    enabled: bool
    created_at: str
    updated_at: str
    sites: list[ScheduledCrawlSiteResponse]
