#!/bin/bash

# SSL 인증서 설정 스크립트

# .env 파일에서 설정 읽기
if [ -f .env ]; then
    export $(cat .env | grep -v '^#' | xargs)
fi

# 도메인과 이메일 설정
DOMAIN="${DOMAIN_NAME:-retrieverproject.duckdns.org}"
EMAIL="${SSL_EMAIL:-admin@example.com}"

echo "==================================="
echo "SSL 인증서 설정 스크립트"
echo "==================================="
echo "도메인: $DOMAIN"
echo "이메일: $EMAIL"
echo "최종 포트: HTTP 8080, HTTPS 8443"
echo "==================================="
echo ""
echo "주의: SSL 인증서 발급을 위해 Let's Encrypt는"
echo "      80 포트를 사용합니다."
echo ""
echo "현재 80 포트를 사용 중인 다른 서비스를"
echo "일시적으로 중지해야 합니다."
echo ""
read -p "계속하시겠습니까? (y/n): " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "취소되었습니다."
    exit 1
fi

# Certbot 설치
echo "Certbot을 설치합니다..."
sudo apt update
sudo apt install -y certbot

# 필요한 디렉토리 생성
echo "필요한 디렉토리를 생성합니다..."
sudo mkdir -p ssl
sudo mkdir -p certbot/www
sudo mkdir -p certbot/conf

# Let's Encrypt 인증서 발급 (standalone 방식)
echo ""
echo "Let's Encrypt 인증서를 발급받습니다..."
echo "80 포트를 사용하는 다른 서비스가 중지되어 있어야 합니다."
echo ""

sudo certbot certonly --standalone \
    --preferred-challenges http \
    --email $EMAIL \
    --agree-tos \
    --no-eff-email \
    -d $DOMAIN

if [ $? -eq 0 ]; then
    echo ""
    echo "인증서 발급 성공!"

    # 인증서 파일을 프로젝트 디렉토리로 복사
    echo "인증서 파일을 복사합니다..."
    sudo cp /etc/letsencrypt/live/$DOMAIN/fullchain.pem ssl/
    sudo cp /etc/letsencrypt/live/$DOMAIN/privkey.pem ssl/

    # 권한 설정
    sudo chown $USER:$USER ssl/*
    sudo chmod 644 ssl/*

    echo ""
    echo "==================================="
    echo "SSL 인증서 설정이 완료되었습니다!"
    echo "==================================="
    echo ""
    echo "이제 다음 명령어로 서비스를 시작하세요:"
    echo "  docker-compose -f docker-compose.prod.yml up -d"
    echo ""
    echo "접속 URL:"
    echo "  HTTP:  http://$DOMAIN:8080"
    echo "  HTTPS: https://$DOMAIN:8443"
    echo ""
    echo "주의사항:"
    echo "  - 방화벽에서 8080, 8443 포트를 열어야 합니다"
    echo "  - 라우터에서 포트 포워딩 설정이 필요할 수 있습니다"
    echo "  - 인증서는 90일마다 갱신해야 합니다"
    echo ""
    echo "인증서 갱신 방법:"
    echo "  1. 80 포트를 사용하는 서비스 일시 중지"
    echo "  2. sudo certbot renew 실행"
    echo "  3. 인증서 파일 다시 복사:"
    echo "     sudo cp /etc/letsencrypt/live/$DOMAIN/*.pem ssl/"
    echo "     sudo chown $USER:$USER ssl/*"
    echo "  4. 서비스 재시작:"
    echo "     docker-compose -f docker-compose.prod.yml restart nginx"
    echo "==================================="
else
    echo ""
    echo "==================================="
    echo "인증서 발급 실패!"
    echo "==================================="
    echo "다음을 확인하세요:"
    echo "1. 80 포트를 사용하는 다른 서비스가 중지되어 있는지 확인"
    echo "2. DuckDNS 도메인이 올바른 공인 IP를 가리키는지 확인"
    echo "3. 방화벽에서 80 포트가 열려있는지 확인"
    echo "4. 라우터에서 80 포트 포워딩이 되어 있는지 확인"
    echo ""
    echo "디버깅 명령어:"
    echo "  sudo lsof -i :80          # 80 포트 사용 중인 프로세스 확인"
    echo "  curl -I http://$DOMAIN    # 도메인 접근 테스트"
    echo "==================================="
    exit 1
fi 