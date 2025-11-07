#!/bin/bash

# Ollama 모델 초기화 스크립트
# 이 스크립트는 필요한 Ollama 모델을 자동으로 다운로드합니다.

set -e

echo "Ollama 모델 초기화를 시작..."

# Ollama 컨테이너가 실행 중인지 확인
if ! docker ps | grep -q rag-ollama; then
    echo "Ollama 컨테이너가 실행되고 있지 않습니다."
    echo " 'docker compose -f docker-compose.prod.yml up -d' 를 실행하세요."
    exit 1
fi

echo "Ollama 컨테이너 실행 확인"

# 서비스 안정화 대기
echo "Ollama 준비 대기 중..."
sleep 5

# bge-m3 임베딩 모델 확인/설치
if docker exec rag-ollama ollama list | grep -q "bge-m3"; then
    echo "bge-m3 모델이 이미 존재합니다."
else
    echo "?? bge-m3 임베딩 모델 다운로드 중... (~1.2GB, 1?2분 소요)"
    docker exec rag-ollama ollama pull bge-m3
    echo "bge-m3 모델 다운로드 완료"
fi

# qwen2.5:7b LLM 모델 확인/설치
if docker exec rag-ollama ollama list | grep -q "qwen2.5:7b"; then
    echo "qwen2.5:7b 모델이 이미 존재합니다."
else
    echo "qwen2.5:7b LLM 모델 다운로드 중... (~4.7GB, 5?7분 소요)"
    docker exec rag-ollama ollama pull qwen2.5:7b
    echo "qwen2.5:7b 모델 다운로드 완료"
fi

echo ""
echo "Ollama 모델 초기화가 완료되었습니다!"
echo ""
echo "현재 설치된 모델 목록:"
docker exec rag-ollama ollama list
