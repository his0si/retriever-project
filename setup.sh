#!/bin/bash

echo "🚀 Retriever Project 자동 설치 스크립트"
echo "=================================="

# 1. 시스템 업데이트
echo "📦 시스템 업데이트 중..."
sudo apt update && sudo apt upgrade -y

# 2. Docker 설치
echo "🐳 Docker 설치 중..."
if ! command -v docker &> /dev/null; then
    sudo apt install -y docker.io docker-compose
    sudo systemctl enable docker
    sudo systemctl start docker
    sudo usermod -aG docker $USER
    echo "Docker 설치 완료"
else
    echo "Docker 이미 설치됨"
fi

# 3. 방화벽 설정
echo "🔥 방화벽 설정 중..."
sudo ufw allow 22
sudo ufw allow 80
sudo ufw allow 443
sudo ufw --force enable

# 4. SSL 디렉토리 생성
echo "🔒 SSL 디렉토리 생성 중..."
mkdir -p ssl

# 5. 환경변수 파일 확인
echo "⚙️ 환경변수 파일 확인 중..."
if [ ! -f .env ]; then
    echo "❌ .env 파일이 없습니다!"
    echo "다음 정보를 입력해주세요:"
    read -p "DuckDNS 도메인: " DOMAIN
    read -p "Supabase URL: " SUPABASE_URL
    read -p "Supabase Key: " SUPABASE_KEY
    read -p "NextAuth Secret: " NEXTAUTH_SECRET
    read -p "Google Client ID: " GOOGLE_CLIENT_ID
    read -p "Google Client Secret: " GOOGLE_CLIENT_SECRET
    read -p "Kakao Client ID: " KAKAO_CLIENT_ID
    read -p "Kakao Client Secret: " KAKAO_CLIENT_SECRET
    
    cat > .env << EOF
# DuckDNS Domain
NEXT_PUBLIC_API_URL=https://$DOMAIN
NEXTAUTH_URL=https://$DOMAIN

# Supabase
NEXT_PUBLIC_SUPABASE_URL=$SUPABASE_URL
NEXT_PUBLIC_SUPABASE_KEY=$SUPABASE_KEY

# NextAuth
NEXTAUTH_SECRET=$NEXTAUTH_SECRET

# OAuth Providers
GOOGLE_CLIENT_ID=$GOOGLE_CLIENT_ID
GOOGLE_CLIENT_SECRET=$GOOGLE_CLIENT_SECRET
KAKAO_CLIENT_ID=$KAKAO_CLIENT_ID
KAKAO_CLIENT_SECRET=$KAKAO_CLIENT_SECRET

# Auto Crawl
AUTO_CRAWL_ENABLED=true
CRAWL_SCHEDULE="0 2 * * *"

# Qdrant
QDRANT_COLLECTION_NAME=school_documents
QDRANT_URL=http://qdrant:6333

# Redis
REDIS_URL=redis://redis:6379

# RabbitMQ
RABBITMQ_USER=guest
RABBITMQ_PASS=guest
EOF
    echo "✅ .env 파일 생성 완료"
else
    echo "✅ .env 파일 존재"
fi

# 6. SSL 인증서 설정
echo "🔐 SSL 인증서 설정 중..."
if [ -f .env ]; then
    DOMAIN=$(grep NEXT_PUBLIC_API_URL .env | cut -d'/' -f3)
    if [ ! -z "$DOMAIN" ]; then
        echo "도메인: $DOMAIN"
        echo "Let's Encrypt 인증서를 발급하려면 Enter를 누르세요..."
        read
        
        sudo certbot certonly --standalone -d $DOMAIN
        
        if [ -f "/etc/letsencrypt/live/$DOMAIN/fullchain.pem" ]; then
            sudo cp /etc/letsencrypt/live/$DOMAIN/fullchain.pem ssl/
            sudo cp /etc/letsencrypt/live/$DOMAIN/privkey.pem ssl/
            sudo chown $USER:$USER ssl/*
            echo "✅ SSL 인증서 설정 완료"
        else
            echo "⚠️ SSL 인증서 발급 실패. HTTP로 진행합니다."
            # nginx.conf에서 SSL 부분 주석 처리
            sed -i 's/listen 443 ssl http2;/# listen 443 ssl http2;/' nginx.conf
            sed -i 's/ssl_certificate/# ssl_certificate/' nginx.conf
            sed -i 's/ssl_certificate_key/# ssl_certificate_key/' nginx.conf
        fi
    fi
fi

# 7. Docker 컨테이너 시작
echo "🐳 Docker 컨테이너 시작 중..."
docker compose -f docker-compose.prod.yml up -d

# 8. 상태 확인
echo "📊 서비스 상태 확인 중..."
sleep 10
docker ps

echo "🎉 설치 완료!"
echo "웹사이트: https://$DOMAIN (또는 http://$DOMAIN)"
echo "관리: docker compose -f docker-compose.prod.yml logs -f" 