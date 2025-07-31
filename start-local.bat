@echo off
REM 로컬 개발 환경 시작 스크립트

echo Starting local development environment...
echo Using .env.local for environment variables

REM .env.local을 사용하여 docker-compose 실행
docker compose --env-file .env.local -f docker-compose.dev.yml up -d

echo.
echo Services started:
echo - Frontend: http://localhost:3000
echo - Backend API: http://localhost:8000
echo - API Docs: http://localhost:8000/docs
echo - RabbitMQ: http://localhost:15672
echo - Qdrant: http://localhost:6333/dashboard
echo.
echo To stop: docker compose -f docker-compose.dev.yml down