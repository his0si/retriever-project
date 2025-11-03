"""
Supabase client for backend
"""
import os
from supabase import create_client, Client
from typing import Optional

# Supabase 설정
SUPABASE_URL = os.getenv(
    "SUPABASE_URL",
    "https://thdzecaimafgzkkgprqq.supabase.co"
)
SUPABASE_KEY = os.getenv(
    "SUPABASE_KEY",
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRoZHplY2FpbWFmZ3pra2dwcnFxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTI1OTUxNjIsImV4cCI6MjA2ODE3MTE2Mn0.thF-qvy4LNxKPQxa2eZwT8yU5DJMqLsSPZOqoPLh9XA"
)

# Supabase 클라이언트 생성
_supabase_client: Optional[Client] = None


def get_supabase_client() -> Client:
    """Get or create Supabase client (Singleton pattern)"""
    global _supabase_client
    if _supabase_client is None:
        _supabase_client = create_client(SUPABASE_URL, SUPABASE_KEY)
    return _supabase_client


# 편의를 위한 전역 클라이언트
supabase: Client = get_supabase_client()
