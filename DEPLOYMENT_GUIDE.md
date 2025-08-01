# 배포 가이드

## 문제 해결 내역

### 1. 채팅 기능 문제
- **원인**: 프론트엔드에서 백엔드 API 호출 시 라우팅 문제
- **해결**: 
  - Next.js API 라우트 추가 (`/app/api/chat/route.ts` 등)
  - 환경변수 `NEXT_PUBLIC_BACKEND_URL` 추가
  - Docker Compose 설정 업데이트

### 2. 크롤링 기능 문제
- **원인**: API 경로 설정 누락
- **해결**: API 라우트 파일 생성으로 프록시 기능 구현

### 3. 백엔드 리팩토링
- **변경사항**:
  - 기능별 모듈 분리 (`api/routes/`, `api/models/`)
  - main.py 간소화
  - 명확한 프로젝트 구조

## 배포 전 체크리스트

### 1. 환경변수 설정 (.env 파일)
```bash
# 도메인 설정
DOMAIN_NAME=your-domain.com

# API 설정
NEXT_PUBLIC_API_URL=https://your-domain.com/api
NEXT_PUBLIC_BACKEND_URL=http://api:8000

# Supabase 설정
NEXT_PUBLIC_SUPABASE_URL=your-supabase-url
NEXT_PUBLIC_SUPABASE_KEY=your-supabase-anon-key

# NextAuth 설정
NEXTAUTH_URL=https://your-domain.com
NEXTAUTH_SECRET=your-nextauth-secret

# OAuth 설정
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret
KAKAO_CLIENT_ID=your-kakao-client-id
KAKAO_CLIENT_SECRET=your-kakao-client-secret

# OpenAI 설정
OPENAI_API_KEY=your-openai-api-key

# CORS 설정
CORS_ORIGINS=["https://your-domain.com"]
```

### 2. SSL 인증서 준비
```bash
# SSL 인증서 파일을 ssl/ 디렉토리에 배치
ssl/
├── fullchain.pem
└── privkey.pem
```

## 배포 명령어

### 1. 이미지 빌드 및 실행
```bash
# 프로덕션 환경 실행
docker-compose -f docker-compose.prod.yml up -d --build

# 로그 확인
docker-compose -f docker-compose.prod.yml logs -f

# 특정 서비스 로그 확인
docker-compose -f docker-compose.prod.yml logs -f api
docker-compose -f docker-compose.prod.yml logs -f frontend
```

### 2. 서비스 상태 확인
```bash
# 컨테이너 상태 확인
docker-compose -f docker-compose.prod.yml ps

# 헬스체크
curl http://your-domain.com/health
curl http://your-domain.com/api/health
```

### 3. 문제 해결
```bash
# 서비스 재시작
docker-compose -f docker-compose.prod.yml restart api
docker-compose -f docker-compose.prod.yml restart frontend

# 전체 재시작
docker-compose -f docker-compose.prod.yml down
docker-compose -f docker-compose.prod.yml up -d

# 캐시 무시하고 재빌드
docker-compose -f docker-compose.prod.yml build --no-cache
docker-compose -f docker-compose.prod.yml up -d
```

## 모니터링

### 1. 로그 위치
- Nginx: `docker logs rag-nginx`
- API: `docker logs rag-api`
- Frontend: `docker logs rag-frontend`
- Celery: `docker logs rag-celery`

### 2. 메모리 사용량 확인
```bash
docker stats
```

### 3. 데이터베이스 상태 확인
- Qdrant UI: http://your-domain.com:6333/dashboard
- RabbitMQ Management: http://your-domain.com:15672

## 일반적인 문제 해결

### 1. 502 Bad Gateway
- API 서버가 정상 작동하는지 확인
- `docker logs rag-api` 로그 확인
- 포트 설정 확인

### 2. CORS 에러
- `.env` 파일의 `CORS_ORIGINS` 설정 확인
- 도메인명이 정확한지 확인

### 3. 채팅/크롤링 기능 안됨
- 백엔드 API 헬스체크 확인
- 환경변수 설정 확인
- Docker 네트워크 연결 확인

### 4. 메모리 부족
- Docker 리소스 제한 확인
- 불필요한 서비스 중지
- 스왑 메모리 추가 고려