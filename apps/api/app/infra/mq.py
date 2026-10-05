from bullmq import Queue

from app.core.config import settings

JOB_CONFIG = {
    "backend": "postgres",
    "connection": settings.DATABASE_URL.replace(
        "postgresql+psycopg://", "postgresql://"
    ),
}

JOB_PROCESSING_QUEUE = "async-mq-job-processing"

# Instantiate the queue instance
queue = Queue(JOB_PROCESSING_QUEUE, opts=JOB_CONFIG)
