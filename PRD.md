### **PRD: 학교 RAG 챗봇 MVP**

**작성일**: 2025-07-18

**1. 목표**
*   사용자가 학교 웹사이트의 분산된 정보를 일일이 찾지 않아도, 챗봇을 통해 쉽고 빠르게 질문하고 정확한 출처에 기반한 답변을 얻을 수 있는 RAG 챗봇 MVP를 개발한다.

**2. MVP 범위**

| 구분 | 기능 | 비고 |
| :--- | :--- | :--- |
| **API 서버** | **`POST /crawl` 엔드포인트** | 크롤링 작업을 트리거하는 API. <br> **Request**: `{"root_url": "https://...", "max_depth": 2}` <br> **Response**: `{"task_id": "..."}` |
| **크롤러** | Playwright 기반의 비동기 크롤러 (Celery Task) | 루트 URL 기준, 동일 도메인 내부 링크를 `max_depth`까지 재귀 탐색(BFS). <br> 수집된 유효 URL을 임베딩 처리 큐에 전송. <br> 중복 URL 및 외부 링크는 수집에서 제외. |
| **전처리·임베딩** | HTML 텍스트 추출, 분절 및 벡터화 (Celery Task) | **텍스트 추출**: BeautifulSoup4 사용. `<main>`, `<article>` 등 주요 태그 외 `nav`, `footer` 등 노이즈 제거. <br> **분절**: `RecursiveCharacterTextSplitter` 사용 (`chunk_size=1000`, `chunk_overlap=100`). <br> **저장**: OpenAI Embeddings API로 벡터화 후, 텍스트와 출처 URL 메타데이터를 함께 Qdrant에 저장. |
| **API 서버** | **`POST /chat` 엔드포인트** | **Request**: `{"question": "..."}` <br> **RAG 로직**: Qdrant에서 `top-k=5` 문서 검색 → 정의된 프롬프트 템플릿을 사용하여 **GPT**에 전달 → 답변 생성 <br> **Response**: `{"answer": "...", "sources": ["url1", "url2"]}` |
| **챗봇 UI** | Next.js 기반 단일 페이지 | 질문 입력창, 답변 표시 영역. <br> **UI 상태 관리**: 로딩(스피너), 에러(메시지) 상태 표시. <br> **출처 표시**: 답변 하단에 '관련 출처' 섹션과 클릭 가능한 링크 목록 표시. |

**3. 기술 스택**
*   **백엔드 & 크롤러**: Python 3.11, FastAPI, Playwright, BeautifulSoup4
*   **비동기 처리**: Celery + RabbitMQ
*   **벡터 DB**: Qdrant
*   **임베딩 & LLM**: **OpenAI `text-embedding-3-small` API + OpenAI `GPT-4.1 nano` API**
*   **프론트엔드**: Next.js + React

**4. 시스템 아키텍처 및 프롬프트**

```mermaid
graph TD
    subgraph User Interaction
        A(Next.js Chat UI)
    end

    subgraph API Server (FastAPI)
        B[POST /crawl]
        C[POST /chat]
    end

    subgraph Async Workers (Celery)
        D[Crawler Worker]
        E[Embedding Worker]
    end

    subgraph Data Stores
        F(RabbitMQ)
        G(Qdrant)
    end

    subgraph External APIs
        H(OpenAI Embedding API)
        I(OpenAI GPT API)
    end

    A -- Crawl Request --> B
    A -- Chat Request --> C

    B -- Enqueue Crawl Task --> F
    F -- Crawl Task --> D
    D -- Fetches URL & Enqueues for Embedding --> F
    F -- Embedding Task --> E
    E -- HTML Parsing & Chunking --> E
    E -- Embeddings Request --> H
    H -- Embeddings --> E
    E -- Store Vectors --> G

    C -- Similarity Search --> G
    G -- Retrieved Docs --> C
    C -- Generate Answer Request --> I
    I -- Generated Answer --> C
    C -- Answer & Sources --> A
```

*   **크롤링 흐름**: `POST /crawl` 호출 → Celery 크롤링 작업 생성 → 크롤러가 URL 수집 후 각 URL을 임베딩 큐에 전송 → 임베딩 워커가 큐에서 URL을 받아 처리 후 Qdrant에 저장.
*   **챗봇 흐름**: `POST /chat` 호출 → Qdrant 유사도 검색 → 검색된 문서를 컨텍스트로 **GPT API** 호출 → 결과와 출처를 UI에 반환.

#### **프롬프트 구조 (GPT-4.1-mini용)**
OpenAI의 Chat Completions API 형식에 맞춰 아래와 같은 메시지 목록으로 프롬프트를 구성합니다.

1.  **System Message** (챗봇의 역할과 규칙 정의)
    ```json
    {
      "role": "system",
      "content": "당신은 학교 웹사이트 정보를 안내하는 Q&A 챗봇입니다. 반드시 주어진 '컨텍스트' 내용만을 사용하여 사용자의 '질문'에 답변해야 합니다. 컨텍스트에 없는 내용은 '정보를 찾을 수 없습니다.'라고 답변하세요. 답변의 끝에는 반드시 [출처: URL] 형식으로 관련 정보의 출처 URL을 명시해야 합니다."
    }
    ```

2.  **User Message** (검색된 컨텍스트와 사용자 질문 전달)
    ```json
    {
      "role": "user",
      "content": "[컨텍스트]\n{retrieved_documents}\n\n[질문]\n{user_question}"
    }
    ```

**5. 개발 단계 및 일정 (총 2주)**

| 단계 | 작업 내용 | 기간 |
| :--- | :--- | :--- |
| 1 | **환경 설정 & 구조 정의**: Docker-compose 설정, FastAPI/Next.js 기본 구조, Celery/Qdrant 연동 확인. | 1일 |
| 2 | **크롤러 & 워커 구현**: `POST /crawl` 엔드포인트, URL 수집 로직, Celery 큐잉 구현. | 3일 |
| 3 | **임베딩 파이프라인**: 임베딩 워커 구현 (HTML 파싱, 텍스트 분절, OpenAI API 연동, Qdrant 저장). | 3일 |
| 4 | **RAG 챗봇 API 구현**: `POST /chat` 엔드포인트, Qdrant 검색, **GPT 프롬프트 구성** 및 API 연동. | 2일 |
| 5 | **챗봇 UI 구현**: 기본 UI/UX, API 연동, 로딩/에러/출처 표시 기능 구현. | 3일 |
| 6 | **통합 테스트 & 데모 준비**: 전체 흐름 테스트, 예외 상황 처리 검증, 성능 튜닝. | 2일 |

**6. 성공 기준**
*   **기능**: 루트 URL과 depth를 입력하면 전체 RAG 파이프라인(크롤링 → 임베딩 → 검색 → 답변)이 정상 작동한다.
*   **성능**: `/chat` 엔드포인트의 평균 응답 시간이 2초 이내이다 (단일 사용자 기준).
*   **품질**:
    *   챗봇의 답변은 제공된 컨텍스트(출처)에 충실하며, 환각(Hallucination)이 거의 발생하지 않는다.
    *   답변과 함께 제공되는 출처 URL은 내용과 높은 관련성을 가진다.
*   **안정성**: 크롤링 중 404/500 에러가 발생한 페이지는 건너뛰고, 전체 프로세스는 중단되지 않는다.
