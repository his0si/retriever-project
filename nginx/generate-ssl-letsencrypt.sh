#!/bin/bash

# Let's Encrypt SSL 인증서 자동 발급 스크립트
DOMAIN="retrieverproject.duckdns.org"
EMAIL="admin@retrieverproject.duckdns.org"

echo "🔐 Let's Encrypt SSL 인증서 발급 시작..."

# 기존 인증서가 있는지 확인
if [ -f "/etc/letsencrypt/live/$DOMAIN/fullchain.pem" ]; then
    echo "✅ 기존 SSL 인증서가 발견되었습니다. 갱신을 시도합니다..."
    certbot renew --quiet --nginx
else
    echo "🆕 새로운 SSL 인증서를 발급받습니다..."
    
    # 임시로 nginx를 시작 (certbot이 필요로 함)
    nginx -g "daemon off;" &
    NGINX_PID=$!
    
    # 잠시 대기
    sleep 10
    
    # SSL 인증서 발급 (staging 환경에서 먼저 테스트)
    echo "📋 Staging 환경에서 인증서 발급 테스트..."
    certbot --nginx \
        --staging \
        --non-interactive \
        --agree-tos \
        --email $EMAIL \
        --domains $DOMAIN \
        --redirect
    
    if [ $? -eq 0 ]; then
        echo "✅ Staging 인증서 발급 성공! 실제 인증서를 발급받습니다..."
        # 실제 인증서 발급
        certbot --nginx \
            --non-interactive \
            --agree-tos \
            --email $EMAIL \
            --domains $DOMAIN \
            --redirect
    else
        echo "⚠️ Staging 인증서 발급 실패. 자체 서명 인증서를 생성합니다..."
        # 자체 서명 인증서 생성 (fallback)
        openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
            -keyout /etc/nginx/ssl/privkey.pem \
            -out /etc/nginx/ssl/fullchain.pem \
            -subj "/C=KR/ST=Seoul/L=Seoul/O=RetrieverProject/CN=$DOMAIN"
        
        chmod 600 /etc/nginx/ssl/privkey.pem
        chmod 644 /etc/nginx/ssl/fullchain.pem
    fi
    
    # nginx 프로세스 종료
    kill $NGINX_PID
fi

echo "✅ SSL 인증서 설정 완료!"

# nginx 설정에서 SSL 인증서 경로 업데이트
if [ -f "/etc/letsencrypt/live/$DOMAIN/fullchain.pem" ]; then
    echo "✅ Let's Encrypt 인증서를 사용합니다."
    # nginx.conf에서 SSL 인증서 경로를 Let's Encrypt 경로로 변경
    sed -i 's|ssl_certificate /etc/nginx/ssl/fullchain.pem;|ssl_certificate /etc/letsencrypt/live/retrieverproject.duckdns.org/fullchain.pem;|g' /etc/nginx/nginx.conf
    sed -i 's|ssl_certificate_key /etc/nginx/ssl/privkey.pem;|ssl_certificate_key /etc/letsencrypt/live/retrieverproject.duckdns.org/privkey.pem;|g' /etc/nginx/nginx.conf
    echo "✅ nginx 설정이 Let's Encrypt 인증서를 사용하도록 업데이트되었습니다."
else
    echo "✅ 자체 서명 인증서를 사용합니다."
fi 