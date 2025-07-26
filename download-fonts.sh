#!/bin/bash

echo "📥 Pretendard 폰트 다운로드 중..."

# 폰트 디렉토리 생성
mkdir -p frontend/public/fonts

# Pretendard 폰트 파일들 다운로드
cd frontend/public/fonts

# Variable font
wget -O PretendardVariable.woff2 "https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.8/dist/web/variable/PretendardVariable.woff2"

# Static fonts
wget -O Pretendard-Thin.woff2 "https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.8/dist/web/static/Pretendard-Thin.woff2"
wget -O Pretendard-ExtraLight.woff2 "https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.8/dist/web/static/Pretendard-ExtraLight.woff2"
wget -O Pretendard-Light.woff2 "https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.8/dist/web/static/Pretendard-Light.woff2"
wget -O Pretendard-Regular.woff2 "https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.8/dist/web/static/Pretendard-Regular.woff2"
wget -O Pretendard-Medium.woff2 "https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.8/dist/web/static/Pretendard-Medium.woff2"
wget -O Pretendard-SemiBold.woff2 "https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.8/dist/web/static/Pretendard-SemiBold.woff2"
wget -O Pretendard-Bold.woff2 "https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.8/dist/web/static/Pretendard-Bold.woff2"
wget -O Pretendard-ExtraBold.woff2 "https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.8/dist/web/static/Pretendard-ExtraBold.woff2"
wget -O Pretendard-Black.woff2 "https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.8/dist/web/static/Pretendard-Black.woff2"

cd ../../..

echo "✅ 폰트 다운로드 완료!"
echo "이제 로컬에서 폰트를 제공하므로 CSP 오류가 해결됩니다." 