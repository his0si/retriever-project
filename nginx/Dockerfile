FROM nginx:alpine

# 필요한 패키지 설치
RUN apk add --no-cache \
    openssl \
    certbot \
    certbot-nginx \
    python3 \
    py3-pip \
    bash \
    wget

# SSL 디렉토리 생성
RUN mkdir -p /etc/nginx/ssl

# nginx 설정 파일 복사
COPY nginx.conf /etc/nginx/nginx.conf

# Let's Encrypt SSL 인증서 자동 발급 스크립트
COPY generate-ssl-letsencrypt.sh /docker-entrypoint.d/01-generate-ssl.sh
RUN chmod +x /docker-entrypoint.d/01-generate-ssl.sh

# 포트 노출
EXPOSE 80 443

# nginx 실행
CMD ["nginx", "-g", "daemon off;"]