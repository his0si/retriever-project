#!/bin/bash

# === 오라클 서버 배포 스크립트 ===
# 이 스크립트는 오라클 클라우드 서버에서 시스템 커널 파라미터 적용, Docker 컨테이너 정리, 빌드 및 배포, 헬스체크를 자동으로 수행합니다.
# 추가: 서버 hostname이 /etc/hosts에 등록되어 있지 않으면 자동으로 추가합니다 (RabbitMQ 등 서비스 정상 구동을 위함)

echo "=== 오라클 서버 배포 스크립트 ==="

# 1. 시스템 설정 적용 (root 권한 필요)
echo "시스템 설정 적용 중..."
if [ -f /etc/sysctl.conf ]; then
    sudo cp /etc/sysctl.conf /etc/sysctl.conf.backup
fi
sudo cp sysctl.conf /etc/sysctl.conf
sudo sysctl -p

# 1-1. hostname이 /etc/hosts에 등록되어 있는지 확인 및 추가
HOSTNAME=$(hostname)
echo "호스트네임 등록 확인 중... ($HOSTNAME)"
if ! grep -q "127.0.0.1.*$HOSTNAME" /etc/hosts; then
    echo "127.0.0.1   localhost $HOSTNAME" | sudo tee -a /etc/hosts
    echo "/etc/hosts에 $HOSTNAME 추가 완료"
else
    echo "/etc/hosts에 $HOSTNAME 이미 등록되어 있음"
fi

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