#!/bin/bash
set -e

echo "======================================"
echo "  Retriever Project 프로덕션 배포"
echo "======================================"
echo ""

# .env 파일 확인
if [ ! -f .env ]; then
    echo "❌ .env 파일이 없습니다."
    exit 1
fi

echo "📦 기존 컨테이너 정리..."
docker compose -f docker-compose.prod.yml down

echo ""
echo "🏗️  Docker 이미지 빌드..."
docker compose -f docker-compose.prod.yml build --no-cache

echo ""
echo "🚀 서비스 시작..."
docker compose -f docker-compose.prod.yml up -d

echo ""
echo "⏳ 서비스 초기화 대기 중..."
echo "   - VPN 연결 대기..."
echo "   - RabbitMQ 시작 대기..."
echo "   - Redis 시작 대기..."
echo "   - Ollama 모델 다운로드 대기..."
echo ""

# 30초 대기
for i in {1..6}; do
    echo "   대기 중... ($i/6)"
    sleep 5
done

echo ""
echo "📊 서비스 상태 확인..."
docker compose -f docker-compose.prod.yml ps

echo ""
echo "✅ 배포 완료!"
echo ""
echo "📝 유용한 명령어:"
echo "   - 로그 확인: docker compose -f docker-compose.prod.yml logs -f"
echo "   - 상태 확인: docker compose -f docker-compose.prod.yml ps"
echo "   - 중지: docker compose -f docker-compose.prod.yml down"
echo "   - 재시작: docker compose -f docker-compose.prod.yml restart"
echo ""
echo "🌐 접속 URL: https://retrieverproject.duckdns.org:9443"
echo ""
