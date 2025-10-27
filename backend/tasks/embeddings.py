from celery import Task
from celery_app import celery_app
import httpx
from bs4 import BeautifulSoup
import structlog
from langchain_text_splitters import RecursiveCharacterTextSplitter
from langchain_openai import OpenAIEmbeddings
from qdrant_client import QdrantClient
from qdrant_client.models import Distance, VectorParams, PointStruct
import uuid
import hashlib
from datetime import datetime
import pytz
from openai import OpenAI

from config import settings

logger = structlog.get_logger()

# 한국 시간대 설정
KST = pytz.timezone('Asia/Seoul')

def get_kst_now():
    """한국 시간으로 현재 시간 반환"""
    return datetime.now(KST)


class EmbeddingTask(Task):
    """재시도 설정이 포함된 기본 임베딩 태스크"""
    autoretry_for = (Exception,)
    retry_kwargs = {'max_retries': 2, 'countdown': 5}  # 빠른 재시도
    retry_backoff = True
    rate_limit = '10/m'  # API 호출 속도 제한


# 클라이언트 초기화
qdrant_client = QdrantClient(
    url=settings.qdrant_host,
    api_key=settings.qdrant_api_key
)

# OpenAI 임베딩 클라이언트
embeddings = OpenAIEmbeddings(
    model=settings.embedding_model,
    openai_api_key=settings.openai_api_key
)

# GPT API 클라이언트 (마크다운 포맷팅용)
openai_client = OpenAI(api_key=settings.openai_api_key)

# 텍스트 분할기
text_splitter = RecursiveCharacterTextSplitter(
    chunk_size=settings.chunk_size,
    chunk_overlap=settings.chunk_overlap,
    length_function=len,
    separators=["\n\n", "\n", ". ", " ", ""]
)


@celery_app.task(base=EmbeddingTask, name="process_url_for_embedding")
def process_url_for_embedding(url: str):
    """
    URL을 처리: 콘텐츠 가져오기, GPT로 마크다운 포맷팅, 청킹, 임베딩 생성, 저장
    """
    logger.info("Processing URL for embedding", url=url)

    try:
        # 컬렉션 존재 확인
        ensure_collection_exists()

        # 텍스트 가져오기 및 GPT로 마크다운 포맷팅
        text_content = fetch_and_extract_text(url)

        if not text_content or len(text_content.strip()) < 50:
            logger.warning("Insufficient content", url=url, length=len(text_content))
            return {"status": "skipped", "url": url, "reason": "insufficient_content"}

        # 텍스트를 청크로 분할
        chunks = text_splitter.split_text(text_content)
        logger.info(f"Split into {len(chunks)} chunks", url=url)

        # 각 청크를 임베딩하고 저장
        points = []
        for idx, chunk in enumerate(chunks):
            # 임베딩 생성
            embedding = embeddings.embed_query(chunk)

            # 포인트 생성
            point_id = str(uuid.uuid4())
            point = PointStruct(
                id=point_id,
                vector=embedding,
                payload={
                    "text": chunk,
                    "url": url,
                    "chunk_index": idx,
                    "total_chunks": len(chunks),
                    "updated_at": str(get_kst_now())
                }
            )
            points.append(point)

        # Qdrant에 배치 업로드
        qdrant_client.upsert(
            collection_name=settings.qdrant_collection_name,
            points=points
        )

        logger.info(f"Stored {len(points)} embeddings", url=url)
        return {
            "status": "success",
            "url": url,
            "chunks_processed": len(chunks)
        }

    except Exception as e:
        logger.error("Failed to process URL", url=url, error=str(e))
        raise


def ensure_collection_exists():
    """Qdrant 컬렉션이 존재하는지 확인하고 없으면 생성"""
    collections = qdrant_client.get_collections().collections
    collection_names = [c.name for c in collections]

    if settings.qdrant_collection_name not in collection_names:
        qdrant_client.create_collection(
            collection_name=settings.qdrant_collection_name,
            vectors_config=VectorParams(
                size=1536,  # OpenAI 임베딩 차원
                distance=Distance.COSINE
            )
        )
        logger.info("Created Qdrant collection", name=settings.qdrant_collection_name)


def format_content_to_markdown(url: str, html_content: str) -> str:
    """GPT API를 사용하여 HTML 콘텐츠를 정리되고 구조화된 마크다운으로 포맷팅"""
    try:
        # HTML 파싱하여 텍스트 추출
        soup = BeautifulSoup(html_content, 'html.parser')

        # 불필요한 요소 제거 (스크립트, 네비게이션, 푸터 등)
        for element in soup(["script", "style", "nav", "footer", "header", "aside", "noscript", "form"]):
            element.decompose()

        # 텍스트 콘텐츠 가져오기
        text_content = soup.get_text(separator="\n", strip=True)

        # 토큰 제한을 피하기 위해 콘텐츠 크기 제한 (약 8000 토큰 = 32000자)
        if len(text_content) > 30000:
            text_content = text_content[:30000] + "\n...(content truncated)"

        # GPT API 호출하여 콘텐츠 포맷팅
        logger.info("Formatting content with GPT API", url=url)

        response = openai_client.chat.completions.create(
            model=settings.llm_model,
            temperature=0.3,
            messages=[
                {
                    "role": "system",
                    "content": """You are a content curator that transforms web page content into clean, well-organized markdown format.

Your task:
1. Extract and organize the main content from the provided text
2. Remove navigation menus, footers, sidebars, and repetitive elements
3. Create a clear hierarchical structure using markdown headers (# ## ###)
4. Preserve important information like:
   - Main headings and subheadings
   - Body paragraphs with key information
   - Lists (bullet points or numbered)
   - Important dates, names, contact information
   - Links and references
5. Format as clean markdown with proper spacing
6. If content is in Korean, keep it in Korean
7. Do not add your own commentary - only restructure existing content

Output only the formatted markdown content, nothing else."""
                },
                {
                    "role": "user",
                    "content": f"URL: {url}\n\nContent to format:\n\n{text_content}"
                }
            ]
        )

        markdown_content = response.choices[0].message.content
        logger.info("Successfully formatted content to markdown", url=url, length=len(markdown_content))

        return markdown_content

    except Exception as e:
        logger.error("Failed to format content with GPT", url=url, error=str(e))
        # GPT 포맷팅 실패 시 단순 텍스트 추출로 대체
        logger.warning("Falling back to simple text extraction", url=url)
        return fetch_and_extract_text_simple(url, html_content)


def fetch_and_extract_text_simple(url: str, html_content: str = None) -> str:
    """단순 텍스트 추출 (fallback용 기존 방식)"""
    try:
        # HTML 콘텐츠가 제공되지 않으면 가져오기
        if html_content is None:
            headers = {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
            }
            with httpx.Client(
                timeout=20,
                follow_redirects=True,
                headers=headers
            ) as client:
                response = client.get(url)
                response.raise_for_status()
                html_content = response.text

        # HTML 파싱
        soup = BeautifulSoup(html_content, 'html.parser')

        # 불필요한 요소 제거
        for element in soup(["script", "style", "nav", "footer", "header", "aside", "noscript", "form"]):
            element.decompose()

        # 주석 노드 제거
        for comment in soup.find_all(string=lambda text: isinstance(text, str) and text.strip().startswith('<!--')):
            comment.extract()

        # 우선순위에 따라 메인 콘텐츠 영역 찾기
        main_content = None
        content_selectors = [
            'main', 'article', '[role="main"]', '.content', '#content',
            '.post-content', '.entry-content', '.article-content',
            '.main-content', '.page-content'
        ]

        for selector in content_selectors:
            main_content = soup.select_one(selector)
            if main_content:
                break

        # 메인 콘텐츠를 찾지 못하면 body 사용
        if not main_content:
            main_content = soup.body if soup.body else soup

        # 텍스트 추출
        text = main_content.get_text(separator="\n", strip=True)

        # 텍스트 정리
        lines = []
        for line in text.split('\n'):
            line = line.strip()
            if line and len(line) > 2:  # 매우 짧은 줄은 건너뛰기
                lines.append(line)

        text = '\n'.join(lines)

        # 과도한 공백 제거
        import re
        text = re.sub(r'\n{3,}', '\n\n', text)  # 최대 2개의 연속 줄바꿈
        text = re.sub(r' {2,}', ' ', text)  # 여러 개의 공백 제거

        return text

    except Exception as e:
        logger.error("Failed to fetch/extract text", url=url, error=str(e))
        raise


def fetch_and_extract_text(url: str) -> str:
    """URL 콘텐츠를 가져와서 GPT API로 정리된 마크다운으로 포맷팅"""
    try:
        # HTTP 요청 헤더 설정
        headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        }

        with httpx.Client(
            timeout=20,
            follow_redirects=True,
            headers=headers
        ) as client:
            response = client.get(url)
            response.raise_for_status()

        # GPT API를 사용하여 콘텐츠를 마크다운으로 포맷팅
        markdown_content = format_content_to_markdown(url, response.text)

        return markdown_content

    except Exception as e:
        logger.error("Failed to fetch/extract text", url=url, error=str(e))
        raise


def url_exists_in_db(url: str) -> bool:
    """URL이 데이터베이스에 이미 존재하는지 확인"""
    try:
        search_result = qdrant_client.scroll(
            collection_name=settings.qdrant_collection_name,
            scroll_filter={
                "must": [
                    {
                        "key": "url",
                        "match": {
                            "value": url
                        }
                    }
                ]
            },
            limit=1
        )
        
        return len(search_result[0]) > 0
    except Exception:
        return False


def get_content_hash(text: str) -> str:
    """중복 감지를 위한 콘텐츠 해시 생성"""
    return hashlib.md5(text.encode('utf-8')).hexdigest()


def content_changed_since_last_crawl(url: str, new_content: str) -> bool:
    """마지막 크롤링 이후 콘텐츠가 변경되었는지 확인"""
    try:
        new_hash = get_content_hash(new_content)

        # 동일한 URL의 기존 콘텐츠 검색
        search_result = qdrant_client.scroll(
            collection_name=settings.qdrant_collection_name,
            scroll_filter={
                "must": [
                    {
                        "key": "url",
                        "match": {
                            "value": url
                        }
                    }
                ]
            },
            limit=1,
            with_payload=True
        )

        if len(search_result[0]) == 0:
            return True  # 새로운 URL, 콘텐츠가 확실히 변경됨

        # 저장된 콘텐츠 해시 가져오기
        existing_payload = search_result[0][0].payload
        stored_hash = existing_payload.get("content_hash", "")

        return new_hash != stored_hash

    except Exception as e:
        logger.error(f"Error checking content change: {e}")
        return True  # 에러 발생 시 변경된 것으로 간주


@celery_app.task(base=EmbeddingTask, name="process_url_for_embedding_incremental")
def process_url_for_embedding_incremental(url: str):
    """
    중복 확인과 함께 URL 임베딩 처리
    """
    logger.info("Processing URL for incremental embedding", url=url)

    # URL이 이미 존재하면 건너뛰기
    if url_exists_in_db(url):
        logger.info("URL already exists, skipping", url=url)
        return {"status": "skipped", "url": url, "reason": "already_exists"}

    # 새로운 URL 처리
    return process_url_for_embedding(url)


@celery_app.task(base=EmbeddingTask, name="process_url_for_embedding_smart")
def process_url_for_embedding_smart(url: str):
    """
    콘텐츠 변경 여부를 기반으로 스마트 중복 감지와 함께 URL 처리
    """
    logger.info("Processing URL with smart duplicate detection", url=url)
    
    try:
        # 콘텐츠가 변경되었는지 확인하기 위해 항상 먼저 가져오기
        text_content = fetch_and_extract_text(url)

        if not text_content or len(text_content.strip()) < 50:
            logger.warning("Insufficient content", url=url, length=len(text_content))
            return {"status": "skipped", "url": url, "reason": "insufficient_content"}

        # 콘텐츠가 실제로 변경되었는지 확인
        if not content_changed_since_last_crawl(url, text_content):
            logger.info("Content unchanged, skipping", url=url)
            return {"status": "skipped", "url": url, "reason": "content_unchanged"}

        # 콘텐츠가 변경되었거나 새로운 URL - 처리 진행
        logger.info("Content changed or new URL, processing", url=url)

        # 컬렉션 존재 확인
        ensure_collection_exists()

        # 이 URL의 기존 콘텐츠가 있으면 삭제
        try:
            qdrant_client.delete(
                collection_name=settings.qdrant_collection_name,
                points_selector={
                    "filter": {
                        "must": [
                            {
                                "key": "url",
                                "match": {
                                    "value": url
                                }
                            }
                        ]
                    }
                }
            )
            logger.info("Removed old content for URL", url=url)
        except Exception as e:
            logger.warning(f"Could not remove old content: {e}")

        # 텍스트를 청크로 분할
        chunks = text_splitter.split_text(text_content)
        logger.info(f"Split into {len(chunks)} chunks", url=url)

        # 콘텐츠 해시 생성
        content_hash = get_content_hash(text_content)

        # 각 청크를 임베딩하고 저장
        points = []
        for idx, chunk in enumerate(chunks):
            # 임베딩 생성
            embedding = embeddings.embed_query(chunk)

            # 콘텐츠 해시와 함께 포인트 생성
            point_id = str(uuid.uuid4())
            point = PointStruct(
                id=point_id,
                vector=embedding,
                payload={
                    "text": chunk,
                    "url": url,
                    "chunk_index": idx,
                    "total_chunks": len(chunks),
                    "content_hash": content_hash,
                    "updated_at": str(get_kst_now())
                }
            )
            points.append(point)

        # Qdrant에 배치 업로드
        qdrant_client.upsert(
            collection_name=settings.qdrant_collection_name,
            points=points
        )

        logger.info(f"Updated {len(points)} embeddings", url=url)
        return {
            "status": "success",
            "url": url,
            "chunks_processed": len(chunks),
            "content_hash": content_hash
        }

    except Exception as e:
        logger.error("Failed to process URL", url=url, error=str(e))
        raise