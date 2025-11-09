# Retriever Project

크롤링 기반 AI 챗봇을 위한 엔드투엔드 정보 제공 파이프라인 구축

[🐶사이트 바로 가기](https://retrieverproject.duckdns.org:9443)

## 주요 기능

### 🤖 AI 챗봇 기능
- **RAG 기반 질의응답**: 벡터 DB에 저장된 학교 정보를 기반으로 정확한 답변 제공
- **전공 맞춤형 검색**: 사용자의 전공/학과 설정에 따라 관련 정보 우선 제공
- **이중 검색 모드**: 필터 모드(정확한 정보)와 확장 모드(유연한 답변) 지원
- **채팅 히스토리**: 세션별 대화 기록 저장 및 즐겨찾기 기능
- **소스 추적**: 모든 답변의 출처 URL 표시

### 🕷️ 크롤링 시스템
- **지능형 크롤링**: Playwright 기반 동적 콘텐츠 지원
- **스케줄 크롤링**: 폴더 단위로 일별/주별/월별 자동 크롤링
- **작업 큐 모니터링**: RabbitMQ 기반 실시간 크롤링 상태 확인
- **VPN 지원**: IP 차단 방지를 위한 NordVPN 통합
- **중복 방지**: 콘텐츠 해시 기반 스마트 업데이트

### 🔐 보안 및 인증
- **OAuth 로그인**: Google, Kakao 소셜 로그인 지원
- **HTTPS/SSL**: Let's Encrypt 자동 인증서 발급 및 갱신
- **세션 관리**: NextAuth 기반 안전한 사용자 세션 관리

## 시스템 아키텍처

```
┌─────────────────────────────────────────────────────┐
│                   Internet (HTTPS)                  │
└───────────────────────┬─────────────────────────────┘
                        │
                        ▼
        ┌───────────────────────────────┐
        │     Nginx Reverse Proxy       │ (9090/9443)
        │     + Let's Encrypt SSL       │
        └───────────────┬───────────────┘
                        │
            ┌───────────┴───────────┐
            │                       │
            ▼                       ▼
┌────────────────────┐     ┌────────────────────┐
│     Frontend       │     │     Backend        │
│     (Next.js)      │     │     (FastAPI)      │
│      (3000)        │     │      (8000)        │
└─────────┬──────────┘     └─────────┬──────────┘
          │                          │
          │ HTTPS API                │ HTTPS API
          │ (Rest / PostgREST)       │ (Rest / PostgREST)
          │                          │
          └──────────────┬───────────┘
                         │
                         ▼
        ┌──────────────────────────────────────┐
        │          Supabase (Cloud)            │
        │    PostgreSQL + Auth + Storage       │
        └─────────────────┬────────────────────┘
                          │
                          │  (Backend only)
                          │
           ┌──────────────┼──────────────┬──────────────┐
           │              │              │              │
           ▼              ▼              ▼              ▼
┌────────────────┐ ┌────────────────┐ ┌────────────────┐ ┌────────────────┐
│   RabbitMQ     │ │    Redis       │ │    Qdrant      │ │    Ollama      │
│ (5672 / 15672) │ │    (6379)      │ │  (6333–6334)   │ │   (11434)      │
│----------------│ │----------------│ │----------------│ │----------------│
│  Celery Queue  │ │     Cache      │ │   Vector DB    │ │ 임베딩 생성     │
│  작업 모니터링 │ │    세션 저장    │ │  임베딩 저장   │ │ bge-m3         │
└────────────────┘ └────────────────┘ └────────────────┘ └────────────────┘
           │
           ▼
┌────────────────┐
│   NordVPN      │
│   (Socks5)     │
│----------------│
│  IP 차단 방지  │
└────────────────┘
```

## 시스템 구성

### 핵심 서비스
- **Backend**: FastAPI + Celery + Playwright
- **Frontend**: Next.js 14 + TypeScript + TailwindCSS
- **Database**: Supabase (PostgreSQL + Auth + Storage)
- **Vector DB**: Qdrant (클라우드 호스팅)
- **Message Queue**: RabbitMQ + Celery
- **Cache**: Redis
- **Reverse Proxy**: Nginx + Let's Encrypt SSL
- **VPN**: NordVPN (IP 차단 방지)

### AI 모델
- **OpenAI GPT-4o-mini**: RAG 챗봇 답변 생성용 (정확한 답변 제공)
- **Ollama bge-m3** (1.2GB): 텍스트 임베딩 생성 (768차원 벡터)

### Celery 워커
- **Main Worker**: 크롤링 작업 처리 (1개 워커)
- **Embedding Worker**: 임베딩 생성 전담 (1개 워커)

## 포트 구성

### 외부 접근 가능 (0.0.0.0)

| 서비스      | 포트        | 용도                        |
|----------|-----------|---------------------------|
| Nginx    | 9090      | HTTP (HTTPS로 자동 리다이렉트)    |
| Nginx    | 9443      | HTTPS (메인 웹사이트)          |
| RabbitMQ | 5672      | AMQP 프로토콜                 |
| RabbitMQ | 15672     | Management UI             |
| Redis    | 6379      | Redis 서버                  |
| Qdrant   | 6333-6334 | Vector DB API & Dashboard |

### 내부 전용 (Docker 네트워크만)

| 서비스            | 포트   | 용도                        |
|----------------|------|---------------------------|
| Frontend       | 3000 | Next.js (nginx를 통해 외부 접근) |
| Backend API    | 8000 | FastAPI (nginx를 통해 외부 접근) |
| Celery Worker  | -    | 백그라운드 크롤링 작업자            |
| Celery Embedding | -  | 백그라운드 임베딩 작업자            |
| Ollama         | 11434 | LLM API (Docker 내부 네트워크) |
| VPN Container  | -    | NordVPN Socks5 프록시        |

## 주요 기능 상세

### 1. 전공 맞춤형 검색 🎓

사용자의 전공/학과 정보를 기반으로 관련 정보를 우선적으로 제공합니다.

#### 작동 방식

```
1. 사용자가 전공 설정 (예: 컴퓨터공학과, 수학과)
   ↓
2. 전공 정보가 자동으로 검색 쿼리에 추가
   질문: "장학금 알려줘"
   → 검색: "컴퓨터공학과 장학금 알려줘"
   ↓
3. 벡터 검색으로 관련 문서 찾기
   ↓
4. 전공 관련 문서에 2배 부스팅 적용
   - URL에 전공 이름 포함: 우선순위 ↑
   - 텍스트에 전공 이름 포함: 우선순위 ↑
   ↓
5. 부스팅된 문서를 최상위로 정렬
   ↓
6. GPT에게 사용자의 전공 정보 전달
   "이 사용자는 컴퓨터공학과입니다"
   ↓
7. 전공 특화 답변 생성
```

#### 특징
- **자동 쿼리 강화**: 사용자가 전공을 명시하지 않아도 자동으로 전공 정보 추가
- **이중 부스팅**: URL 매칭 + 텍스트 매칭으로 정확도 향상
- **유연한 매칭**: "컴퓨터공학과", "컴퓨터공학", "컴공" 등 다양한 표현 인식
- **최대 3개 전공**: 복수전공, 부전공 지원
- **Fallback 지원**: 전공 정보가 없어도 일반 정보 제공

#### 데이터베이스 구조
```sql
CREATE TABLE user_preferences (
    id UUID PRIMARY KEY,
    user_id TEXT UNIQUE,
    preferred_departments JSONB,  -- [{"name": "컴퓨터공학과", "url": null, "enabled": true}]
    department_search_enabled BOOLEAN DEFAULT false,
    search_mode TEXT DEFAULT 'filter',
    created_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ
);
```

### 2. AI 검색 모드 전환 🔍

사용 상황에 따라 검색 전략을 선택할 수 있습니다.

#### 필터 모드 (Filter Mode) - 정확한 정보

| 특성 | 설명 |
|-----|------|
| **검색 범위** | 좁음 (top_k × 2 = 10개 문서) |
| **유사도 임계값** | 높음 (0.5 이상) |
| **최소 문서 수** | 2개 이상 필수 |
| **평균 점수 검증** | 0.55 이상 필요 |
| **답변 방식** | 컨텍스트에 있는 정보만 사용 |
| **외부 지식** | 사용 금지 |
| **정보 부족 시** | "정보를 찾을 수 없습니다" 응답 |

**사용 시나리오**:
- 날짜, 시간, 연락처 등 정확한 정보가 필요한 경우
- 공식 문서 기반 답변이 필요한 경우
- 잘못된 정보 제공을 피해야 하는 경우

#### 확장 모드 (Expand Mode) - 유연한 답변

| 특성 | 설명 |
|-----|------|
| **검색 범위** | 넓음 (top_k × 3 = 15개 문서) |
| **유사도 임계값** | 낮음 (0.2 이상) |
| **Fallback 검색** | 임계값 없이 재검색 |
| **답변 방식** | 컨텍스트 + 합리적 추론 |
| **외부 지식** | 일반 대학 정보 활용 가능 |
| **추론 표시** | "일반적으로", "보통" 등으로 명시 |

**사용 시나리오**:
- 개념 설명, 배경 정보 등이 필요한 경우
- 여러 정보를 종합한 답변이 필요한 경우
- 완전한 정보가 없어도 도움이 되는 답변을 원하는 경우

#### 모드 전환 예시

```
질문: "수강신청 기간이 언제야?"

[필터 모드]
→ 정확한 날짜와 시간 제공
→ 출처: 학사일정 공지사항

[확장 모드]
→ 수강신청 기간 + 준비사항 + 주의사항
→ 출처: 학사일정 + 수강신청 안내 + 일반 정보
```

### 3. VPN 통합 (IP 차단 방지) 🛡️

크롤링 작업 시 IP 차단을 방지하기 위해 NordVPN을 통합했습니다.

#### 아키텍처

```
Celery Worker → VPN Container (NordVPN) → Internet
                  (Socks5 Proxy)
```

#### 설정 방법

```yaml
# docker-compose.prod.yml
vpn:
  image: ghcr.io/bubuntux/nordvpn
  cap_add:
    - NET_ADMIN
    - SYS_MODULE
  environment:
    - TOKEN=${NORD_TOKEN}          # NordVPN 토큰
    - CONNECT=South_Korea          # 연결 국가
    - TECHNOLOGY=NordLynx          # VPN 프로토콜
    - NETWORK=172.18.0.0/16        # Docker 네트워크
  sysctls:
    - net.ipv6.conf.all.disable_ipv6=1
```

#### 크롤링 시 VPN 사용

```python
# backend/tasks/scheduled_crawler.py
proxy = {
    "server": "socks5://vpn:1080",  # VPN 컨테이너 주소
}

browser = playwright.chromium.launch(
    headless=True,
    proxy=proxy  # VPN을 통한 크롤링
)
```

#### VPN 기능
- **자동 연결**: 컨테이너 시작 시 자동으로 VPN 연결
- **Health Check**: VPN 연결 상태 자동 확인
- **Socks5 프록시**: 1080 포트로 프록시 제공
- **국가 선택**: 환경 변수로 연결 국가 변경 가능

#### VPN 관리 명령어

```bash
# VPN 상태 확인
docker exec rag-vpn nordvpn status

# VPN 재연결
docker restart rag-vpn

# VPN 로그 확인
docker logs rag-vpn
```

### 4. 크롤링 작업 큐 모니터링 📊

RabbitMQ와 Celery를 통한 실시간 작업 모니터링을 제공합니다.

#### 모니터링 지표

**큐 상태**
- **Pending**: 대기 중인 작업 수
- **Active**: 현재 실행 중인 작업 수
- **Completed**: 완료된 작업 수
- **Failed**: 실패한 작업 수

**워커 상태**
- **Crawling Worker**: 크롤링 전담 워커 상태
- **Embedding Worker**: 임베딩 생성 전담 워커 상태
- **활성 작업**: 각 워커가 현재 처리 중인 작업
- **처리 속도**: 작업 처리량 (jobs/sec)

**시스템 통계**
- **총 처리량**: 누적 처리 작업 수
- **평균 처리 시간**: 작업당 평균 소요 시간
- **에러율**: 실패율 (%)
- **큐 깊이**: 대기 중인 작업 깊이

#### RabbitMQ Management UI

접속: `https://yourdomain.com:9443/rabbitmq/`

**주요 기능**:
- 큐별 메시지 수 실시간 확인
- 메시지 전송/수신 속도 그래프
- 연결된 워커 목록
- 메시지 라우팅 상태
- 큐 purge (전체 삭제)

#### Celery Flower (선택 사항)

Celery 작업을 시각적으로 모니터링할 수 있습니다.

```bash
# Flower 실행 (선택 사항)
docker exec -it rag-celery celery -A tasks flower --port=5555
```

접속: `http://localhost:5555`

### 5. 스케줄 크롤링 폴더 시스템 📁

관련 사이트를 폴더로 그룹화하여 서로 다른 주기로 크롤링할 수 있습니다.

#### 폴더 구조

```
📁 학식 정보 (매일 00시)
  ├─ 학생식당 메뉴
  ├─ 교직원식당 메뉴
  └─ 카페테리아 메뉴

📁 학과 정보 (매월 1일 02시)
  ├─ 컴퓨터공학과
  ├─ 수학과
  └─ 물리학과

📁 공지사항 (매주 월요일 03시)
  ├─ 학사공지
  ├─ 장학공지
  └─ 취업공지
```

#### 스케줄 타입

| 타입 | 설명 | 예시 |
|-----|------|------|
| **Daily** | 매일 지정 시간 실행 | 00:00, 12:00 등 |
| **Weekly** | 매주 지정 요일 + 시간 실행 | 월요일 03:00 |
| **Monthly** | 매월 1일 지정 시간 실행 | 매월 1일 02:00 |

#### 폴더 관리 기능

**폴더 수준**:
- 폴더 생성/수정/삭제
- 스케줄 타입 변경
- 전체 활성화/비활성화
- 즉시 실행 (⚡)

**사이트 수준**:
- 사이트 추가/수정/삭제
- 개별 활성화/비활성화
- 크롤링 깊이 설정
- 설명 추가

#### APScheduler 통합

```python
# backend/main.py
from apscheduler.schedulers.background import BackgroundScheduler

scheduler = BackgroundScheduler()

# 폴더별 스케줄 등록
for folder in enabled_folders:
    if folder.schedule_type == "daily":
        trigger = CronTrigger(hour=folder.hour, minute=folder.minute)
    elif folder.schedule_type == "weekly":
        trigger = CronTrigger(
            day_of_week=folder.schedule_day,
            hour=folder.hour,
            minute=folder.minute
        )
    elif folder.schedule_type == "monthly":
        trigger = CronTrigger(
            day=1,
            hour=folder.hour,
            minute=folder.minute
        )

    scheduler.add_job(
        func=crawl_folder_sites,
        trigger=trigger,
        id=f'crawl_folder_{folder.id}'
    )

scheduler.start()
```

#### 크롤링 통계

각 폴더/사이트별로 다음 정보를 추적합니다:
- 마지막 크롤링 시간
- 크롤링 성공/실패 횟수
- 수집된 페이지 수
- 평균 처리 시간

## 크롤링 시스템 상세

### 크롤링 프로세스

```
1. 크롤링 시작
   ↓
2. VPN을 통해 Playwright로 페이지 방문
   - JavaScript 렌더링 완료 대기
   - 동적 콘텐츠 로딩
   ↓
3. 같은 도메인 내 링크 추출
   - BFS(너비 우선 탐색) 방식
   - 방문한 URL 기록 (중복 방지)
   ↓
4. 제외 항목 필터링
   - PDF, 이미지, zip 등 바이너리 파일
   - 외부 도메인 링크
   - 쿼리 파라미터 정규화
   ↓
5. 최대 깊이까지 재귀적 탐색
   - 기본 깊이: 2단계
   - 타임아웃: 30초/페이지
   ↓
6. 수집된 URL을 임베딩 작업 큐에 추가
   - 배치 크기: 50개 URL
   - RabbitMQ를 통한 비동기 처리
   ↓
7. Embedding Worker가 각 URL 처리
   ├─ 텍스트 추출 (BeautifulSoup)
   ├─ 텍스트 청킹 (1000자 단위, 100자 오버랩)
   ├─ 임베딩 생성 (Ollama BGE-M3, 768차원)
   └─ Qdrant에 저장
   ↓
8. 중복 감지 및 업데이트
   - MD5 해시로 콘텐츠 변경 감지
   - 변경된 경우만 업데이트
```

### 텍스트 추출

HTML에서 불필요한 요소를 제거하고 실제 콘텐츠만 추출합니다.

**추출 전 (HTML)**:
```html
<div class="content">
  <h1>수강신청 안내</h1>
  <nav>메뉴1 메뉴2 메뉴3</nav>
  <p>2025학년도 1학기 수강신청 일정은...</p>
  <footer>© 2025 University</footer>
</div>
```

**추출 후 (텍스트)**:
```
수강신청 안내

2025학년도 1학기 수강신청 일정은...
```

**추출 과정**:
1. BeautifulSoup로 HTML 파싱
2. 불필요한 요소 제거 (nav, footer, script, style 등)
3. main, article 등 주요 콘텐츠 영역 식별
4. 텍스트만 추출하여 정리
5. 과도한 공백 제거 및 정규화

### 임베딩 및 벡터 저장

**임베딩 모델**: BGE-M3 (BAAI)
- 다국어 지원 (한국어, 영어, 중국어 등)
- 768차원 dense 벡터
- 최대 8192 토큰

**청킹 전략**:
```python
from langchain.text_splitter import RecursiveCharacterTextSplitter

text_splitter = RecursiveCharacterTextSplitter(
    chunk_size=1000,      # 청크당 1000자
    chunk_overlap=100,    # 100자 오버랩
    separators=["\n\n", "\n", ". ", " ", ""]
)
```

**Qdrant 저장**:
```python
# 벡터 포인트 구조
{
    "id": "uuid",
    "vector": [0.1, 0.2, ...],  # 768차원
    "payload": {
        "url": "https://...",
        "text": "청크 내용",
        "chunk_index": 0,
        "content_hash": "md5_hash",
        "crawled_at": "2025-01-10T..."
    }
}
```

### 중복 감지 및 업데이트

```python
# 1. 콘텐츠 해시 생성
content_hash = hashlib.md5(markdown_content.encode()).hexdigest()

# 2. 기존 해시 조회
existing = qdrant_client.scroll(
    collection_name="school_docs",
    scroll_filter={
        "must": [{"key": "url", "match": {"value": url}}]
    },
    limit=1
)

# 3. 해시 비교
if existing and existing[0].payload["content_hash"] == content_hash:
    # 변경 없음 → 스킵
    return
else:
    # 변경 감지 → 기존 삭제 후 재저장
    qdrant_client.delete(...)
    qdrant_client.upsert(...)
```

## Supabase 데이터베이스 설정

### 테이블 구조

#### 1. 채팅 시스템

**chat_sessions** - 채팅 세션
```sql
CREATE TABLE chat_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id TEXT NOT NULL,
    title TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

**chat_history** - 메시지 히스토리
```sql
CREATE TABLE chat_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id TEXT NOT NULL,
    session_id UUID REFERENCES chat_sessions(id) ON DELETE CASCADE,
    message TEXT NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
    sources JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
```

**favorites** - 즐겨찾기
```sql
CREATE TABLE favorites (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id TEXT NOT NULL,
    session_id UUID REFERENCES chat_sessions(id) ON DELETE CASCADE,
    message_id UUID REFERENCES chat_history(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
```

#### 2. 크롤링 시스템

**crawl_folders** - 스케줄 폴더
```sql
CREATE TABLE crawl_folders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT UNIQUE NOT NULL,
    schedule_type TEXT NOT NULL CHECK (schedule_type IN ('daily', 'weekly', 'monthly')),
    schedule_time TIME NOT NULL,
    schedule_day INTEGER CHECK (schedule_day BETWEEN 0 AND 6),
    enabled BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

**scheduled_crawl_sites** - 크롤링 사이트
```sql
CREATE TABLE scheduled_crawl_sites (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    folder_id UUID REFERENCES crawl_folders(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    url TEXT NOT NULL,
    description TEXT,
    enabled BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(folder_id, url)
);
```

#### 3. 사용자 설정

**user_preferences** - 전공 맞춤형 검색 설정
```sql
CREATE TABLE user_preferences (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id TEXT UNIQUE NOT NULL,
    preferred_departments JSONB DEFAULT '[]'::jsonb,
    department_search_enabled BOOLEAN DEFAULT false,
    search_mode TEXT DEFAULT 'filter' CHECK (search_mode IN ('filter', 'expand')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

### 자동 업데이트 트리거

```sql
-- updated_at 자동 갱신 함수
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- 트리거 적용
CREATE TRIGGER update_chat_sessions_updated_at
    BEFORE UPDATE ON chat_sessions
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- 다른 테이블에도 동일하게 적용...
```

## 시작하기

### 1. 프로젝트 클론

```bash
git clone https://github.com/his0si/retriever-project.git
cd retriever-project
```

### 2. Supabase 설정

1. [Supabase](https://supabase.com)에서 프로젝트 생성
2. SQL 에디터에서 `supabase_tables.sql` 실행
3. API 키 복사:
   - Project Settings → API
   - `SUPABASE_URL` 및 `SUPABASE_ANON_KEY`

### 3. 환경 변수 설정

`.env` 파일 생성:

```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL=your-supabase-url
NEXT_PUBLIC_SUPABASE_KEY=your-supabase-anon-key
SUPABASE_URL=your-supabase-url
SUPABASE_KEY=your-supabase-anon-key

# Qdrant (클라우드)
QDRANT_HOST=https://your-cluster.qdrant.io
QDRANT_API_KEY=your-qdrant-api-key

# OpenAI (챗봇 답변 생성용)
OPENAI_API_KEY=your-openai-api-key

# Ollama (임베딩 전용)
OLLAMA_HOST=http://ollama:11434
OLLAMA_MODEL=qwen2.5:7b
OLLAMA_EMBEDDING_MODEL=bge-m3

# NextAuth
NEXTAUTH_URL=https://yourdomain.com:9443
NEXTAUTH_SECRET=$(openssl rand -base64 32)

# OAuth
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret
KAKAO_CLIENT_ID=your-kakao-client-id
KAKAO_CLIENT_SECRET=your-kakao-client-secret

# NordVPN (선택 사항)
NORD_TOKEN=your-nordvpn-token

# Domain
DOMAIN_NAME=yourdomain.com
```

### 4. Docker Compose 실행

```bash
# SSL 인증서 발급
chmod +x setup-ssl.sh && ./setup-ssl.sh

# 모든 서비스 시작
docker compose -f docker-compose.prod.yml up -d

# Ollama 모델 초기화 (필수!)
./scripts/init-ollama.sh
```

### 5. 접속

- 웹사이트: https://yourdomain.com:9443
- API 문서: https://yourdomain.com:9443/backend/docs
- RabbitMQ UI: https://yourdomain.com:9443/rabbitmq/

## 로컬 개발

```bash
# 개발 모드 실행
docker compose --env-file .env.local -f docker-compose.dev.yml up -d

# 접속
open http://localhost
```

## API 사용법

### 크롤링 시작

```bash
curl -X POST https://yourdomain.com:9443/backend/crawl \
  -H "Content-Type: application/json" \
  -d '{
    "root_url": "https://cs.ewha.ac.kr",
    "max_depth": 2
  }'
```

### 질문하기 (기본)

```bash
curl -X POST https://yourdomain.com:9443/backend/chat \
  -H "Content-Type: application/json" \
  -d '{
    "question": "수강신청 기간은?",
    "mode": "filter",
    "user_id": "anonymous"
  }'
```

### 질문하기 (전공 맞춤형)

```bash
# 1. 사용자 전공 설정
curl -X POST https://yourdomain.com:9443/backend/user-preferences \
  -H "Content-Type: application/json" \
  -d '{
    "user_id": "student@ewha.ac.kr",
    "preferred_departments": [
      {"name": "컴퓨터공학과", "enabled": true},
      {"name": "수학과", "enabled": true}
    ],
    "department_search_enabled": true,
    "search_mode": "filter"
  }'

# 2. 전공 맞춤형 검색으로 질문
curl -X POST https://yourdomain.com:9443/backend/chat \
  -H "Content-Type: application/json" \
  -d '{
    "question": "장학금 정보 알려줘",
    "mode": "filter",
    "user_id": "student@ewha.ac.kr"
  }'
```

### 스케줄 크롤링 폴더 생성

```bash
curl -X POST https://yourdomain.com:9443/backend/crawl/folders \
  -H "Content-Type: application/json" \
  -d '{
    "name": "학식 정보",
    "schedule_type": "daily",
    "schedule_time": "00:00:00",
    "enabled": true
  }'
```

## 모니터링 및 관리

### 컨테이너 상태 확인

```bash
# 모든 컨테이너 상태
docker ps --filter "name=rag-"

# 특정 컨테이너 로그
docker logs rag-api --tail 100 -f
docker logs rag-celery --tail 100 -f
docker logs rag-celery-embedding --tail 100 -f
```

### Celery 작업 모니터링

```bash
# 큐 상태 확인
curl https://yourdomain.com:9443/backend/crawl/queue/status

# RabbitMQ Management UI
open https://yourdomain.com:9443/rabbitmq/
```

### VPN 상태 확인

```bash
# VPN 연결 상태
docker exec rag-vpn nordvpn status

# VPN 로그
docker logs rag-vpn --tail 50
```

### 데이터베이스 관리

```bash
# Qdrant 대시보드
open http://yourdomain.com:6333/dashboard

# Supabase 대시보드
open https://app.supabase.com
```

## 문제 해결

### 1. Ollama 모델 로딩 실패

```bash
# 모델 재다운로드
./scripts/init-ollama.sh

# Ollama 재시작
docker restart rag-ollama
```

### 2. 크롤링 작업 stuck

```bash
# 큐 전체 삭제
curl -X POST https://yourdomain.com:9443/backend/crawl/queue/purge

# Celery 워커 재시작
docker restart rag-celery rag-celery-embedding
```

### 3. VPN 연결 실패

```bash
# VPN 재시작
docker restart rag-vpn

# 토큰 확인
docker exec rag-vpn printenv | grep NORD_TOKEN
```

### 4. SSL 인증서 갱신 실패

```bash
# 수동 갱신
docker exec rag-nginx certbot renew

# Nginx 재시작
docker restart rag-nginx
```

## 성능 최적화

### 1. 크롤링 속도 향상

```python
# backend/tasks/crawler.py
MAX_CONCURRENT_PAGES = 10  # 동시 크롤링 페이지 수
BATCH_SIZE = 100           # 배치 크기 증가
```

### 2. 임베딩 속도 향상

```bash
# GPU 메모리 확인
nvidia-smi

# Ollama GPU 사용률 확인
docker exec rag-ollama nvidia-smi
```

### 3. Redis 캐싱

```python
# 검색 결과 캐싱 (30분)
cache_key = f"search:{query_hash}"
cached = redis.get(cache_key)
if cached:
    return json.loads(cached)
```

## 보안 고려사항

### 1. 인증 및 권한

- OAuth 2.0 기반 소셜 로그인
- JWT 토큰 기반 세션 관리
- HTTPS 강제 사용

### 2. 데이터 보호

- 사용자 데이터 암호화 (Supabase)
- API 키 환경 변수 관리
- CORS 정책 적용

### 3. Rate Limiting

```python
# backend/main.py
from slowapi import Limiter

limiter = Limiter(key_func=get_remote_address)

@app.post("/chat")
@limiter.limit("10/minute")  # 분당 10회 제한
async def chat(request: ChatRequest):
    ...
```

## 라이선스

MIT License
