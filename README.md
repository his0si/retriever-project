# retriever project

학교 웹사이트의 분산된 정보를 크롤링하고 RAG (Retrieval-Augmented Generation) 기반 챗봇을 통해 질문에 답변하는 시스템입니다.

## 시스템 구성

- **Backend**: FastAPI + Celery + Playwright
- **Vector DB**: Qdrant
- **Message Queue**: RabbitMQ
- **Cache**: Redis
- **Frontend**: Next.js
- **LLM**: OpenAI GPT-4

## 시작하기

### 1. 환경 변수 설정

```bash
cp .env.example .env
```

`.env` 파일을 열고 `OPENAI_API_KEY`를 설정하세요.

### 2. Docker 서비스 시작

```bash
docker-compose up -d
```

### 3. Backend 설정

```bash
cd backend
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate
pip install -r requirements.txt
playwright install chromium
```

### 4. Celery Worker 시작

```bash
# Terminal 1 - Celery Worker
cd backend
celery -A celery_app worker --loglevel=info
```

### 5. FastAPI 서버 시작

```bash
# Terminal 2 - API Server
cd backend
python main.py
```

### 6. Frontend 시작

```bash
# Terminal 3 - Frontend
cd frontend
npm install
npm run dev
```

## API 사용법

### 크롤링 시작

```bash
curl -X POST http://localhost:8000/crawl \
  -H "Content-Type: application/json" \
  -d '{
    "root_url": "https://example-school.edu",
    "max_depth": 2
  }'
```

### 질문하기

```bash
curl -X POST http://localhost:8000/chat \
  -H "Content-Type: application/json" \
  -d '{
    "question": "입학 절차는 어떻게 되나요?"
  }'
```

## 모니터링

- RabbitMQ Management: http://localhost:15672
- Qdrant Dashboard: http://localhost:6333/dashboard
- API Docs: http://localhost:8000/docs


##  자동 크롤링 사이트 관리

### 크롤링 사이트 설정

크롤링할 사이트는 `backend/crawl_sites.json` 파일에서 관리됩니다.

```json
{
  "sites": [
    {
      "name": "이화여대 컴공과 메인",
      "url": "https://cse.ewha.ac.kr/cse/index.do",
      "description": "학과 소개 및 주요 정보",
      "enabled": true
    }
  ]
}
```

### 사이트 추가/수정 방법

1. `backend/crawl_sites.json` 파일 편집
2. 새 사이트 추가:
   ```json
   {
     "name": "새 사이트명",
     "url": "https://example.com",
     "description": "사이트 설명",
     "enabled": true
   }
   ```
3. 사이트 비활성화: `"enabled": false`로 설정
4. 백엔드 재시작 (자동으로 새 설정 반영)

### 자동 크롤링 설정

- **주기**: 매일 새벽 2시 (환경변수 `CRAWL_SCHEDULE`로 변경 가능)
- **깊이**: 2단계 하위 링크까지 탐색
- **중복 방지**: 콘텐츠 해시 기반 변경 감지