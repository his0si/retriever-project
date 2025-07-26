@echo off
chcp 65001 > nul
echo 🚀 Retriever Project 자동 설치 스크립트 (Windows)
echo ==================================

:: Docker 실행 확인
echo 🐳 Docker 확인 중...
docker --version >nul 2>&1
if errorlevel 1 (
    echo ❌ Docker가 설치되지 않았습니다!
    echo Docker Desktop을 먼저 설치해주세요: https://www.docker.com/products/docker-desktop
    pause
    exit /b 1
)

:: 기존 컨테이너 정리
echo 🧹 기존 컨테이너 정리 중...
docker-compose down 2>nul

:: .env 파일 확인
echo ⚙️ 환경 설정 확인 중...
if not exist .env (
    echo ❌ .env 파일이 없습니다! 기본 설정을 사용합니다.
    copy .env.example .env 2>nul
)

:: 빌드 및 실행
echo 🏗️ Docker 이미지 빌드 중...
docker-compose build

echo 🚀 서비스 시작 중...
docker-compose up -d

:: 상태 확인
echo 📊 서비스 상태 확인 중...
timeout /t 10 >nul
docker ps

echo.
echo 🎉 설치 완료!
echo.
echo 접속 정보:
echo - HTTP: http://localhost
echo - HTTPS: https://localhost (자체 서명 인증서)
echo.
echo 관리자 로그인:
echo - ID: admin
echo - PW: 1886
echo.
echo 로그 확인: docker-compose logs -f
echo 종료: docker-compose down
echo.
pause