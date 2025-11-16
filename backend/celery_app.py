from celery import Celery
from config import settings

# Create Celery instance
celery_app = Celery(
    "rag_chatbot",
    broker=settings.celery_broker_url,
    backend=settings.celery_result_backend,
    include=["tasks.crawler", "tasks.embeddings", "tasks.scheduled_crawler"]
)

# Configure Celery
celery_app.conf.update(
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone="Asia/Seoul",
    enable_utc=False,
    task_track_started=True,
    task_time_limit=4.5 * 60 * 60,  # 4.5 hours (큰 웹사이트 크롤링용)
    task_soft_time_limit=4 * 60 * 60,  # 4 hours (240 minutes)
    worker_prefetch_multiplier=1,
    worker_max_tasks_per_child=1000,
    # Queue routing: separate embedding tasks to dedicated queue
    task_routes={
        'process_url_for_embedding': {'queue': 'embedding'},
        'process_url_for_embedding_incremental': {'queue': 'embedding'},
        'process_url_for_embedding_smart': {'queue': 'embedding'},
    },
)