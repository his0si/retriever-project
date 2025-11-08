# VPN 설정 가이드

이 프로젝트는 ProtonVPN WireGuard를 사용하여 크롤링 시 IP 차단을 우회합니다.

## 설정된 내용

- **VPN 제공자**: ProtonVPN
- **서버**: NL-FREE#158 (네덜란드)
- **프로토콜**: WireGuard
- **VPN을 통한 서비스**: api, celery (크롤링 서비스)

## Docker Compose 실행 방법

### 프로덕션 환경
```bash
# VPN과 함께 전체 서비스 실행
docker-compose -f docker-compose.prod.yml up -d

# VPN 연결 상태 확인
docker-compose -f docker-compose.prod.yml logs vpn

# VPN을 통한 외부 IP 확인
docker exec rag-vpn curl -s ifconfig.me
```

### 개발 환경
```bash
# VPN과 함께 전체 서비스 실행
docker-compose -f docker-compose.dev.yml up -d

# VPN 연결 상태 확인
docker-compose -f docker-compose.dev.yml logs vpn

# VPN을 통한 외부 IP 확인
docker exec rag-vpn-dev curl -s ifconfig.me
```

## VPN 동작 확인

1. **VPN 컨테이너 헬스체크**
   ```bash
   docker ps --filter "name=vpn"
   ```
   Status가 `healthy`로 표시되어야 합니다.

2. **VPN IP 확인**
   ```bash
   # 프로덕션
   docker exec rag-api curl -s ifconfig.me

   # 개발
   docker exec rag-api curl -s ifconfig.me
   ```
   네덜란드 IP 주소가 표시되어야 합니다.

3. **WireGuard 연결 상태**
   ```bash
   # 프로덕션
   docker exec rag-vpn wg show

   # 개발
   docker exec rag-vpn-dev wg show
   ```

## 네트워크 구조

- `api`와 `celery` 서비스는 `network_mode: "service:vpn"`을 사용하여 VPN 컨테이너의 네트워크 스택을 공유합니다.
- 모든 외부 트래픽은 ProtonVPN을 통해 라우팅됩니다.
- 다른 서비스(nginx, frontend, redis 등)는 VPN을 사용하지 않습니다.

## 주의사항

1. **VPN 설정 파일 보안**: `wg0.conf` 파일에는 PrivateKey가 포함되어 있으므로 절대 공개 저장소에 커밋하지 마세요.
2. **권한**: VPN 컨테이너는 `NET_ADMIN`과 `SYS_MODULE` 권한이 필요합니다.
3. **Kernel 모듈**: WireGuard kernel 모듈이 호스트에 설치되어 있어야 합니다.

## 문제 해결

### VPN 연결 실패
```bash
# VPN 로그 확인
docker-compose -f docker-compose.prod.yml logs vpn

# VPN 컨테이너 재시작
docker-compose -f docker-compose.prod.yml restart vpn
```

### WireGuard 모듈 없음 오류
```bash
# Ubuntu/Debian
sudo apt-get install wireguard

# 모듈 로드 확인
lsmod | grep wireguard
```

### 서비스가 VPN을 통하지 않는 경우
```bash
# api 컨테이너에서 IP 확인
docker exec rag-api curl -s ifconfig.me

# 네덜란드 IP가 아니면 VPN 컨테이너 재시작
docker-compose -f docker-compose.prod.yml restart vpn api celery
```

## VPN 비활성화 (임시)

VPN 없이 실행하려면 docker-compose 파일에서 다음을 수정:
- `api`와 `celery`의 `network_mode: "service:vpn"` 제거
- `depends_on`에서 `vpn` 관련 설정 제거
- `vpn` 서비스 전체 주석 처리
