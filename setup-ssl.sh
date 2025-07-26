#!/bin/bash

# SSL 인증서 설정 스크립트
DOMAIN="retrieverproject.duckdns.org"
EMAIL="his0si2276@gmail.com"  # 실제 이메일로 변경하세요

echo "SSL 인증서 설정을 시작합니다..."

# Certbot 설치
echo "Certbot을 설치합니다..."
sudo apt update
sudo apt install -y certbot python3-certbot-nginx

# SSL 디렉토리 생성
echo "SSL 디렉토리를 생성합니다..."
sudo mkdir -p ssl

# Let's Encrypt 인증서 발급
echo "Let's Encrypt 인증서를 발급받습니다..."
sudo certbot certonly --standalone \
    --email $EMAIL \
    --agree-tos \
    --no-eff-email \
    -d $DOMAIN

# 인증서 파일을 프로젝트 디렉토리로 복사
echo "인증서 파일을 복사합니다..."
sudo cp /etc/letsencrypt/live/$DOMAIN/fullchain.pem ssl/
sudo cp /etc/letsencrypt/live/$DOMAIN/privkey.pem ssl/

# 권한 설정
sudo chown $USER:$USER ssl/*
sudo chmod 600 ssl/*

echo "SSL 인증서 설정이 완료되었습니다!"
echo "이제 다음 명령어로 서비스를 시작하세요:"
echo "docker-compose -f docker-compose.prod.yml up -d" 