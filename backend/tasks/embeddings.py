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

from config import settings

logger = structlog.get_logger()

# 한국 시간대 설정
KST = pytz.timezone('Asia/Seoul')

def get_kst_now():
    """한국 시간으로 현재 시간 반환"""
    return datetime.now(KST)


class EmbeddingTask(Task):
    """Base embedding task with retry configuration"""
    autoretry_for = (Exception,)
    retry_kwargs = {'max_retries': 2, 'countdown': 5}  # Faster retry
    retry_backoff = True
    rate_limit = '10/m'  # Rate limiting for API calls


# Initialize clients
qdrant_client = QdrantClient(
    url=settings.qdrant_host,
    api_key=settings.qdrant_api_key
)

embeddings = OpenAIEmbeddings(
    model=settings.embedding_model,
    openai_api_key=settings.openai_api_key
)

text_splitter = RecursiveCharacterTextSplitter(
    chunk_size=settings.chunk_size,
    chunk_overlap=settings.chunk_overlap,
    length_function=len,
    separators=["\n\n", "\n", ". ", " ", ""]
)


@celery_app.task(base=EmbeddingTask, name="process_url_for_embedding")
def process_url_for_embedding(url: str):
    """
    Process a URL: fetch content, extract text, chunk, embed, and store
    """
    logger.info("Processing URL for embedding", url=url)
    
    try:
        # Ensure collection exists
        ensure_collection_exists()
        
        # Fetch and extract text
        text_content = fetch_and_extract_text(url)
        
        if not text_content or len(text_content.strip()) < 50:
            logger.warning("Insufficient content", url=url, length=len(text_content))
            return {"status": "skipped", "url": url, "reason": "insufficient_content"}
        
        # Split text into chunks
        chunks = text_splitter.split_text(text_content)
        logger.info(f"Split into {len(chunks)} chunks", url=url)
        
        # Embed and store chunks
        points = []
        for idx, chunk in enumerate(chunks):
            # Generate embedding
            embedding = embeddings.embed_query(chunk)
            
            # Create point
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
        
        # Batch upload to Qdrant
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
    """Ensure Qdrant collection exists with proper configuration"""
    collections = qdrant_client.get_collections().collections
    collection_names = [c.name for c in collections]
    
    if settings.qdrant_collection_name not in collection_names:
        qdrant_client.create_collection(
            collection_name=settings.qdrant_collection_name,
            vectors_config=VectorParams(
                size=1536,  # OpenAI embedding dimension
                distance=Distance.COSINE
            )
        )
        logger.info("Created Qdrant collection", name=settings.qdrant_collection_name)


def fetch_and_extract_text(url: str) -> str:
    """Optimized fetch URL content and extract text"""
    try:
        # Fetch content with better configuration
        headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        }

        with httpx.Client(
            timeout=20,  # Faster timeout
            follow_redirects=True,
            headers=headers
        ) as client:
            response = client.get(url)
            response.raise_for_status()

        # Parse HTML more efficiently
        soup = BeautifulSoup(response.text, 'html.parser')

        # Remove unwanted elements more aggressively
        for element in soup(["script", "style", "nav", "footer", "header", "aside", "noscript", "form"]):
            element.decompose()

        # Remove comment nodes
        for comment in soup.find_all(string=lambda text: isinstance(text, str) and text.strip().startswith('<!--')):
            comment.extract()

        # Try to find main content areas in order of priority
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

        # If no main content found, use body
        if not main_content:
            main_content = soup.body if soup.body else soup

        # Extract text more efficiently
        text = main_content.get_text(separator="\n", strip=True)

        # Clean up text more thoroughly
        lines = []
        for line in text.split('\n'):
            line = line.strip()
            if line and len(line) > 2:  # Skip very short lines
                lines.append(line)

        text = '\n'.join(lines)

        # Remove excessive whitespace
        import re
        text = re.sub(r'\n{3,}', '\n\n', text)  # Max 2 consecutive newlines
        text = re.sub(r' {2,}', ' ', text)  # Remove multiple spaces

        return text

    except Exception as e:
        logger.error("Failed to fetch/extract text", url=url, error=str(e))
        raise


def url_exists_in_db(url: str) -> bool:
    """Check if URL already exists in the database"""
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
    """Generate hash of content for duplicate detection"""
    return hashlib.md5(text.encode('utf-8')).hexdigest()


def content_changed_since_last_crawl(url: str, new_content: str) -> bool:
    """Check if content has changed since last crawl"""
    try:
        new_hash = get_content_hash(new_content)
        
        # Search for existing content with same URL
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
            return True  # New URL, content definitely changed
            
        # Get stored content hash
        existing_payload = search_result[0][0].payload
        stored_hash = existing_payload.get("content_hash", "")
        
        return new_hash != stored_hash
        
    except Exception as e:
        logger.error(f"Error checking content change: {e}")
        return True  # Assume changed if error


@celery_app.task(base=EmbeddingTask, name="process_url_for_embedding_incremental")
def process_url_for_embedding_incremental(url: str):
    """
    Process URL for embedding with duplicate checking
    """
    logger.info("Processing URL for incremental embedding", url=url)
    
    # Skip if URL already exists
    if url_exists_in_db(url):
        logger.info("URL already exists, skipping", url=url)
        return {"status": "skipped", "url": url, "reason": "already_exists"}
    
    # Process new URL
    return process_url_for_embedding(url)


@celery_app.task(base=EmbeddingTask, name="process_url_for_embedding_smart")
def process_url_for_embedding_smart(url: str):
    """
    Process URL with smart duplicate detection based on content changes
    """
    logger.info("Processing URL with smart duplicate detection", url=url)
    
    try:
        # Always fetch content first to check if it changed
        text_content = fetch_and_extract_text(url)
        
        if not text_content or len(text_content.strip()) < 50:
            logger.warning("Insufficient content", url=url, length=len(text_content))
            return {"status": "skipped", "url": url, "reason": "insufficient_content"}
        
        # Check if content actually changed
        if not content_changed_since_last_crawl(url, text_content):
            logger.info("Content unchanged, skipping", url=url)
            return {"status": "skipped", "url": url, "reason": "content_unchanged"}
        
        # Content changed or new URL - process it
        logger.info("Content changed or new URL, processing", url=url)
        
        # Ensure collection exists
        ensure_collection_exists()
        
        # Remove old content for this URL if exists
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
        
        # Split text into chunks
        chunks = text_splitter.split_text(text_content)
        logger.info(f"Split into {len(chunks)} chunks", url=url)
        
        # Generate content hash
        content_hash = get_content_hash(text_content)
        
        # Embed and store chunks
        points = []
        for idx, chunk in enumerate(chunks):
            # Generate embedding
            embedding = embeddings.embed_query(chunk)
            
            # Create point with content hash
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
        
        # Batch upload to Qdrant
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