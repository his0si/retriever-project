# retriever project

학교 웹사이트의 분산된 정보를 자동으로 크롤링하고, RAG(Retrieval-Augmented Generation) 기반 챗봇을 제공합니다.

[🐶사이트 바로 가기](https://retrieverproject.duckdns.org:9443)

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
        │         PostgreSQL + Auth            │          
        └─────────────────┬────────────────────┘
                          │
                          │  (Backend only)
                          │
           ┌──────────────┼──────────────┐
           │              │              │
           ▼              ▼              ▼
┌────────────────┐ ┌────────────────┐ ┌────────────────┐
│   RabbitMQ     │ │    Redis       │ │    Qdrant      │
│ (5672 / 15672) │ │    (6379)      │ │  (6333–6334)   │
│----------------│ │----------------│ │----------------│
│  Celery Queue  │ │     Cache      │ │   Vector DB    │
└────────────────┘ └────────────────┘ └────────────────┘


           ┌──────────────┼──────────────┐
           │              │              │
           ▼              ▼              ▼
┌────────────────┐ ┌────────────────┐ ┌────────────────┐
│     Ollama     │ │   RabbitMQ     │ │    Redis       │
│   (11434)      │ │ (5672 / 15672) │ │    (6379)      │
│----------------│ │----------------│ │----------------│
│ GPU 가속 LLM    │ │  Celery Queue  │ │     Cache      │
│ qwen2.5:7b     │ └────────────────┘ └────────────────┘
│ bge-m3         │
└────────────────┘

```

## 시스템 구성

- **Backend**: FastAPI + Celery + Playwright
- **Vector DB**: Qdrant (클라우드 호스팅)
- **Message Queue**: RabbitMQ
- **Cache**: Redis
- **Frontend**: Next.js + Supabase
- **LLM**: Ollama (Docker 컨테이너, GPU 가속)
  - **qwen2.5:7b** (4.7GB): RAG 질의응답용 메인 LLM
  - **bge-m3** (1.2GB): 텍스트 임베딩 생성
- **Reverse Proxy**: Nginx + Let's Encrypt SSL
- **Database**: Supabase (채팅 히스토리, 즐겨찾기, 스케줄 크롤링 관리)

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

| 서비스         | 포트   | 용도                        |
|-------------|------|---------------------------|
| Frontend    | 3000 | Next.js (nginx를 통해 외부 접근) |
| Backend API | 8000 | FastAPI (nginx를 통해 외부 접근) |
| Celery      | -    | 백그라운드 작업자                 |

| Ollama   | 11434 | LLM API (Docker 내부 네트워크)         |

## Ollama 기반 LLM 아키텍처

이 프로젝트는 **Ollama**를 Docker 컨테이너로 실행하여 GPU 가속 LLM을 사용합니다.

### 아키텍처 특징

#### Docker 컨테이너 내부 실행 (GPU 가속)
```
사용자 질문
  → Frontend (컨테이너)
    → Backend (컨테이너)
      → http://ollama:11434 (Ollama 컨테이너)
        → GPU 가속 qwen2.5:7b 모델로 답변 생성
```

- **모든 서비스 컨테이너화**: Backend, Frontend, Ollama, DB 등 모든 서비스가 Docker로 실행
- **GPU 직접 활용**: NVIDIA Docker를 통해 컨테이너에서 GPU 직접 사용
- **연결 방식**: Docker 내부 네트워크를 통해 `ollama:11434`로 접근

### 사용 모델

| 모델명                   | 크기    | 용도              | 비고                    |
|----------------------|-------|-----------------|------------------------|
| qwen2.5:7b           | 4.7GB | RAG 질의응답       | 메인 대화 LLM             |
| bge-m3               | 1.2GB | 텍스트 임베딩       | 벡터 DB 저장용            |

### 주요 장점

#### 1. 완전 자동화된 배포
- Docker Compose만으로 모든 서비스 실행
- 초기화 스크립트로 모델 자동 다운로드
- 별도 설치 과정 불필요

#### 2. GPU 활용 최적화
- NVIDIA Docker를 통한 GPU 직접 접근
- 컨테이너 내부에서 GPU 가속 사용
- 빠른 추론 속도

#### 3. 비용 절감
- API 호출 비용 없음 (OpenAI GPT-4 대비 100% 절감)
- 무제한 쿼리 가능
- 데이터가 외부로 전송되지 않음

#### 4. 프라이버시 보호
- 모든 데이터가 로컬에서 처리
- 외부 API 의존성 없음
- GDPR 및 개인정보 보호 규정 준수 용이

#### 5. 간편한 관리
- 모든 서비스가 Docker로 격리
- 통합된 배포 및 관리
- 환경 변수로 모델 교체 가능

## 크롤링 시스템 상세

### 크롤링 프로세스

이 시스템은 **Playwright**를 사용하여 웹사이트를 BFS(너비 우선 탐색) 방식으로 크롤링합니다.

#### 크롤링 흐름

```
1. 크롤링 시작
   ↓
2. Playwright로 페이지 방문 (JavaScript 렌더링)
   ↓
3. 같은 도메인 내 링크 추출
   ↓
4. 제외 항목 필터링 (PDF, 이미지, zip 등)
   ↓
5. 최대 깊이까지 재귀적 탐색
   ↓
6. 수집된 URL을 임베딩 작업 큐에 추가
   ↓
7. 각 URL별로 콘텐츠 추출 및 마크다운 변환
   ↓
8. 텍스트 청킹 및 임베딩 생성
   ↓
9. Qdrant 벡터 DB에 저장
```

#### 크롤링 특징

- **동적 콘텐츠 지원**: Playwright로 JavaScript 렌더링된 페이지도 크롤링 가능
- **도메인 제한**: 같은 도메인 내 링크만 추적하여 크롤링 범위 제한
- **파일 제외**: PDF, 이미지, zip 등 바이너리 파일은 자동 제외
- **중복 방지**: 방문한 URL은 재방문하지 않음
- **배치 처리**: 임베딩 작업을 50개씩 배치로 큐에 추가하여 시스템 부하 분산

### 필터모드 vs 확장모드

RAG 검색 시 사용자가 선택할 수 있는 두 가지 모드입니다.

#### 필터모드 (Filter Mode)

- **목적**: 정확한 정보만 제공
- **검색 방식**:
  - 문서 수: 적음 (`top_k`, 기본 5개)
  - 유사도 임계값: **0.5 이상** (높은 임계값으로 정확한 매칭만 선택)
- **답변 특징**:
  - 컨텐츠에 있는 정보만 사용
  - 정보가 없으면 "죄송합니다. 해당 정보를 찾을 수 없습니다." 응답
  - 추론이나 일반 지식 사용 안 함
- **사용 시나리오**: 정확한 정보가 필요한 경우 (날짜, 시간, 연락처 등)

#### 확장모드 (Expand Mode)

- **목적**: 더 넓은 컨텍스트를 활용한 유연한 답변
- **검색 방식**:
  - 문서 수: 많음 (`top_k * 2`, 기본 10개)
  - 유사도 임계값: **0.3 이상** (낮은 임계값으로 더 많은 문서 포함)
  - 임계값 미달 시: 임계값 없이 재검색하여 최대한 많은 정보 수집
- **답변 특징**:
  - 컨텍스트 정보를 바탕으로 합리적인 추론 가능
  - 일반적인 대학 정보 활용 가능
  - 추론 시 "일반적으로", "보통", "추측하자면" 등으로 명확히 구분
- **사용 시나리오**: 넓은 범위의 정보나 추론이 필요한 경우

### 마크다운 변환 및 임베딩 프로세스

#### 1. 콘텐츠 추출 단계

```python
# HTML 파싱 (BeautifulSoup)
soup = BeautifulSoup(html_content, 'html.parser')

# 불필요한 요소 제거
제거 대상: script, style, nav, footer, header, aside, noscript, form
```

#### 2. 마크다운 변환 단계

**Ollama LLM을 통한 구조화된 마크다운 변환**

```python
# Ollama API로 HTML을 정리된 마크다운으로 변환
markdown_content = format_content_to_markdown(url, html_content)
```

**변환 목표**:
- 메인 콘텐츠 추출 및 구조화
- 네비게이션, 푸터, 사이드바 등 반복 요소 제거
- 마크다운 헤더(##, ###)를 사용한 계층 구조 생성
- 리스트, 표 등 구조 보존
- 중요 정보(날짜, 이름, 연락처 등) 보존

#### 3. 임베딩 생성 및 저장

```python
# 1. 텍스트 청킹
chunks = text_splitter.split_text(markdown_content)
# - 청크 크기: 1000자 (기본값)
# - 오버랩: 100자 (기본값)
# - 구분자: "\n\n", "\n", ". ", " "

# 2. 각 청크별 임베딩 생성
embedding = embeddings.embed_query(chunk)  # nomic-embed-text 모델 사용

# 3. Qdrant에 저장
- 벡터 차원: 768 (nomic-embed-text)
- 거리 측정: Cosine Similarity
- 메타데이터: URL, 청크 인덱스, 콘텐츠 해시 등
```

#### 4. 중복 감지 및 업데이트

- **콘텐츠 해시**: MD5 해시를 사용하여 콘텐츠 변경 감지
- **변경 감지**: 이전 크롤링 결과와 해시 비교
- **스마트 업데이트**: 콘텐츠가 변경된 경우 기존 벡터 삭제 후 새로 저장

### 크롤링 최적화 전략

1. **배치 처리**: 임베딩 작업을 50개씩 나누어 큐에 추가
2. **중복 방지**: URL 기반 + 콘텐츠 해시 기반 이중 검사
3. **타임아웃 설정**: 페이지 로딩 타임아웃 30초로 제한
4. **도메인 제한**: 같은 도메인 내 링크만 추적하여 무한 루프 방지

## Supabase 데이터베이스 설정

### 테이블 생성

프로젝트에서 사용하는 모든 테이블을 생성하려면 `supabase_tables.sql` 파일을 Supabase SQL 에디터에서 실행하세요.

```bash
# SQL 파일 위치
supabase_tables.sql
```

### 데이터베이스 구조

#### 1. 채팅 시스템 테이블

**chat_sessions**: 채팅 세션 관리
- `id`: UUID (PK)
- `user_id`: TEXT (사용자 이메일)
- `title`: TEXT (세션 제목, 첫 질문)
- `created_at`: TIMESTAMPTZ
- `updated_at`: TIMESTAMPTZ

**chat_history**: 채팅 메시지 히스토리
- `id`: UUID (PK)
- `user_id`: TEXT (사용자 이메일)
- `session_id`: UUID (FK → chat_sessions)
- `message`: TEXT (메시지 내용)
- `role`: TEXT ('user' | 'assistant')
- `sources`: JSONB (참조 출처, nullable)
- `created_at`: TIMESTAMPTZ

**favorites**: 즐겨찾기 관리
- `id`: UUID (PK)
- `user_id`: TEXT (사용자 이메일)
- `session_id`: UUID (FK → chat_sessions, nullable)
- `message_id`: UUID (FK → chat_history, nullable)
- `created_at`: TIMESTAMPTZ

#### 2. 스케줄 크롤링 시스템 테이블

**crawl_folders**: 크롤링 폴더 (스케줄 그룹)
- `id`: UUID (PK)
- `name`: TEXT (폴더명, UNIQUE)
- `schedule_type`: TEXT ('daily' | 'weekly' | 'monthly')
- `schedule_time`: TIME (크롤링 시간)
- `schedule_day`: INTEGER (주간 스케줄 시 요일, 0=일요일, 6=토요일)
- `enabled`: BOOLEAN (활성화 여부)
- `created_at`: TIMESTAMPTZ
- `updated_at`: TIMESTAMPTZ

**scheduled_crawl_sites**: 스케줄된 크롤링 사이트
- `id`: UUID (PK)
- `folder_id`: UUID (FK → crawl_folders)
- `name`: TEXT (사이트명)
- `url`: TEXT (크롤링 대상 URL)
- `description`: TEXT (사이트 설명, nullable)
- `enabled`: BOOLEAN (활성화 여부)
- `created_at`: TIMESTAMPTZ
- `updated_at`: TIMESTAMPTZ
- UNIQUE 제약: (folder_id, url)

## 시작하기

### 1. 프로젝트 클론

```bash
git clone https://github.com/his0si/retriever-project.git
cd retriever-project
```

### 2. Supabase 설정

1. [Supabase](https://supabase.com)에서 프로젝트 생성
2. SQL 에디터에서 `supabase_tables.sql` 실행하여 테이블 생성
3. API 키 발급:
   - Project Settings → API
   - `SUPABASE_URL` 및 `SUPABASE_ANON_KEY` 복사

### 3. 환경 변수 설정

#### 로컬 개발용 (.env.local)
```bash
# .env.local 파일 생성
touch .env.local
```

#### 프로덕션용 (.env)
```bash
# .env 파일 생성
touch .env
```

필요한 환경 변수:

**Ollama 설정**
- `OLLAMA_HOST`: Ollama 서버 주소 (기본값: http://ollama:11434)
- `OLLAMA_MODEL`: 사용할 LLM 모델 (기본값: qwen2.5:7b)
- `OLLAMA_EMBEDDING_MODEL`: 임베딩 모델 (기본값: bge-m3)

**Supabase 설정**
- `NEXT_PUBLIC_SUPABASE_URL`: Supabase 프로젝트 URL
- `NEXT_PUBLIC_SUPABASE_KEY`: Supabase anon public 키

**인증 설정 (NextAuth)**
- `NEXTAUTH_URL`: NextAuth URL (로컬: http://localhost, 프로덕션: https://yourdomain.com:9443)
- `NEXTAUTH_SECRET`: NextAuth 시크릿 (openssl rand -base64 32로 생성)

**OAuth 설정**
- `GOOGLE_CLIENT_ID`: Google OAuth 클라이언트 ID
- `GOOGLE_CLIENT_SECRET`: Google OAuth 클라이언트 시크릿
- `KAKAO_CLIENT_ID`: Kakao OAuth 클라이언트 ID
- `KAKAO_CLIENT_SECRET`: Kakao OAuth 클라이언트 시크릿

**프로덕션 전용**
- `DOMAIN_NAME`: 도메인 이름 (예: retrieverproject.duckdns.org)

**선택사항**
- `OPENAI_API_KEY`: OpenAI API 키 (Ollama 대신 GPT 사용 시)

## 로컬 개발

```bash
docker compose --env-file .env.local -f docker-compose.dev.yml up -d
```

접속: http://localhost

## 프로덕션 배포

### 1. 서비스 시작

```bash
cd retriever-project

# SSL 인증서 발급 (처음 한 번만)
chmod +x setup-ssl.sh && ./setup-ssl.sh

# Docker Compose로 모든 서비스 시작
docker compose -f docker-compose.prod.yml up -d
```

### 2. Ollama 모델 초기화 (필수!)

서비스가 시작된 후, 반드시 Ollama 모델을 다운로드해야 합니다:

```bash
# 초기화 스크립트 실행 (약 5-7분 소요)
./scripts/init-ollama.sh
```

이 스크립트는 다음 모델을 자동으로 다운로드합니다:
- **bge-m3** (1.2GB): 임베딩 모델
- **qwen2.5:7b** (4.7GB): LLM 모델

### 3. 접속

접속: https://yourdomain.com:9443

**⚠️ 중요**: `init-ollama.sh`를 실행하지 않으면 임베딩 생성이 실패합니다!

## SSL 인증서 설정

이 프로젝트는 Let's Encrypt를 사용하여 자동 SSL 인증서를 발급합니다.

### SSL 인증서 발급 과정

1. **도메인 설정**: `DOMAIN_NAME` 환경변수에 실제 도메인 설정
2. **자동 발급**: `setup-ssl.sh` 스크립트가 Let's Encrypt를 통해 인증서 발급
3. **자동 갱신**: 인증서는 90일마다 자동으로 갱신됩니다

### SSL 설정 특징

- **HTTPS 강제**: HTTP(9090) 접속 시 자동으로 HTTPS(9443)로 리다이렉트
- **보안 헤더**: HSTS, CSP 등 보안 헤더 자동 설정
- **자동 갱신**: cron job을 통한 인증서 자동 갱신
- **무료 인증서**: Let's Encrypt를 통한 무료 SSL 인증서

### 주요 접속 URL

- 웹사이트: https://yourdomain.com:9443
- API 문서: https://yourdomain.com:9443/backend/docs
- RabbitMQ UI: https://yourdomain.com:9443/rabbitmq/
- Qdrant Dashboard: http://yourdomain.com:6333/dashboard

## API 사용법

### 크롤링 시작

```bash
# 로컬
curl -X POST http://localhost:8000/crawl \
  -H "Content-Type: application/json" \
  -d '{"root_url": "https://example-school.edu", "max_depth": 2}'

# 프로덕션
curl -X POST https://yourdomain.com:9443/backend/crawl \
  -H "Content-Type: application/json" \
  -d '{"root_url": "https://example-school.edu", "max_depth": 2}'
```

### 질문하기

```bash
# 로컬
curl -X POST http://localhost:8000/chat \
  -H "Content-Type: application/json" \
  -d '{"question": "입학 절차는 어떻게 되나요?"}'

# 프로덕션
curl -X POST https://yourdomain.com:9443/backend/chat \
  -H "Content-Type: application/json" \
  -d '{"question": "입학 절차는 어떻게 되나요?"}'
```

## 모니터링

### 로컬 개발 환경
- RabbitMQ Management: http://localhost:15672
- Qdrant Dashboard: http://localhost:6333/dashboard
- API Docs: http://localhost:8000/docs

### 프로덕션 환경
- RabbitMQ Management: https://yourdomain.com:9443/rabbitmq/
- Qdrant Dashboard: http://yourdomain.com:6333/dashboard
- API Docs: https://yourdomain.com:9443/backend/docs

## 스케줄 크롤링 관리

웹 인터페이스를 통해 크롤링 폴더와 사이트를 관리할 수 있습니다.

### 크롤링 폴더 생성

1. 크롤링 페이지 접속
2. "스케줄 크롤링 폴더" 섹션에서 "새 폴더 추가" 클릭
3. 폴더 정보 입력:
   - **폴더명**: 식별하기 쉬운 이름
   - **스케줄 유형**: daily(매일), weekly(매주), monthly(매월)
   - **크롤링 시간**: HH:MM 형식 (예: 02:00)
   - **요일**: weekly 선택 시 요일 지정 (0=일요일, 6=토요일)
4. 폴더에 크롤링할 사이트 추가

### 사이트 관리

- **추가**: 폴더 카드에서 "사이트 추가" 버튼 클릭
- **활성화/비활성화**: 토글 스위치로 개별 사이트 또는 전체 사이트 제어
- **즉시 크롤링**: ⚡ 버튼을 클릭하여 스케줄 대기 없이 즉시 크롤링 실행
- **수정/삭제**: 연필/휴지통 아이콘으로 사이트 정보 수정 또는 삭제

### 스케줄 크롤링 특징

- **자동 실행**: APScheduler가 설정된 시간에 자동으로 크롤링 시작
- **폴더 단위 관리**: 관련 사이트를 폴더로 그룹화하여 효율적 관리
- **개별 제어**: 폴더 또는 사이트 단위로 활성화/비활성화 가능
- **유연한 스케줄**: 일별, 주별, 월별 다양한 주기 설정 가능
- **중복 방지**: 콘텐츠 해시 기반으로 변경된 내용만 업데이트

### 크롤링 설정

- **기본 깊이**: 2단계 하위 링크까지 탐색
- **배치 크기**: 50개 URL씩 임베딩 작업 큐에 추가
- **타임아웃**: 페이지 로딩 30초
- **제외 파일**: PDF, 이미지, zip 등 바이너리 파일 자동 제외
