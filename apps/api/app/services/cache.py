from __future__ import annotations

import json
import logging
import threading
import time
from abc import ABC, abstractmethod
from typing import Any

from app.core.config import settings

logger = logging.getLogger("uvicorn.error")


class BaseCacheAdapter(ABC):
    """Abstract base adapter for cache backends."""

    @abstractmethod
    def get(self, key: str) -> str | None:
        """Retrieve raw string value by key."""
        pass

    @abstractmethod
    def set(self, key: str, value: str, ttl_seconds: float | int | None = None) -> None:
        """Store raw string value with optional TTL in seconds."""
        pass

    @abstractmethod
    def delete(self, key: str) -> None:
        """Remove key from cache."""
        pass

    @abstractmethod
    def clear(self) -> None:
        """Clear all entries from cache."""
        pass


class InMemoryCacheAdapter(BaseCacheAdapter):
    """
    Thread-safe in-memory cache adapter with monotonic TTL support.
    Used as fallback when Redis is unavailable or unconfigured.
    """

    def __init__(self) -> None:
        self._lock = threading.RLock()
        # key -> (raw_string_value, expire_at_monotonic_timestamp | None)
        self._store: dict[str, tuple[str, float | None]] = {}

    def get(self, key: str) -> str | None:
        with self._lock:
            entry = self._store.get(key)
            if entry is None:
                return None

            val, expire_at = entry
            if expire_at is not None and time.monotonic() > expire_at:
                del self._store[key]
                return None

            return val

    def set(self, key: str, value: str, ttl_seconds: float | int | None = None) -> None:
        expire_at = (time.monotonic() + ttl_seconds) if ttl_seconds is not None else None
        with self._lock:
            if len(self._store) > 1000:
                self._evict_expired()
            self._store[key] = (value, expire_at)

    def delete(self, key: str) -> None:
        with self._lock:
            self._store.pop(key, None)

    def clear(self) -> None:
        with self._lock:
            self._store.clear()

    def _evict_expired(self) -> None:
        now = time.monotonic()
        expired = [k for k, (_, exp) in self._store.items() if exp is not None and now > exp]
        for k in expired:
            del self._store[k]


class RedisCacheAdapter(BaseCacheAdapter):
    """
    Redis cache adapter using redis-py client.
    Connects to Redis server and stores keys with native TTL.
    """

    def __init__(self, redis_url: str) -> None:
        import redis

        self._client = redis.Redis.from_url(redis_url, decode_responses=True)
        # Test connection immediately
        self._client.ping()

    def get(self, key: str) -> str | None:
        try:
            return self._client.get(key)
        except Exception as exc:
            logger.warning(f"Redis get failed for key '{key}': {exc}")
            return None

    def set(self, key: str, value: str, ttl_seconds: float | int | None = None) -> None:
        try:
            if ttl_seconds is not None:
                self._client.set(key, value, ex=int(ttl_seconds))
            else:
                self._client.set(key, value)
        except Exception as exc:
            logger.warning(f"Redis set failed for key '{key}': {exc}")

    def delete(self, key: str) -> None:
        try:
            self._client.delete(key)
        except Exception as exc:
            logger.warning(f"Redis delete failed for key '{key}': {exc}")

    def clear(self) -> None:
        try:
            self._client.flushdb()
        except Exception as exc:
            logger.warning(f"Redis flushdb failed: {exc}")


class CacheService:
    """
    Unified Cache Service.
    Selects RedisCacheAdapter if REDIS_URL is configured and reachable,
    otherwise gracefully falls back to InMemoryCacheAdapter.
    """

    def __init__(self, redis_url: str | None = None) -> None:
        target_url = redis_url if redis_url is not None else settings.REDIS_URL
        self.adapter: BaseCacheAdapter = self._initialize_adapter(target_url)

    def _initialize_adapter(self, redis_url: str | None) -> BaseCacheAdapter:
        if redis_url and redis_url.strip():
            try:
                adapter = RedisCacheAdapter(redis_url.strip())
                logger.info("CacheService initialized with RedisCacheAdapter.")
                return adapter
            except Exception as exc:
                logger.warning(
                    f"Failed to connect to Redis at {redis_url}: {exc}. "
                    "Falling back to InMemoryCacheAdapter."
                )
        else:
            logger.info("REDIS_URL not configured. CacheService using InMemoryCacheAdapter.")

        return InMemoryCacheAdapter()

    # --- Core String Operations ---
    def get(self, key: str) -> str | None:
        return self.adapter.get(key)

    def set(self, key: str, value: str, ttl_seconds: float | int | None = None) -> None:
        self.adapter.set(key, value, ttl_seconds=ttl_seconds)

    def delete(self, key: str) -> None:
        self.adapter.delete(key)

    def clear(self) -> None:
        self.adapter.clear()

    # --- JSON Helper Operations ---
    def get_json(self, key: str) -> Any | None:
        raw = self.get(key)
        if raw is None:
            return None
        try:
            return json.loads(raw)
        except (json.JSONDecodeError, TypeError) as exc:
            logger.warning(f"Failed to decode cached JSON for key '{key}': {exc}")
            return None

    def set_json(self, key: str, data: Any, ttl_seconds: float | int | None = None) -> None:
        try:
            serialized = json.dumps(data, default=str)
            self.set(key, serialized, ttl_seconds=ttl_seconds)
        except (TypeError, ValueError) as exc:
            logger.warning(f"Failed to encode JSON for cache key '{key}': {exc}")


# Standalone singleton instance
cache = CacheService()
