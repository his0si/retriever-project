# retriever project

학교 웹사이트의 분산된 정보를 자동으로 크롤링하고, RAG(Retrieval-Augmented Generation) 기반 챗봇을 제공합니다.

[🐶사이트 바로 가기](https://retrieverproject.duckdns.org:9443)

## 시스템 아키텍처

```
┌─────────────────────────────────────────────────────┐
│                   Internet (HTTPS)                  │
└───────────────────┬─────────────────────────────────┘
                    │
                    ▼
        ┌───────────────────────┐
        │   Nginx Reverse Proxy │ (9090/9443)
        │   + Let's Encrypt SSL │
        └───────────┬───────────┘
                    │
        ┌───────────┴───────────┐
        │                       │
        ▼                       ▼
┌──────────────┐        ┌──────────────┐
│   Frontend   │        │   Backend    │
│   (Next.js)  │        │   (FastAPI)  │
│    (3000)    │        │    (8000)    │
└──────────────┘        └──────┬───────┘
                               │
        ┌──────────────────────┼──────────────────────┐
        │                      │                      │
        ▼                      ▼                      ▼
┌──────────────┐        ┌──────────────┐        ┌──────────────┐
│   RabbitMQ   │        │    Redis     │        │    Qdrant    │
│ (5672/15672) │        │    (6379)    │        │  (6333-6334) │
└──────────────┘        └──────────────┘        └──────────────┘

════════════════════════════════════════════════════════════════
                    Docker Container Layer
════════════════════════════════════════════════════════════════
                              ▲
                              │ HTTP API (172.17.0.1:11434)
                              │
════════════════════════════════════════════════════════════════
                       Host Machine Layer
════════════════════════════════════════════════════════════════
                              │
                              ▼
                    ┌──────────────────┐
                    │  Ollama Server   │
                    │    (:11434)      │
                    │                  │
                    │  - qwen2.5:7b    │ (4.7GB, RAG LLM)
                    │  - nomic-embed   │ (274MB, Embedding)
                    │  - qwen-coder    │ (9.0GB, Coding)
                    └──────────────────┘
```

## 시스템 구성

- **Backend**: FastAPI + Celery + Playwright
- **Vector DB**: Qdrant (클라우드 호스팅)
- **Message Queue**: RabbitMQ
- **Cache**: Redis
- **Frontend**: Next.js + Supabase
- **LLM**: Ollama (호스트 머신에서 실행)
  - **qwen2.5:7b** (4.7GB): RAG 질의응답용 메인 LLM
  - **nomic-embed-text** (274MB): 텍스트 임베딩 생성
  - **qwen2.5-coder:14b** (9.0GB): 코드 관련 작업용
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

### 호스트 머신 전용

| 서비스    | 포트    | 용도                                    |
|--------|-------|---------------------------------------|
| Ollama | 11434 | LLM API (Docker에서 172.17.0.1:11434로 접근) |

## Ollama 기반 LLM 아키텍처

이 프로젝트는 **Ollama**를 사용하여 로컬에서 LLM을 실행합니다.

### 아키텍처 특징

#### Docker 컨테이너 외부 실행
```
사용자 질문
  → Frontend (컨테이너)
    → Backend (컨테이너)
      → http://172.17.0.1:11434 (호스트의 Ollama)
        → qwen2.5:7b 모델로 답변 생성
```

- **Docker 컨테이너**: Backend, Frontend, DB 등 애플리케이션 서비스
- **호스트 머신**: Ollama 서버 및 LLM 모델들
- **연결 방식**: Docker 브릿지 네트워크를 통해 `172.17.0.1:11434`로 접근

### 사용 모델

| 모델명                   | 크기    | 용도              | 비고                    |
|----------------------|-------|-----------------|------------------------|
| qwen2.5:7b           | 4.7GB | RAG 질의응답       | 메인 대화 LLM             |
| nomic-embed-text     | 274MB | 텍스트 임베딩       | 벡터 DB 저장용            |
| qwen2.5-coder:14b    | 9.0GB | 코드 생성/분석      | 선택적 사용                |

### 주요 장점

#### 1. 비용 절감
- API 호출 비용 없음 (OpenAI GPT-4 대비 100% 절감)
- 무제한 쿼리 가능
- 데이터가 외부로 전송되지 않음

#### 2. GPU 활용 최적화
- 호스트 머신의 GPU 직접 활용
- Docker 컨테이너보다 낮은 오버헤드
- 더 빠른 추론 속도

#### 3. 프라이버시 보호
- 모든 데이터가 로컬에서 처리
- 외부 API 의존성 없음
- GDPR 및 개인정보 보호 규정 준수 용이

#### 4. 유연한 아키텍처
- 필요시 GPU 서버로 쉽게 확장 가능
- 모델 변경 및 실험 용이
- OpenAI API와 병행 사용 가능

#### 5. 서비스 격리
- 애플리케이션 서비스는 Docker로 격리
- LLM은 호스트에서 안정적으로 실행
- 각 레이어의 독립적인 관리 및 배포

### Ollama 설치 및 설정

#### 1. Ollama 설치 (호스트 머신)
```bash
# Linux
curl -fsSL https://ollama.com/install.sh | sh

# 서버 시작
ollama serve
```

#### 2. 모델 다운로드
```bash
# RAG용 LLM
ollama pull qwen2.5:7b

# 임베딩 모델
ollama pull nomic-embed-text

# (선택) 코딩용 모델
ollama pull qwen2.5-coder:14b
```

#### 3. 환경 변수 설정
```bash
# .env 파일에 추가
OLLAMA_HOST=http://172.17.0.1:11434
OLLAMA_MODEL=qwen2.5:7b
OLLAMA_EMBEDDING_MODEL=nomic-embed-text
```

#### 4. 모델 확인
```bash
# 설치된 모델 목록
ollama list

# 모델 테스트
ollama run qwen2.5:7b
```

### 다른 LLM 사용하기

Ollama는 다양한 오픈소스 모델을 지원합니다:

```bash
# Llama 3.2 (Meta)
ollama pull llama3.2

# Mistral
ollama pull mistral

# Gemma 2 (Google)
ollama pull gemma2

# 환경 변수 변경으로 모델 교체
OLLAMA_MODEL=llama3.2
```

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
- `OLLAMA_HOST`: Ollama 서버 주소 (기본값: http://172.17.0.1:11434)
- `OLLAMA_MODEL`: 사용할 LLM 모델 (기본값: qwen2.5:7b)
- `OLLAMA_EMBEDDING_MODEL`: 임베딩 모델 (기본값: nomic-embed-text)

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

```bash
cd retriever-project
# SSL 인증서 발급
chmod +x setup-ssl.sh && ./setup-ssl.sh
# 배포
docker compose -f docker-compose.prod.yml up -d
```

접속: https://yourdomain.com:9443

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
