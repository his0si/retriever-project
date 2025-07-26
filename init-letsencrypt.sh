#!/bin/bash

# 도메인과 이메일 설정
domains=(retrieverproject.duckdns.org)
rsa_key_size=4096
data_path="./certbot"
email="his0si2276@gmail.com" # 실제 이메일로 변경 필요
staging=0 # 실제 운영용 인증서 발급

# 기존 데이터가 있으면 백업
if [ -d "$data_path" ]; then
  read -p "기존 인증서 데이터가 있습니다. 계속하시겠습니까? (y/N) " decision
  if [ "$decision" != "Y" ] && [ "$decision" != "y" ]; then
    exit
  fi
fi

# 필요한 디렉토리 생성
echo "### 필요한 디렉토리 생성..."
mkdir -p "$data_path/conf"
mkdir -p "$data_path/www"

# TLS 파라미터 다운로드
if [ ! -e "$data_path/conf/options-ssl-nginx.conf" ] || [ ! -e "$data_path/conf/ssl-dhparams.pem" ]; then
  echo "### TLS 파라미터 다운로드..."
  curl -s https://raw.githubusercontent.com/certbot/certbot/master/certbot-nginx/certbot_nginx/_internal/tls_configs/options-ssl-nginx.conf > "$data_path/conf/options-ssl-nginx.conf"
  curl -s https://raw.githubusercontent.com/certbot/certbot/master/certbot/certbot/ssl-dhparams.pem > "$data_path/conf/ssl-dhparams.pem"
fi


# nginx 시작 (초기 설정으로)
echo "### Nginx 시작..."
docker-compose -f docker-compose.prod.yml up -d nginx

# Let's Encrypt 인증서 요청
echo "### Let's Encrypt 인증서 요청..."
domain_args=""
for domain in "${domains[@]}"; do
  domain_args="$domain_args -d $domain"
done

# staging 옵션 설정
case "$staging" in
  1) staging_arg="--staging" ;;
  *) staging_arg="" ;;
esac

docker run --rm \
  -v "$(pwd)/$data_path/www:/var/www/certbot" \
  -v "$(pwd)/$data_path/conf:/etc/letsencrypt" \
  certbot/certbot certonly --webroot \
    -w /var/www/certbot \
    $staging_arg \
    --email $email \
    --agree-tos \
    --no-eff-email \
    --force-renewal \
    $domain_args

# nginx 재시작
echo "### Nginx 재시작..."
docker-compose -f docker-compose.prod.yml restart nginx

echo "### 완료!"