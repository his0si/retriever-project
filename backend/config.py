import os
from pydantic_settings import BaseSettings
from pydantic import Field
from typing import List, Optional


class Settings(BaseSettings):
    # OpenAI (Optional - for comparison)
    openai_api_key: Optional[str] = Field(default=None, env="OPENAI_API_KEY")

    # Ollama
    ollama_host: str = Field(default="http://localhost:11434", env="OLLAMA_HOST")
    ollama_model: str = Field(default="llama3.2", env="OLLAMA_MODEL")
    ollama_embedding_model: str = Field(default="nomic-embed-text", env="OLLAMA_EMBEDDING_MODEL")

    # RabbitMQ
    rabbitmq_host: str = Field(default="localhost", env="RABBITMQ_HOST")
    rabbitmq_port: int = Field(default=5672, env="RABBITMQ_PORT")
    rabbitmq_user: str = Field(default="admin", env="RABBITMQ_USER")
    rabbitmq_pass: str = Field(default="admin123", env="RABBITMQ_PASS")

    # Qdrant
    qdrant_host: str = Field(default="localhost", env="QDRANT_HOST")
    qdrant_port: int = Field(default=6333, env="QDRANT_PORT")
    qdrant_collection_name: str = Field(default="retriever_project_db", env="QDRANT_COLLECTION_NAME")
    qdrant_api_key: str = Field(default="", env="QDRANT_API_KEY")
    
    # Redis
    redis_host: str = Field(default="localhost", env="REDIS_HOST")
    redis_port: int = Field(default=6379, env="REDIS_PORT")
    redis_db: int = Field(default=0, env="REDIS_DB")
    
    # API Server
    api_host: str = Field(default="0.0.0.0", env="API_HOST")
    api_port: int = Field(default=8000, env="API_PORT")
    api_reload: bool = Field(default=True, env="API_RELOAD")
    
    # Celery
    @property
    def celery_broker_url(self) -> str:
        return f"amqp://{self.rabbitmq_user}:{self.rabbitmq_pass}@{self.rabbitmq_host}:{self.rabbitmq_port}//"
    
    @property
    def celery_result_backend(self) -> str:
        return f"redis://{self.redis_host}:{self.redis_port}/{self.redis_db}"
    
    # Text Processing
    chunk_size: int = Field(default=1000, env="CHUNK_SIZE")
    chunk_overlap: int = Field(default=100, env="CHUNK_OVERLAP")
    
    # Embeddings
    embedding_model: str = Field(default="text-embedding-3-small", env="EMBEDDING_MODEL")
    
    # LLM
    llm_model: str = Field(default="gpt-4-turbo-preview", env="LLM_MODEL")
    llm_temperature: float = Field(default=0.0, env="LLM_TEMPERATURE")
    
    # RAG
    top_k: int = Field(default=5, env="TOP_K")

    # Crawling Configuration
    max_crawl_depth: int = Field(default=2, env="MAX_CRAWL_DEPTH")

    # CORS Configuration
    cors_origins: str = Field(default="http://localhost:3000", env="CORS_ORIGINS")
    
    @property
    def cors_origins_list(self) -> List[str]:
        """Parse CORS origins from comma-separated string"""
        return [origin.strip() for origin in self.cors_origins.split(",")]

    class Config:
        # 로컬 환경 파일이 있으면 우선 로드, 없으면 기본 .env 로드
        env_file = ".env.local" if os.path.exists(".env.local") else ".env"
        case_sensitive = False
        extra = "ignore"  # 추가 필드 무시


settings = Settings()