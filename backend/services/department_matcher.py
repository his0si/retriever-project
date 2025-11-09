"""
AI를 활용한 전공 이름 매칭 서비스
사용자가 입력한 전공 이름을 DB에 있는 URL과 매칭합니다.
"""
from typing import Optional
import structlog
import asyncio
from langchain_openai import ChatOpenAI
from langchain.schema import SystemMessage, HumanMessage
from qdrant_client import QdrantClient
from config import settings

logger = structlog.get_logger()


class DepartmentMatcher:
    """전공 이름을 URL로 매칭하는 서비스"""

    def __init__(self):
        self.qdrant_client = QdrantClient(
            url=settings.qdrant_host,
            api_key=settings.qdrant_api_key
        )

        self.llm = ChatOpenAI(
            model="gpt-4o-mini",
            temperature=0,  # 정확한 매칭을 위해 temperature 0
            api_key=settings.openai_api_key
        )

    async def match_department_to_url(self, department_name: str) -> Optional[str]:
        """
        전공 이름을 입력받아 DB에서 해당 전공의 URL을 찾습니다.

        Args:
            department_name: 사용자가 입력한 전공 이름 (예: "전기전자공학부", "컴퓨터공학과")

        Returns:
            매칭된 URL 또는 None
        """
        try:
            logger.info("전공 매칭 시작", department_name=department_name)

            # Add timeout to prevent hanging (30 seconds)
            async with asyncio.timeout(30):
                # 1. Qdrant에서 모든 고유 URL 가져오기
                urls = await self._get_all_unique_urls()

                if not urls:
                    logger.warning("DB에 URL이 없습니다")
                    return None

                # 2. URL 중에서 전공 관련 URL만 필터링 (학과 홈페이지로 보이는 것들)
                department_urls = [url for url in urls if self._is_department_url(url)]

                logger.info("전공 URL 필터링 완료", total_urls=len(urls), department_urls=len(department_urls))

                if not department_urls:
                    logger.warning("전공 관련 URL을 찾을 수 없습니다")
                    return None

                # 3. AI를 사용하여 입력한 전공 이름과 가장 일치하는 URL 찾기
                matched_url = await self._match_with_ai(department_name, department_urls)

                if matched_url:
                    logger.info("전공 매칭 성공", department_name=department_name, matched_url=matched_url)
                else:
                    logger.warning("전공 매칭 실패", department_name=department_name)

                return matched_url

        except asyncio.TimeoutError:
            logger.error("전공 매칭 타임아웃 (30초 초과)", department_name=department_name)
            return None
        except Exception as e:
            logger.error("전공 매칭 중 오류 발생", department_name=department_name, error=str(e))
            return None

    async def _get_all_unique_urls(self) -> list[str]:
        """Qdrant에서 모든 고유 URL을 가져옵니다 (최대 1000개까지만)"""
        try:
            urls = set()
            offset = None
            max_iterations = 10  # 최대 10번 반복 (100 * 10 = 1000 documents)
            iteration = 0

            def scroll_sync():
                """동기 스크롤 작업을 별도 함수로 분리"""
                nonlocal offset, iteration
                local_urls = set()

                while iteration < max_iterations:
                    result = self.qdrant_client.scroll(
                        collection_name=settings.qdrant_collection_name,
                        limit=100,
                        offset=offset,
                        with_payload=True,
                        with_vectors=False
                    )

                    points, next_offset = result

                    if not points:
                        break

                    for point in points:
                        url = point.payload.get("url")
                        if url:
                            local_urls.add(url)

                    iteration += 1

                    if next_offset is None:
                        break

                    offset = next_offset

                return local_urls

            # Run blocking operation in thread pool
            loop = asyncio.get_event_loop()
            urls = await loop.run_in_executor(None, scroll_sync)

            logger.info("URL 가져오기 완료", url_count=len(urls), iterations=iteration)
            return list(urls)

        except Exception as e:
            logger.error("URL 가져오기 실패", error=str(e))
            return []

    def _is_department_url(self, url: str) -> bool:
        """URL이 전공/학과 홈페이지인지 판단합니다"""
        # 학과/전공 관련 키워드
        department_keywords = [
            "dept", "department", "major", "college",
            "학과", "전공", "학부", "단과대", "대학",
            # 일반적인 학과 이름들
            "computer", "software", "electrical", "electronic",
            "mechanical", "chemical", "civil", "architecture",
            "business", "economics", "law", "medical",
            "nursing", "pharmacy", "engineering", "science",
            "arts", "humanities", "education", "social",
            "컴퓨터", "소프트웨어", "전자", "전기",
            "기계", "화공", "토목", "건축",
            "경영", "경제", "법학", "의학",
            "간호", "약학", "공학", "이과",
            "인문", "교육", "사회", "예술"
        ]

        url_lower = url.lower()
        return any(keyword in url_lower for keyword in department_keywords)

    async def _match_with_ai(self, department_name: str, candidate_urls: list[str]) -> Optional[str]:
        """AI를 사용하여 전공 이름과 URL을 매칭합니다"""
        try:
            # URL 리스트를 문자열로 변환 (최대 50개까지만)
            urls_text = "\n".join([f"{i+1}. {url}" for i, url in enumerate(candidate_urls[:50])])

            system_prompt = """당신은 대학 전공/학과 이름을 URL과 매칭하는 전문가입니다.

사용자가 입력한 전공 이름과 가장 일치하는 URL을 찾아주세요.

**매칭 규칙:**
1. 전공 이름이 URL에 직접 포함되어 있는 경우를 최우선으로 합니다
2. 유사한 표현도 고려합니다 (예: "전기전자공학부" ↔ "전자전기공학과", "컴공" ↔ "컴퓨터공학")
3. 영문과 한글 표기를 모두 고려합니다
4. 학부/학과/전공의 차이는 무시합니다

**응답 형식:**
- 매칭되는 URL이 있으면: 해당 URL만 정확히 출력 (번호나 다른 텍스트 없이)
- 매칭되는 URL이 없으면: "NONE" 출력

예시:
입력: "컴퓨터공학과"
URL 목록에 "https://cs.ewha.ac.kr" 이 있다면
출력: https://cs.ewha.ac.kr
"""

            user_message = f"""전공 이름: {department_name}

URL 목록:
{urls_text}

위 URL 중에서 "{department_name}"와 가장 일치하는 URL을 찾아주세요."""

            messages = [
                SystemMessage(content=system_prompt),
                HumanMessage(content=user_message)
            ]

            response = await self.llm.ainvoke(messages)
            result = response.content.strip()

            # "NONE"이 아니고, 실제 URL 형식이면 반환
            if result != "NONE" and result.startswith("http"):
                # 정확히 일치하는 URL인지 확인
                for url in candidate_urls:
                    if result in url or url in result:
                        return url

            return None

        except Exception as e:
            logger.error("AI 매칭 실패", department_name=department_name, error=str(e))
            return None
