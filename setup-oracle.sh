#!/bin/bash

echo "🚀 Retriever Project - Oracle 서버 배포 스크립트"
echo "============================================"

# 환경 변수 확인
if [ ! -f .env ]; then
    echo "❌ .env 파일이 없습니다!"
    echo "✅ .env.example을 복사하여 .env를 생성합니다..."
    cp .env.example .env
    echo "⚠️  .env 파일을 수정하여 필요한 값들을 설정해주세요!"
    exit 1
fi

# Docker 확인
if ! command -v docker &> /dev/null; then
    echo "❌ Docker가 설치되지 않았습니다!"
    exit 1
fi

# 기존 컨테이너 정리
echo "🧹 기존 컨테이너 정리 중..."
docker-compose -f docker-compose.prod.yml down

# 초기 실행 (HTTP만)
echo "🏗️ 초기 빌드 및 실행 (HTTP)..."
docker-compose -f docker-compose.prod.yml up -d

echo "⏳ 서비스가 시작될 때까지 대기 중..."
sleep 30

# Let's Encrypt 인증서 발급
echo "🔐 Let's Encrypt 인증서 발급 중..."
read -p "이메일 주소를 입력하세요 (인증서 알림용): " email

# init-letsencrypt.sh 실행
chmod +x init-letsencrypt.sh
./init-letsencrypt.sh

echo "✅ 배포 완료!"
echo ""
echo "접속 주소:"
echo "- HTTP: http://retrieverproject.duckdns.org"
echo "- HTTPS: https://retrieverproject.duckdns.org"
echo ""
echo "관리자 로그인:"
echo "- ID: admin"
echo "- PW: 1886"
echo ""
echo "로그 확인: docker-compose -f docker-compose.prod.yml logs -f"
echo "종료: docker-compose -f docker-compose.prod.yml down"