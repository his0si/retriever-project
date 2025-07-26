FROM nginx:alpine

# OpenSSL 설치 (Alpine Linux에는 기본적으로 포함되어 있음)
RUN apk add --no-cache openssl

# SSL 디렉토리 생성
RUN mkdir -p /etc/nginx/ssl

# 자체 서명 SSL 인증서 생성
RUN openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
    -keyout /etc/nginx/ssl/privkey.pem \
    -out /etc/nginx/ssl/fullchain.pem \
    -subj "/C=KR/ST=Seoul/L=Seoul/O=RetrieverProject/CN=retrieverproject.duckdns.org"

# 권한 설정
RUN chmod 600 /etc/nginx/ssl/privkey.pem && \
    chmod 644 /etc/nginx/ssl/fullchain.pem

# nginx 설정 파일 복사
COPY nginx.conf /etc/nginx/nginx.conf

# 포트 노출
EXPOSE 80 443

# nginx 실행
CMD ["nginx", "-g", "daemon off;"]