-- ============================================================================
-- Supabase 테이블 생성 스크립트
-- RAG Chatbot 시스템에서 사용하는 모든 테이블 정의
-- ============================================================================

-- ============================================================================
-- 1. 채팅 세션 관리 테이블
-- ============================================================================

-- 1-1. 채팅 세션 테이블
CREATE TABLE IF NOT EXISTS chat_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id TEXT NOT NULL,
    title TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 1-2. 채팅 히스토리 테이블
CREATE TABLE IF NOT EXISTS chat_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id TEXT NOT NULL,
    session_id UUID NOT NULL REFERENCES chat_sessions(id) ON DELETE CASCADE,
    message TEXT NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
    sources JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 1-3. 즐겨찾기 테이블
CREATE TABLE IF NOT EXISTS favorites (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id TEXT NOT NULL,
    session_id UUID REFERENCES chat_sessions(id) ON DELETE CASCADE,
    message_id UUID REFERENCES chat_history(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, session_id, message_id)
);

-- 1-4. 채팅 테이블 인덱스 생성 (성능 최적화)
CREATE INDEX IF NOT EXISTS idx_chat_sessions_user_id ON chat_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_chat_sessions_created_at ON chat_sessions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_chat_history_session_id ON chat_history(session_id);
CREATE INDEX IF NOT EXISTS idx_chat_history_created_at ON chat_history(created_at);
CREATE INDEX IF NOT EXISTS idx_favorites_user_id ON favorites(user_id);
CREATE INDEX IF NOT EXISTS idx_favorites_session_id ON favorites(session_id);
CREATE INDEX IF NOT EXISTS idx_favorites_message_id ON favorites(message_id);

-- ============================================================================
-- 2. 스케줄 크롤링 시스템 테이블
-- ============================================================================

-- 2-1. 크롤링 폴더 테이블
CREATE TABLE IF NOT EXISTS crawl_folders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL UNIQUE,
    schedule_type TEXT NOT NULL CHECK (schedule_type IN ('daily', 'weekly', 'monthly')),
    schedule_time TIME NOT NULL,
    schedule_day INTEGER CHECK (schedule_day IS NULL OR (schedule_day >= 0 AND schedule_day <= 6)),
    enabled BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2-2. 스케줄된 크롤링 사이트 테이블
CREATE TABLE IF NOT EXISTS scheduled_crawl_sites (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    folder_id UUID NOT NULL REFERENCES crawl_folders(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    url TEXT NOT NULL,
    description TEXT,
    enabled BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(folder_id, url)
);

-- 2-3. 크롤링 테이블 인덱스 생성 (성능 최적화)
CREATE INDEX IF NOT EXISTS idx_crawl_folders_enabled ON crawl_folders(enabled);
CREATE INDEX IF NOT EXISTS idx_scheduled_crawl_sites_folder_id ON scheduled_crawl_sites(folder_id);
CREATE INDEX IF NOT EXISTS idx_scheduled_crawl_sites_enabled ON scheduled_crawl_sites(enabled);

-- ============================================================================
-- 3. 트리거 함수 및 설정
-- ============================================================================

-- 3-1. updated_at 자동 업데이트 트리거 함수
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 3-2. updated_at 트리거 설정 (chat_sessions)
DROP TRIGGER IF EXISTS update_chat_sessions_updated_at ON chat_sessions;
CREATE TRIGGER update_chat_sessions_updated_at
    BEFORE UPDATE ON chat_sessions
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- 3-3. updated_at 트리거 설정 (crawl_folders)
DROP TRIGGER IF EXISTS update_crawl_folders_updated_at ON crawl_folders;
CREATE TRIGGER update_crawl_folders_updated_at
    BEFORE UPDATE ON crawl_folders
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- 3-4. updated_at 트리거 설정 (scheduled_crawl_sites)
DROP TRIGGER IF EXISTS update_scheduled_crawl_sites_updated_at ON scheduled_crawl_sites;
CREATE TRIGGER update_scheduled_crawl_sites_updated_at
    BEFORE UPDATE ON scheduled_crawl_sites
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- 4. 초기 데이터 삽입
-- ============================================================================

-- 4-1. 기본 크롤링 폴더 생성 (매일 새벽 2시)
INSERT INTO crawl_folders (name, schedule_type, schedule_time, schedule_day, enabled)
VALUES ('기본 폴더', 'daily', '02:00:00', NULL, true)
ON CONFLICT (name) DO NOTHING;

-- ============================================================================
-- 5. 테이블 생성 확인
-- ============================================================================

SELECT 'chat_sessions 테이블 생성 완료' AS status;
SELECT 'chat_history 테이블 생성 완료' AS status;
SELECT 'favorites 테이블 생성 완료' AS status;
SELECT 'crawl_folders 테이블 생성 완료' AS status;
SELECT 'scheduled_crawl_sites 테이블 생성 완료' AS status;
