# retriever project

학교 웹사이트의 분산된 정보를 자동으로 크롤링하고, RAG(Retrieval-Augmented Generation) 기반 챗봇을 제공합니다.

배포 링크: https://retrieverproject.duckdns.org

## 시스템 구성

- **Backend**: FastAPI + Celery + Playwright
- **Vector DB**: Qdrant
- **Message Queue**: RabbitMQ
- **Cache**: Redis
- **Frontend**: Next.js
- **LLM**: OpenAI GPT-4
- **Reverse Proxy**: Nginx

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
- `NEXTAUTH_URL`: NextAuth URL (로컬: http://localhost, 프로덕션: https://your-domain.com)
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
cd retriever
# SSL 인증서 발급
chmod +x setup-ssl.sh && ./setup-ssl.sh
# 배포
docker compose -f docker-compose.prod.yml up -d
```

접속: https://your-domain.com

## API 사용법

### 크롤링 시작

```bash
# 로컬
curl -X POST http://localhost:8000/crawl \
  -H "Content-Type: application/json" \
  -d '{"root_url": "https://example-school.edu", "max_depth": 2}'

# 프로덕션
curl -X POST https://your-domain.com/backend/crawl \
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
curl -X POST https://your-domain.com/backend/chat \
  -H "Content-Type: application/json" \
  -d '{"question": "입학 절차는 어떻게 되나요?"}'
```

## 모니터링

- RabbitMQ Management: http://localhost:15672
- Qdrant Dashboard: http://localhost:6333/dashboard
- API Docs: http://localhost:8000/docs

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


