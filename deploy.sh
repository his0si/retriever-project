#!/bin/bash

echo "=== 오라클 서버 배포 스크립트 ==="

# 1. 시스템 설정 적용 (root 권한 필요)
echo "시스템 설정 적용 중..."
if [ -f /etc/sysctl.conf ]; then
    sudo cp /etc/sysctl.conf /etc/sysctl.conf.backup
fi
sudo cp sysctl.conf /etc/sysctl.conf
sudo sysctl -p

# 2. 기존 컨테이너 정리
echo "기존 컨테이너 정리 중..."
docker-compose -f docker-compose.prod.yml down -v

# 3. Docker 시스템 정리
echo "Docker 시스템 정리 중..."
docker system prune -af --volumes

# 4. 빌드 및 배포
echo "애플리케이션 빌드 및 배포 중..."
docker-compose -f docker-compose.prod.yml build --no-cache
docker-compose -f docker-compose.prod.yml up -d

# 5. 헬스체크
echo "서비스 상태 확인 중..."
sleep 30
docker-compose -f docker-compose.prod.yml ps

echo "=== 배포 완료 ==="