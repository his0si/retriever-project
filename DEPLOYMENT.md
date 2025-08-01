# 배포 가이드

이 문서는 Retriever Project를 프로덕션 환경에 배포하는 방법을 설명합니다.

## 사전 요구사항

- Ubuntu 20.04 이상 서버
- Docker 및 Docker Compose 설치
- 도메인 (예: retrieverproject.duckdns.org)
- 포트 80, 443 개방

## 배포 절차

### 1. 프로젝트 클론

```bash
git clone https://github.com/his0si/retriever-project.git
cd retriever-project
```

> ⚠️ **중요**: 폴더명이 `retriever`가 아닌 `retriever-project`입니다.

### 2. 환경 변수 설정

```bash
cp .env.example .env
```

`.env` 파일을 열고 다음 값들을 설정하세요:

```env
# 필수 설정
OPENAI_API_KEY=your_openai_api_key
DOMAIN_NAME=your_domain.com
SSL_EMAIL=your_email@example.com

# Supabase (OAuth 로그인용)
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_KEY=your_supabase_anon_key
SUPABASE_URL=your_supabase_url
SUPABASE_KEY=your_supabase_service_key

# OAuth 설정
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret
KAKAO_CLIENT_ID=your_kakao_client_id
KAKAO_CLIENT_SECRET=your_kakao_client_secret
NEXTAUTH_SECRET=your_nextauth_secret

# 관리자 계정
ADMIN_USERNAME=admin
ADMIN_PASSWORD=secure_password_here

# RabbitMQ/Redis 비밀번호 변경
RABBITMQ_USER=admin
RABBITMQ_PASS=secure_rabbitmq_password

# Qdrant 설정 (선택사항 - 외부 Qdrant 사용시)
QDRANT_HOST=https://your-qdrant-instance.com
QDRANT_API_KEY=your_qdrant_api_key
```

### 3. SSL 인증서 발급 (도메인이 있는 경우)

```bash
chmod +x setup-ssl.sh
./setup-ssl.sh
```

> 주의: 스크립트 실행 전에 도메인의 DNS가 서버 IP를 가리키고 있어야 합니다.

### 4. 배포 실행

```bash
# 프로덕션 환경으로 배포
docker compose -f docker-compose.prod.yml up -d

# 또는 start-prod.sh 스크립트 사용 (Linux/Mac)
chmod +x start-prod.sh
./start-prod.sh

# Windows의 경우
start-prod.bat
```

### 5. 배포 확인

배포가 완료되면 다음 URL에서 서비스를 확인하세요:

- 웹사이트: https://your_domain.com
- API 문서: https://your_domain.com/api/docs (nginx 설정에 따라 접근 불가할 수 있음)

### 6. 로그 확인

문제가 발생한 경우 로그를 확인하세요:

```bash
# 모든 서비스 로그
docker compose -f docker-compose.prod.yml logs

# 특정 서비스 로그
docker compose -f docker-compose.prod.yml logs frontend
docker compose -f docker-compose.prod.yml logs api
docker compose -f docker-compose.prod.yml logs nginx
```

## 검증된 설정 값

배포 환경에서 테스트된 설정 사항:

1. **서비스 간 통신**: Docker 컨테이너 간 통신은 서비스명 사용
   - Redis: `rag-redis`
   - RabbitMQ: `rag-rabbitmq`
   - API: `api` (nginx proxy에서 사용)

2. **환경 변수 우선순위**:
   - 개발: `.env.local` 사용
   - 배포: `.env` 사용

3. **CORS 설정**: 프론트엔드 도메인 포함 필요
   ```
   CORS_ORIGINS=http://your-domain.com,https://your-domain.com
   ```

4. **nginx 라우팅**:
   - `/api/auth/*` → 프론트엔드 (NextAuth)
   - `/api/*` → 프론트엔드 (Next.js API Routes)
   - `/backend/*` → 백엔드 (FastAPI 직접 접근용)

## 트러블슈팅

### SSL 인증서 문제

SSL 인증서 발급에 실패한 경우:

1. 도메인의 DNS 설정 확인
2. 포트 80이 열려 있는지 확인
3. Certbot 로그 확인: `/var/log/letsencrypt/letsencrypt.log`

### 컨테이너 시작 실패

```bash
# 상태 확인
docker compose -f docker-compose.prod.yml ps

# 로그 확인
docker compose -f docker-compose.prod.yml logs [서비스명]

# 재시작
docker compose -f docker-compose.prod.yml restart [서비스명]
```

### 메모리 부족

서버 메모리가 부족한 경우 docker-compose.prod.yml에서 메모리 제한을 조정하세요.

## 유지보수

### 백업

```bash
# Qdrant 데이터 백업
docker exec rag-qdrant qdrant-backup create /qdrant/backup/$(date +%Y%m%d)

# Redis 데이터 백업
docker exec rag-redis redis-cli SAVE
docker cp rag-redis:/data/dump.rdb ./backup/redis-$(date +%Y%m%d).rdb
```

### 업데이트

```bash
# 코드 업데이트
git pull origin main

# 컨테이너 재빌드 및 재시작
docker compose -f docker-compose.prod.yml up -d --build
```

### SSL 인증서 갱신

Let's Encrypt 인증서는 90일마다 갱신이 필요합니다:

```bash
# 수동 갱신
sudo certbot renew
./setup-ssl.sh

# 자동 갱신 설정 (crontab)
0 0 * * 0 /usr/bin/certbot renew --quiet && cd /path/to/retriever-project && ./setup-ssl.sh
```

## 보안 권장사항

1. **방화벽 설정**: 필요한 포트만 개방
   - 80 (HTTP)
   - 443 (HTTPS)
   - 22 (SSH - IP 제한 권장)

2. **환경 변수 보호**: `.env` 파일 권한 설정
   ```bash
   chmod 600 .env
   ```

3. **정기적인 업데이트**: 시스템 및 Docker 이미지 업데이트

4. **모니터링**: 로그 및 리소스 사용량 모니터링 설정