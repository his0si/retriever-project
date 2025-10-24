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
```

## 시스템 구성

- **Backend**: FastAPI + Celery + Playwright
- **Vector DB**: Qdrant
- **Message Queue**: RabbitMQ
- **Cache**: Redis
- **Frontend**: Next.js
- **LLM**: OpenAI GPT-4
- **Reverse Proxy**: Nginx

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
- `OPENAI_API_KEY`: OpenAI API 키
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



