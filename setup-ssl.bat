@echo off
echo SSL 인증서 설정을 시작합니다...

REM 이메일 주소를 실제 이메일로 변경하세요
set EMAIL=your-email@example.com
set DOMAIN=retrieverproject.duckdns.org

echo.
echo 1. Certbot을 설치합니다...
echo    WSL이나 Linux 환경에서 다음 명령어를 실행하세요:
echo    sudo apt update
echo    sudo apt install -y certbot python3-certbot-nginx
echo.

echo 2. SSL 디렉토리를 생성합니다...
if not exist ssl mkdir ssl

echo.
echo 3. Let's Encrypt 인증서를 발급받습니다...
echo    다음 명령어를 실행하세요:
echo    sudo certbot certonly --standalone --email %EMAIL% --agree-tos --no-eff-email -d %DOMAIN%
echo.

echo 4. 인증서 파일을 복사합니다...
echo    다음 명령어를 실행하세요:
echo    sudo cp /etc/letsencrypt/live/%DOMAIN%/fullchain.pem ssl/
echo    sudo cp /etc/letsencrypt/live/%DOMAIN%/privkey.pem ssl/
echo    sudo chown $USER:$USER ssl/*
echo    sudo chmod 600 ssl/*
echo.

echo 5. 서비스를 시작합니다...
echo    다음 명령어를 실행하세요:
echo    docker-compose -f docker-compose.prod.yml up -d
echo.

echo SSL 인증서 설정이 완료되었습니다!
pause 