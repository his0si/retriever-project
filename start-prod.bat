@echo off
REM 프로덕션 배포 환경 시작 스크립트

echo Starting production environment...
echo Using .env for environment variables

REM .env를 사용하여 docker-compose 실행
docker compose --env-file .env -f docker-compose.prod.yml up -d

echo.
echo Services started:
echo - Website: https://retrieverproject.duckdns.org
echo.
echo To stop: docker compose -f docker-compose.prod.yml down