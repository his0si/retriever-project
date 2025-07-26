#!/bin/sh

# SSL 인증서가 이미 존재하는지 확인
if [ -f "/etc/nginx/ssl/fullchain.pem" ] && [ -f "/etc/nginx/ssl/privkey.pem" ]; then
    echo "SSL certificates already exist"
    exit 0
fi

# SSL 디렉토리 생성
mkdir -p /etc/nginx/ssl

# 자체 서명 인증서 생성
openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
    -keyout /etc/nginx/ssl/privkey.pem \
    -out /etc/nginx/ssl/fullchain.pem \
    -subj "/C=KR/ST=Seoul/L=Seoul/O=RetrieverProject/CN=retrieverproject.duckdns.org"

# 권한 설정
chmod 600 /etc/nginx/ssl/privkey.pem
chmod 644 /etc/nginx/ssl/fullchain.pem

echo "SSL certificates generated successfully"