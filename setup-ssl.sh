#!/bin/bash

# SSL 인증서 설정 스크립트 - Retriever 프로젝트
# Let's Encrypt를 사용하여 SSL 인증서를 설정합니다

set -e

echo "SSL 인증서 설정을 시작합니다..."

# DOMAIN_NAME 환경변수가 설정되어 있는지 확인
if [ -z "$DOMAIN_NAME" ]; then
    echo "오류: DOMAIN_NAME 환경변수가 설정되지 않았습니다"
    echo ".env 파일에 DOMAIN_NAME을 설정하거나 다음 명령어로 export하세요:"
    echo "export DOMAIN_NAME=your-domain.com"
    exit 1
fi

echo "도메인: $DOMAIN_NAME"

# ssl 디렉토리가 없으면 생성
mkdir -p ssl

# certbot이 설치되어 있지 않으면 설치
if ! command -v certbot &> /dev/null; then
    echo "certbot을 설치합니다..."
    sudo apt update
    sudo apt install -y certbot
fi

# 포트 80을 사용하기 위해 nginx가 실행 중이면 중지
echo "nginx를 일시적으로 중지합니다..."
sudo systemctl stop nginx 2>/dev/null || true

# SSL 인증서 발급
echo "Let's Encrypt에서 SSL 인증서를 발급받습니다..."
sudo certbot certonly --standalone \
    --email admin@$DOMAIN_NAME \
    --agree-tos \
    --no-eff-email \
    -d $DOMAIN_NAME \
    -d www.$DOMAIN_NAME

# 인증서를 ssl 디렉토리로 복사
echo "인증서를 ssl 디렉토리로 복사합니다..."
sudo cp /etc/letsencrypt/live/$DOMAIN_NAME/fullchain.pem ssl/
sudo cp /etc/letsencrypt/live/$DOMAIN_NAME/privkey.pem ssl/

# 적절한 권한 설정
sudo chown $USER:$USER ssl/*.pem
chmod 600 ssl/*.pem

# 갱신 스크립트 생성
cat > renew-ssl.sh << 'EOF'
#!/bin/bash
# SSL 인증서 갱신 스크립트

set -e

echo "SSL 인증서를 갱신합니다..."

# nginx 중지
sudo systemctl stop nginx

# 인증서 갱신
sudo certbot renew

# 갱신된 인증서 복사
sudo cp /etc/letsencrypt/live/$DOMAIN_NAME/fullchain.pem ssl/
sudo cp /etc/letsencrypt/live/$DOMAIN_NAME/privkey.pem ssl/

# 권한 설정
sudo chown $USER:$USER ssl/*.pem
chmod 600 ssl/*.pem

# nginx 시작
sudo systemctl start nginx

echo "SSL 인증서 갱신이 완료되었습니다!"
EOF

chmod +x renew-ssl.sh

# 자동 갱신 cron 작업 설정
echo "자동 갱신 cron 작업을 설정합니다..."
(crontab -l 2>/dev/null; echo "0 12 * * * cd $(pwd) && ./renew-ssl.sh") | crontab -

echo "SSL 설정이 완료되었습니다!"
echo ""
echo "다음 단계:"
echo "1. 도메인 DNS가 이 서버를 가리키고 있는지 확인하세요"
echo "2. 다음 명령어를 실행하세요: docker compose -f docker-compose.prod.yml up -d"
echo "3. 사이트는 다음 주소에서 접속 가능합니다: https://$DOMAIN_NAME"
echo ""
echo "인증서는 매일 오후 12시에 자동으로 갱신됩니다" 