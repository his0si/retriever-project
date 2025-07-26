# Retriever Project

리트리버가 대신 찾아드릴게요! 학교 정보를 AI가 정확하게 알려드립니다.

## 🚀 빠른 시작

### 1. 서버에 클론
```bash
git clone https://github.com/your-username/retriever-project.git
cd retriever-project
```

### 2. 자동 설치 스크립트 실행
```bash
chmod +x setup.sh
./setup.sh
```

스크립트가 다음을 자동으로 설정합니다:
- ✅ Docker 설치
- ✅ 방화벽 설정
- ✅ SSL 인증서 발급
- ✅ 환경변수 설정
- ✅ 컨테이너 시작

### 3. 수동 설치 (선택사항)

#### 필수 요구사항
- Ubuntu 20.04+ 또는 Debian 11+
- Docker & Docker Compose
- DuckDNS 도메인 (무료)
- Supabase 프로젝트
- Google OAuth 설정
- Kakao OAuth 설정

#### 환경변수 설정
```bash
cp .env.example .env
nano .env
```

필수 환경변수:
```env
# DuckDNS Domain
NEXT_PUBLIC_API_URL=https://your-domain.duckdns.org
NEXTAUTH_URL=https://your-domain.duckdns.org

# Supabase
NEXT_PUBLIC_SUPABASE_URL=your-supabase-url
NEXT_PUBLIC_SUPABASE_KEY=your-supabase-key

# NextAuth
NEXTAUTH_SECRET=your-secret

# OAuth Providers
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret
KAKAO_CLIENT_ID=your-kakao-client-id
KAKAO_CLIENT_SECRET=your-kakao-client-secret
```

#### SSL 인증서 설정
```bash
# Let's Encrypt 설치
sudo apt install certbot

# 인증서 발급
sudo certbot certonly --standalone -d your-domain.duckdns.org

# 인증서 복사
sudo cp /etc/letsencrypt/live/your-domain.duckdns.org/fullchain.pem ssl/
sudo cp /etc/letsencrypt/live/your-domain.duckdns.org/privkey.pem ssl/
sudo chown $USER:$USER ssl/*
```

#### 컨테이너 시작
```bash
docker compose -f docker-compose.prod.yml up -d
```

## 🏗️ 아키텍처

```
┌─────────────┐    ┌─────────────┐    ┌─────────────┐
│   Frontend  │    │     API     │    │   Celery    │
│  (Next.js)  │◄──►│  (FastAPI)  │◄──►│   Worker    │
└─────────────┘    └─────────────┘    └─────────────┘
       │                   │                   │
       │                   │                   │
       ▼                   ▼                   ▼
┌─────────────┐    ┌─────────────┐    ┌─────────────┐
│    Nginx    │    │   Qdrant    │    │   RabbitMQ  │
│   (Proxy)   │    │ (Vector DB) │    │  (Message)  │
└─────────────┘    └─────────────┘    └─────────────┘
                           │                   │
                           ▼                   ▼
                   ┌─────────────┐    ┌─────────────┐
                   │    Redis    │    │   Supabase  │
                   │   (Cache)   │    │   (Auth)    │
                   └─────────────┘    └─────────────┘
```

## 🔧 관리 명령어

### 컨테이너 관리
```bash
# 상태 확인
docker ps

# 로그 확인
docker compose -f docker-compose.prod.yml logs -f

# 재시작
docker compose -f docker-compose.prod.yml restart

# 중지
docker compose -f docker-compose.prod.yml down
```

### SSL 인증서 갱신
```bash
# 수동 갱신
sudo certbot renew

# 인증서 복사
sudo cp /etc/letsencrypt/live/your-domain.duckdns.org/fullchain.pem ssl/
sudo cp /etc/letsencrypt/live/your-domain.duckdns.org/privkey.pem ssl/
sudo chown $USER:$USER ssl/*

# nginx 재시작
docker compose -f docker-compose.prod.yml restart nginx
```

### 백업
```bash
# 데이터 백업
docker run --rm -v retriever-project_qdrant_data:/data -v $(pwd):/backup alpine tar czf /backup/qdrant_backup.tar.gz -C /data .

# 복원
docker run --rm -v retriever-project_qdrant_data:/data -v $(pwd):/backup alpine tar xzf /backup/qdrant_backup.tar.gz -C /data
```

## 🛡️ 보안

- **Rate Limiting**: API 요청 제한
- **악성 요청 차단**: 자동 공격 방지
- **SSL/TLS**: HTTPS 강제 적용
- **보안 헤더**: XSS, CSRF 방지
- **컨테이너 보안**: Read-only 파일시스템

## 📊 모니터링

### 헬스체크
```bash
# API 상태
curl https://your-domain.duckdns.org/health

# 데이터베이스 상태
curl https://your-domain.duckdns.org/api/db/status
```

### 로그 모니터링
```bash
# 실시간 로그
docker compose -f docker-compose.prod.yml logs -f

# 특정 서비스 로그
docker logs rag-api
docker logs rag-frontend
```

## 🐛 문제 해결

### 컨테이너가 시작되지 않을 때
```bash
# 로그 확인
docker logs rag-api

# 의존성 확인
docker ps -a

# 강제 재시작
docker compose -f docker-compose.prod.yml up -d --force-recreate
```

### SSL 인증서 문제
```bash
# 인증서 확인
sudo certbot certificates

# 수동 갱신
sudo certbot renew --force-renewal
```

### 메모리 부족
```bash
# 메모리 사용량 확인
docker stats

# 컨테이너 리소스 제한 조정
# docker-compose.prod.yml에서 memory 제한 수정
```

## 📝 라이선스

MIT License

## 🤝 기여

1. Fork the Project
2. Create your Feature Branch (`git checkout -b feature/AmazingFeature`)
3. Commit your Changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the Branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request
