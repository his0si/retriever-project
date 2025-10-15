# RAG Chatbot Backend

백엔드 API 서버입니다. FastAPI를 사용하여 구축되었으며, 학교 웹사이트 크롤링과 RAG 기반 Q&A 기능을 제공합니다.

## 프로젝트 구조

```
backend/
├── api/                    # API 관련 모듈
│   ├── models/            # Pydantic 모델 정의
│   │   ├── requests.py    # 요청 모델
│   │   └── responses.py   # 응답 모델
│   └── routes/            # API 라우트
│       ├── chat.py        # 채팅 관련 엔드포인트
│       ├── crawl.py       # 크롤링 관련 엔드포인트
│       ├── database.py    # 데이터베이스 상태 엔드포인트
│       └── health.py      # 헬스체크 엔드포인트
├── services/              # 비즈니스 로직
│   └── rag.py            # RAG 서비스 구현
├── tasks/                 # Celery 비동기 작업
│   ├── crawler.py        # 웹 크롤링 작업
│   └── embeddings.py     # 임베딩 생성 작업
├── utils/                 # 유틸리티 함수
├── main.py               # FastAPI 앱 진입점
├── config.py             # 설정 관리
├── celery_app.py         # Celery 앱 설정
└── crawl_sites.json      # 크롤링 대상 사이트 설정
```

## 주요 기능

### 1. 채팅 API (`/chat`)
- RAG 기반 질의응답
- 소스 링크 제공

### 2. 크롤링 API (`/crawl`)
- 수동 크롤링: 특정 URL 크롤링
- 자동 크롤링: 사전 정의된 사이트 일괄 크롤링
- 크롤링 상태 확인

### 3. 데이터베이스 API (`/db`)
- Qdrant 벡터 DB 상태 확인
- 최근 크롤링 정보 조회

## 환경 변수

`.env` 파일에 다음 설정이 필요합니다:

```bash
# API 서버 설정
API_HOST=0.0.0.0
API_PORT=8000

# Qdrant 설정
QDRANT_HOST=qdrant
QDRANT_PORT=6333
QDRANT_COLLECTION_NAME=school_documents

# OpenAI 설정
OPENAI_API_KEY=your-api-key

# Redis 설정
REDIS_URL=redis://redis:6379/0

# CORS 설정
CORS_ORIGINS=["http://localhost:3000"]
```

## 실행 방법

### 개발 환경
```bash
# 의존성 설치
pip install -r requirements.txt

# API 서버 실행
python main.py

# Celery 워커 실행 (별도 터미널)
celery -A celery_app worker --loglevel=info
```

### 프로덕션 환경
Docker Compose를 사용하여 실행됩니다.

## API 문서

서버 실행 후 다음 URL에서 확인 가능:
- Swagger UI: http://localhost:8000/docs
- ReDoc: http://localhost:8000/redoc