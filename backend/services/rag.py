from typing import List, Tuple
import structlog
from langchain_ollama import OllamaEmbeddings
from langchain_openai import ChatOpenAI
from langchain.schema import SystemMessage, HumanMessage
from qdrant_client import QdrantClient

from config import settings

logger = structlog.get_logger()


class RAGService:
    """RAG service for question answering"""

    def __init__(self):
        self.qdrant_client = QdrantClient(
            url=settings.qdrant_host,
            api_key=settings.qdrant_api_key
        )

        # Use OpenAI for chatbot responses (better accuracy)
        self.llm = ChatOpenAI(
            model="gpt-4o-mini",  # Cost-effective and accurate
            temperature=settings.llm_temperature,
            api_key=settings.openai_api_key
        )

        # Keep Ollama for embeddings (cost-effective)
        self.embeddings_client = OllamaEmbeddings(
            model=settings.ollama_embedding_model,
            base_url=settings.ollama_host
        )
    
    async def get_answer(self, question: str, mode: str = "filter") -> Tuple[str, List[str]]:
        """
        Get answer for a question using RAG
        Args:
            question: User's question
            mode: Search mode - "filter" (strict) or "expand" (flexible)
        Returns: (answer, sources)
        """
        try:
            # Get query embedding
            query_embedding = self._get_embedding(question)

            # Adjust search parameters based on mode
            if mode == "expand":
                # Expand mode: retrieve more documents for broader context
                limit = settings.top_k * 3
                score_threshold = 0.2  # Very low threshold for maximum coverage
            else:
                # Filter mode: STRICT - only highly relevant documents
                limit = settings.top_k * 2
                score_threshold = 0.5  # Higher threshold to ensure relevance
                min_results = 2  # Minimum number of results required

            # Search similar documents
            search_results = self.qdrant_client.search(
                collection_name=settings.qdrant_collection_name,
                query_vector=query_embedding,
                limit=limit,
                score_threshold=score_threshold
            )

            # Log search results for debugging
            logger.info(
                "Search results",
                question=question,
                mode=mode,
                num_results=len(search_results),
                scores=[f"{r.score:.4f}" for r in search_results[:3]],
                urls=[r.payload.get("url", "")[:50] for r in search_results[:3]]
            )

            # Filter mode: strict validation
            if mode == "filter":
                if not search_results or len(search_results) < min_results:
                    return "죄송합니다. 데이터베이스에서 관련된 정보를 찾을 수 없습니다. 질문을 다르게 표현하거나 확장 모드를 시도해보세요.", []

                # Additional check: ensure results have decent scores
                avg_score = sum(r.score for r in search_results) / len(search_results)
                if avg_score < 0.55:
                    return "죄송합니다. 충분히 관련성 높은 정보를 찾을 수 없습니다. 확장 모드를 사용하시거나 질문을 더 구체적으로 해주세요.", []

            # Expand mode: try again without threshold if no results
            if mode == "expand" and not search_results:
                search_results = self.qdrant_client.search(
                    collection_name=settings.qdrant_collection_name,
                    query_vector=query_embedding,
                    limit=limit
                )

            if not search_results:
                return "죄송합니다. 관련된 정보를 찾을 수 없습니다.", []

            # Extract documents and sources
            documents = []
            sources = set()

            for result in search_results:
                text = result.payload["text"]
                documents.append(text)
                sources.add(result.payload["url"])

                # Log if suspicious content is found
                if "경남" in text or "경북" in text or "부산" in text:
                    logger.warning(
                        "Suspicious content in search result",
                        score=result.score,
                        url=result.payload.get("url", ""),
                        text_preview=text[:100]
                    )

            # Build context
            context = "\n\n".join(documents)

            # Log context preview
            logger.info(
                "Context built",
                context_length=len(context),
                context_preview=context[:200]
            )

            # Generate answer using GPT
            answer = await self._generate_answer(context, question, mode)

            # Log if answer contains suspicious content
            if "경남" in answer or "경북" in answer or "부산" in answer:
                logger.error(
                    "⚠️ CRITICAL: Answer contains non-Ewha content!",
                    mode=mode,
                    question=question,
                    answer_preview=answer[:200],
                    context_preview=context[:200]
                )

            return answer, list(sources)

        except Exception as e:
            logger.error("Failed to get answer", question=question, mode=mode, error=str(e))
            raise
    
    def _get_embedding(self, text: str) -> List[float]:
        """Get embedding for text"""
        return self.embeddings_client.embed_query(text)
    
    async def _generate_answer(self, context: str, question: str, mode: str = "filter") -> str:
        """Generate answer using GPT"""

        # Adjust system prompt based on mode
        if mode == "expand":
            system_prompt = """**[언어 규칙 - 최우선 준수]**
- 사용자가 질문한 언어로 답변하세요
- 한국어 질문 → 한국어 답변 (절대 중국어/영어 사용 금지)
- 영어 질문 → 영어 답변
- 다른 언어로 답변하면 안 됩니다

당신은 학교 웹사이트 정보를 안내하는 Q&A 챗봇입니다.
주어진 '컨텍스트'를 기반으로 사용자의 '질문'에 답변하되, 보다 유연하고 포괄적으로 답변하세요.
컨텍스트의 정보를 바탕으로 합리적인 추론과 일반적인 대학 정보를 활용하여 답변할 수 있습니다.
다만, 추론이나 일반적 정보를 사용할 때는 "일반적으로", "보통", "추측하자면" 등의 표현을 사용하여 명확히 구분하세요.

**답변 형식 가이드:**

1. **마크다운 형식 필수 사용**
   - 여러 개의 정보(장학금, 프로그램, 일정, 연락처 등)는 반드시 표(table)로 정리
   - 항목이 3개 이상이면 표 형식 사용 권장

2. **표 작성 예시:**
```
| 항목명 | 내용 | 비고 |
|--------|------|------|
| 항목1 | 설명1 | 추가정보 |
| 항목2 | 설명2 | 추가정보 |
```

3. **구조화 규칙:**
   - 복잡한 답변: 제목(## 또는 ###) 사용하여 섹션 구분
   - 여러 단계: 번호 목록(1. 2. 3.) 사용
   - 단순 나열: 불릿 목록(- 또는 *) 사용
   - 중요 정보: **굵은 글씨** 강조

4. **줄바꿈 규칙:**
   - 문단 사이: 줄바꿈 1번만 사용
   - 표나 코드블록 전후: 줄바꿈 1번만 사용
   - 불필요한 빈 줄 최소화

5. **답변 스타일:**
   - 단순 질문(예: "~이 뭐야?", "~언제야?"): 간단한 줄글로 답변
   - 비교/선택 질문(예: "장학금 종류", "프로그램 목록"): 표 또는 목록 사용
   - 절차/방법 질문(예: "어떻게 신청해?", "절차는?"): 번호 목록 사용

답변은 친절하고 명확하게 작성하되, 학생들에게 유용한 정보를 제공하는 것을 목표로 하세요."""
        else:
            system_prompt = """**[언어 규칙 - 최우선 준수]**
- 사용자가 질문한 언어로 답변하세요
- 한국어 질문 → 한국어 답변 (절대 중국어/영어 사용 금지)
- 영어 질문 → 영어 답변
- 다른 언어로 답변하면 안 됩니다

당신은 학교 웹사이트 정보를 안내하는 Q&A 챗봇입니다.

**[CRITICAL - 필터 모드 엄격 규칙]**
이 모드는 "필터 모드"로, 다음 규칙을 절대적으로 준수해야 합니다:

1. **외부 지식 사용 절대 금지**:
   - 당신이 사전에 학습한 어떤 정보도 사용하지 마세요
   - 오직 아래 [컨텍스트] 섹션에 명시적으로 작성된 내용만 사용하세요
   - 일반 상식, 다른 대학 정보, 추론 등 일체 금지

2. **컨텍스트 외 정보 처리**:
   - 컨텍스트에 답변이 명확히 없으면: "죄송합니다. 제공된 자료에서 해당 정보를 찾을 수 없습니다."
   - 절대 다른 대학, 다른 기관의 정보로 대체하지 마세요
   - "일반적으로", "보통", "추측하자면" 같은 표현 사용 금지

3. **검증 방법**:
   - 답변하기 전에 반드시 컨텍스트에서 해당 내용을 찾았는지 확인
   - 컨텍스트에 명시되지 않은 세부사항 추가 금지
   - 모호하거나 확신이 없으면 "정보를 찾을 수 없습니다"라고 답변

**답변 형식 가이드:**

1. **마크다운 형식 필수 사용**
   - 여러 개의 정보(장학금, 프로그램, 일정, 연락처 등)는 반드시 표(table)로 정리
   - 항목이 3개 이상이면 표 형식 사용 권장

2. **표 작성 예시:**
```
| 항목명 | 내용 | 비고 |
|--------|------|------|
| 항목1 | 설명1 | 추가정보 |
| 항목2 | 설명2 | 추가정보 |
```

3. **구조화 규칙:**
   - 복잡한 답변: 제목(## 또는 ###) 사용하여 섹션 구분
   - 여러 단계: 번호 목록(1. 2. 3.) 사용
   - 단순 나열: 불릿 목록(- 또는 *) 사용
   - 중요 정보: **굵은 글씨** 강조

4. **줄바꿈 규칙:**
   - 문단 사이: 줄바꿈 1번만 사용
   - 표나 코드블록 전후: 줄바꿈 1번만 사용
   - 불필요한 빈 줄 최소화

5. **답변 스타일:**
   - 단순 질문(예: "~이 뭐야?", "~언제야?"): 간단한 줄글로 답변
   - 비교/선택 질문(예: "장학금 종류", "프로그램 목록"): 표 또는 목록 사용
   - 절차/방법 질문(예: "어떻게 신청해?", "절차는?"): 번호 목록 사용

**[다시 한 번 강조]**
- 반드시 제공된 컨텍스트에 명시된 정보만 사용하세요
- 컨텍스트에 없는 정보는 절대 답변하지 마세요
- 외부 지식이나 다른 대학/기관 정보 사용 절대 금지

답변은 친절하고 명확하게 작성하되, **오직 컨텍스트에 명시된 정보만** 정확하게 전달하세요."""

        messages = [
            SystemMessage(content=system_prompt),
            HumanMessage(content=f"""[컨텍스트]
{context}

[질문]
{question}""")
        ]

        response = await self.llm.ainvoke(messages)
        return response.content