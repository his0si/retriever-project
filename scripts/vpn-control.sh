#!/bin/bash

# VPN 제어 스크립트
# 사용법: ./scripts/vpn-control.sh [start|stop|restart|status|ip] [dev|prod]

set -e

ENV=${2:-prod}

if [ "$ENV" = "dev" ]; then
    COMPOSE_FILE="docker-compose.dev.yml"
    VPN_CONTAINER="rag-vpn-dev"
else
    COMPOSE_FILE="docker-compose.prod.yml"
    VPN_CONTAINER="rag-vpn"
fi

case "$1" in
    start)
        echo "🚀 VPN과 함께 서비스 시작 중..."
        docker-compose -f $COMPOSE_FILE up -d
        echo "✅ 서비스가 시작되었습니다."
        ;;

    stop)
        echo "🛑 서비스 중지 중..."
        docker-compose -f $COMPOSE_FILE down
        echo "✅ 서비스가 중지되었습니다."
        ;;

    restart)
        echo "🔄 서비스 재시작 중..."
        docker-compose -f $COMPOSE_FILE restart vpn api celery
        echo "✅ 서비스가 재시작되었습니다."
        ;;

    status)
        echo "📊 VPN 상태 확인 중..."
        echo ""
        echo "=== Docker 컨테이너 상태 ==="
        docker ps --filter "name=$VPN_CONTAINER" --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"
        echo ""
        echo "=== VPN 연결 상태 ==="
        if docker exec $VPN_CONTAINER wg show 2>/dev/null; then
            echo ""
            echo "✅ VPN이 정상적으로 연결되어 있습니다."
        else
            echo "❌ VPN 연결에 문제가 있습니다."
            echo ""
            echo "=== VPN 로그 (최근 20줄) ==="
            docker-compose -f $COMPOSE_FILE logs --tail=20 vpn
        fi
        ;;

    ip)
        echo "🌍 현재 외부 IP 확인 중..."
        echo ""
        echo "=== VPN IP 주소 ==="
        VPN_IP=$(docker exec $VPN_CONTAINER curl -s ifconfig.me 2>/dev/null || echo "확인 실패")
        echo "VPN IP: $VPN_IP"
        echo ""
        echo "=== API 컨테이너 IP 주소 ==="
        API_IP=$(docker exec rag-api curl -s ifconfig.me 2>/dev/null || echo "확인 실패")
        echo "API IP: $API_IP"

        if [ "$VPN_IP" = "$API_IP" ] && [ "$VPN_IP" != "확인 실패" ]; then
            echo ""
            echo "✅ API가 VPN을 통해 연결되어 있습니다!"
        else
            echo ""
            echo "⚠️  API가 VPN을 사용하지 않고 있을 수 있습니다."
        fi
        ;;

    logs)
        echo "📜 VPN 로그 확인 중..."
        docker-compose -f $COMPOSE_FILE logs -f vpn
        ;;

    *)
        echo "사용법: $0 [start|stop|restart|status|ip|logs] [dev|prod]"
        echo ""
        echo "명령어:"
        echo "  start   - VPN과 함께 모든 서비스 시작"
        echo "  stop    - 모든 서비스 중지"
        echo "  restart - VPN, API, Celery 재시작"
        echo "  status  - VPN 상태 확인"
        echo "  ip      - 현재 외부 IP 확인"
        echo "  logs    - VPN 로그 실시간 확인"
        echo ""
        echo "환경:"
        echo "  dev     - 개발 환경 (기본값: prod)"
        echo "  prod    - 프로덕션 환경"
        echo ""
        echo "예시:"
        echo "  $0 start prod    # 프로덕션 환경 시작"
        echo "  $0 status dev    # 개발 환경 상태 확인"
        echo "  $0 ip            # 현재 IP 확인 (프로덕션)"
        exit 1
        ;;
esac
