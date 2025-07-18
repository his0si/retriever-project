import os
from pydantic_settings import BaseSettings
from pydantic import Field


class Settings(BaseSettings):
    # OpenAI
    openai_api_key: str = Field(..., env="OPENAI_API_KEY")
    
    # RabbitMQ
    rabbitmq_host: str = Field(default="localhost", env="RABBITMQ_HOST")
    rabbitmq_port: int = Field(default=5672, env="RABBITMQ_PORT")
    rabbitmq_user: str = Field(default="admin", env="RABBITMQ_USER")
    rabbitmq_pass: str = Field(default="admin123", env="RABBITMQ_PASS")
    
    # Qdrant
    qdrant_host: str = Field(default="localhost", env="QDRANT_HOST")
    qdrant_port: int = Field(default=6333, env="QDRANT_PORT")
    qdrant_collection_name: str = Field(default="school_documents", env="QDRANT_COLLECTION_NAME")
    
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
    
    class Config:
        env_file = ".env"
        case_sensitive = False


settings = Settings()