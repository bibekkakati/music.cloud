import logging
import redis

from app.core.config import settings

logger = logging.getLogger("uvicorn.error")


def create_redis_client() -> redis.Redis:
    """Create standard Redis client (redis-py)."""
    return redis.Redis.from_url(
        settings.REDIS_URL.strip(),
        decode_responses=True,
        socket_timeout=5.0,
        socket_connect_timeout=5.0,
    )


# Global singleton instances for direct import
redis_client = create_redis_client()


def get_redis_client() -> redis.Redis:
    return redis_client
