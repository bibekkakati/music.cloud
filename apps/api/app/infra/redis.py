import logging
import redis

from app.core.config import settings

logger = logging.getLogger("uvicorn.error")


def create_redis_client() -> redis.Redis:
    """Create standard Redis client (redis-py)."""
    return redis.Redis.from_url(
        settings.REDIS_URL,
        decode_responses=True,
        socket_timeout=5.0,
        socket_connect_timeout=5.0,
    )


redis_client: redis.Redis | None = None


def get_redis_client() -> redis.Redis:
    """Get or create Redis client."""
    global redis_client
    if redis_client is None:
        redis_client = create_redis_client()
    return redis_client
