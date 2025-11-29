from typing import List, Tuple, Optional
import structlog
from langchain_ollama import OllamaEmbeddings
from langchain_openai import ChatOpenAI
from langchain.schema import SystemMessage, HumanMessage
from qdrant_client import QdrantClient
from supabase_client import supabase

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
    
    async def get_answer(self, question: str, mode: str = "filter", user_id: str = "anonymous") -> Tuple[str, List[str]]:
        """
        Get answer for a question using RAG
        Args:
            question: User's question
            mode: Search mode - "filter" (strict) or "expand" (flexible)
            user_id: User ID for personalized search
        Returns: (answer, sources)
        """
        try:
            # Get user preferences for department-based search
            department_info = await self._get_user_department_info(user_id)
            department_urls = department_info["urls"]
            department_names = department_info["departments"]

            # Enhance query with department info for better search results
            enhanced_question = question
            if department_info["enabled"] and department_names:
                # Add department context to search query
                dept_context = " ".join(department_names)
                enhanced_question = f"{dept_context} {question}"
                logger.info(
                    "Enhanced search query with departments",
                    original=question,
                    enhanced=enhanced_question,
                    departments=department_names
                )

            # Get query embedding (use enhanced question for better matching)
            query_embedding = self._get_embedding(enhanced_question)

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
                    return "죄송합니다. 충분히 관련성 높은 정보를 찾을 수 없습니다. 확장 모드를 사용하시거나 질문을 더 구체적으로 해주세요.", []

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
                return "죄송합니다. 충분히 관련성 높은 정보를 찾을 수 없습니다. 확장 모드를 사용하시거나 질문을 더 구체적으로 해주세요.", []

            # Apply department boosting if enabled
            if department_info["enabled"] and (department_urls or department_names):
                search_results = self._apply_department_boosting(
                    search_results,
                    department_urls,
                    department_names
                )

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
            answer = await self._generate_answer(
                context,
                question,
                mode,
                department_names if department_info["enabled"] else None
            )

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
    
    async def _get_user_department_info(self, user_id: str) -> dict:
        """Get user's preferred department information from database"""
        try:
            # Get user preferences
            response = supabase.table("user_preferences").select("*").eq("user_id", user_id).execute()

            if not response.data or len(response.data) == 0:
                return {"enabled": False, "departments": [], "urls": []}

            user_prefs = response.data[0]

            # Check if department search is enabled
            if not user_prefs.get("department_search_enabled", False):
                return {"enabled": False, "departments": [], "urls": []}

            # Get enabled departments
            departments = user_prefs.get("preferred_departments", [])
            enabled_depts = [
                dept
                for dept in departments
                if dept.get("enabled", True)
            ]

            # Extract names and URLs separately
            dept_names = [dept.get("name") for dept in enabled_depts if dept.get("name")]
            dept_urls = [dept.get("url") for dept in enabled_depts if dept.get("url")]

            logger.info(
                "User department info loaded",
                user_id=user_id,
                department_names=dept_names,
                url_count=len(dept_urls)
            )

            return {
                "enabled": True,
                "departments": dept_names,
                "urls": dept_urls
            }

        except Exception as e:
            logger.error("Failed to get user department info", user_id=user_id, error=str(e))
            return {"enabled": False, "departments": [], "urls": []}

    def _apply_department_boosting(
        self,
        search_results: List,
        department_urls: List[str],
        department_names: List[str]
    ) -> List:
        """
        Apply boosting to search results from preferred departments
        전공 URL 또는 전공 이름에 해당하는 결과에 가중치를 적용하여 최우선으로 정렬
        """
        try:
            department_results = []
            other_results = []

            for result in search_results:
                result_url = result.payload.get("url", "")
                result_text = result.payload.get("text", "")

                is_from_department = False

                # Check if result is from a preferred department URL
                if department_urls:
                    is_from_department = any(
                        dept_url and (dept_url in result_url or result_url in dept_url)
                        for dept_url in department_urls
                    )

                # If not matched by URL, check by department name in text or URL
                if not is_from_department and department_names:
                    # Check if any department name appears in the URL or text
                    for dept_name in department_names:
                        # Remove common suffixes for matching
                        dept_name_core = dept_name.replace("과", "").replace("학과", "").replace("학부", "").replace("전공", "").strip()

                        # Check in URL and text
                        if dept_name_core and (
                            dept_name_core in result_url or
                            dept_name_core in result_text or
                            dept_name in result_text
                        ):
                            is_from_department = True
                            break

                if is_from_department:
                    # Boost score by multiplying by 2.0 (강력한 우선순위 부여)
                    result.score = result.score * 2.0
                    department_results.append(result)
                else:
                    other_results.append(result)

            # Sort department results by score
            department_results.sort(key=lambda x: x.score, reverse=True)
            other_results.sort(key=lambda x: x.score, reverse=True)

            # Combine: department results first, then others
            boosted_results = department_results + other_results

            logger.info(
                "Applied department boosting",
                total_results=len(boosted_results),
                department_results=len(department_results),
                other_results=len(other_results),
                department_names=department_names
            )

            return boosted_results

        except Exception as e:
            logger.error("Failed to apply department boosting", error=str(e))
            return search_results

    async def _generate_answer(
        self,
        context: str,
        question: str,
        mode: str = "filter",
        user_departments: List[str] = None
    ) -> str:
        """Generate answer using GPT"""

        # Build user context info
        user_context = ""
        if user_departments:
            dept_list = ", ".join(user_departments)
            user_context = f"""**[사용자 전공 정보]**
이 사용자는 다음 전공/학과에 관심이 있습니다: {dept_list}
장학금, 수강신청, 학사일정, 프로그램 등의 정보를 제공할 때 이 전공/학과와 관련된 내용을 우선적으로 언급해주세요.
단, 해당 전공 정보가 없어도 일반적인 정보는 제공해야 합니다.

"""

        # Adjust system prompt based on mode
        if mode == "expand":
            system_prompt = f"""**[언어 규칙 - 최우선 준수]**
- 사용자가 질문한 언어로 답변하세요
- 한국어 질문 → 한국어 답변 (절대 중국어/영어 사용 금지)
- 영어 질문 → 영어 답변
- 다른 언어로 답변하면 안 됩니다

{user_context}당신은 학교 웹사이트 정보를 안내하는 Q&A 챗봇입니다.
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
            system_prompt = f"""**[언어 규칙 - 최우선 준수]**
- 사용자가 질문한 언어로 답변하세요
- 한국어 질문 → 한국어 답변 (절대 중국어/영어 사용 금지)
- 영어 질문 → 영어 답변
- 다른 언어로 답변하면 안 됩니다

{user_context}당신은 학교 웹사이트 정보를 안내하는 Q&A 챗봇입니다.

**[CRITICAL - 필터 모드 엄격 규칙]**
이 모드는 "필터 모드"로, 다음 규칙을 절대적으로 준수해야 합니다:

1. **외부 지식 사용 절대 금지**:
   - 당신이 사전에 학습한 어떤 정보도 사용하지 마세요
   - 오직 아래 [컨텍스트] 섹션에 명시적으로 작성된 내용만 사용하세요
   - 일반 상식, 다른 대학 정보, 추론 등 일체 금지

2. **컨텍스트 외 정보 처리**:
   - 컨텍스트에 답변이 명확히 없으면: "죄송합니다. 충분히 관련성 높은 정보를 찾을 수 없습니다. 확장 모드를 사용하시거나 질문을 더 구체적으로 해주세요."
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