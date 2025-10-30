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
- **Frontend**: Next.js
- **LLM**: Ollama (호스트 머신에서 실행)
  - **qwen2.5:7b** (4.7GB): RAG 질의응답용 메인 LLM
  - **nomic-embed-text** (274MB): 텍스트 임베딩 생성
  - **qwen2.5-coder:14b** (9.0GB): 코드 관련 작업용
- **Reverse Proxy**: Nginx + Let's Encrypt SSL

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

## 시작하기

### 1. 프로젝트 클론

```bash
git clone https://github.com/his0si/retriever-project.git
cd retriever-project
```

### 2. 환경 변수 설정

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
- `OLLAMA_HOST`: Ollama 서버 주소 (기본값: http://172.17.0.1:11434)
- `OLLAMA_MODEL`: 사용할 LLM 모델 (기본값: qwen2.5:7b)
- `OLLAMA_EMBEDDING_MODEL`: 임베딩 모델 (기본값: nomic-embed-text)
- `OPENAI_API_KEY`: OpenAI API 키 (선택사항)
- `NEXT_PUBLIC_SUPABASE_URL`: Supabase URL
- `NEXT_PUBLIC_SUPABASE_KEY`: Supabase API 키
- `NEXTAUTH_URL`: NextAuth URL (로컬: http://localhost, 프로덕션: https://yourdomain.com:9443)
- `NEXTAUTH_SECRET`: NextAuth 시크릿
- `GOOGLE_CLIENT_ID`: Google OAuth 클라이언트 ID
- `GOOGLE_CLIENT_SECRET`: Google OAuth 클라이언트 시크릿
- `KAKAO_CLIENT_ID`: Kakao OAuth 클라이언트 ID
- `KAKAO_CLIENT_SECRET`: Kakao OAuth 클라이언트 시크릿
- `DOMAIN_NAME`: 도메인 이름 (프로덕션만)

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

## 자동 크롤링 사이트 관리

크롤링할 사이트는 `backend/crawl_sites.json` 파일에서 관리됩니다.

```json
{
  "sites": [
    {
      "name": "이화여대 컴공과 메인",
      "url": "https://cse.ewha.ac.kr/cse/index.do",
      "description": "학과 소개 및 주요 정보",
      "enabled": true
    }
  ]
}
```

### 사이트 추가/수정 방법

1. `backend/crawl_sites.json` 파일 편집
2. 새 사이트 추가:
   ```json
   {
     "name": "새 사이트명",
     "url": "https://example.com",
     "description": "사이트 설명",
     "enabled": true
   }
   ```
3. 사이트 비활성화: `"enabled": false`로 설정
4. 백엔드 재시작 (자동으로 새 설정 반영)

### 자동 크롤링 설정

- **주기**: 매일 새벽 2시 (환경변수 `CRAWL_SCHEDULE`로 변경 가능)
- **깊이**: 2단계 하위 링크까지 탐색
- **중복 방지**: 콘텐츠 해시 기반 변경 감지



