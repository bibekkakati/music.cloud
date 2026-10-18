import threading
import time

from fastapi import HTTPException, Request, status

from app.core.config import settings
from app.services.cache import CacheService, cache


class SlidingWindowRateLimiter:
    """
    Sliding window rate limiter for FastAPI routes backed by CacheService.
    Supports distributed Redis or thread-safe in-memory cache fallback.
    Tracks timestamps of requests per client key (e.g., client IP).
    """

    def __init__(
        self,
        max_attempts: int,
        window_seconds: int,
        prefix: str = "rate_limit:login",
        cache_service: CacheService | None = None,
    ):
        self.max_attempts = max_attempts
        self.window_seconds = window_seconds
        self.prefix = prefix
        self.cache = cache_service or cache
        self._lock = threading.Lock()

    def _cache_key(self, client_ip: str) -> str:
        return f"{self.prefix}:{client_ip}"

    def check(self, client_ip: str) -> None:
        now = time.time()
        cutoff = now - self.window_seconds
        cache_key = self._cache_key(client_ip)

        with self._lock:
            cached_data = self.cache.get_json(cache_key)
            raw_timestamps: list[float] = (
                cached_data if isinstance(cached_data, list) else []
            )

            # Filter out timestamps outside the active sliding window
            timestamps = [
                t
                for t in raw_timestamps
                if isinstance(t, (int, float)) and t > cutoff
            ]

            if len(timestamps) >= self.max_attempts:
                oldest = timestamps[0]
                retry_after = max(1, int(self.window_seconds - (now - oldest)))
                raise HTTPException(
                    status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                    detail=f"Too many login attempts. Please try again in {retry_after} seconds.",
                    headers={"Retry-After": str(retry_after)},
                )

            timestamps.append(now)
            # Store with TTL (auto-evicted by Redis or InMemoryCacheAdapter)
            self.cache.set_json(
                cache_key,
                timestamps,
                ttl_seconds=self.window_seconds * 2,
            )


def get_client_ip(request: Request) -> str:
    """
    Extract client IP address respecting Cloudflare and reverse-proxy headers.
    """
    cf_ip = request.headers.get("cf-connecting-ip")
    if cf_ip:
        return cf_ip.strip()

    x_forwarded = request.headers.get("x-forwarded-for")
    if x_forwarded:
        first_ip = x_forwarded.split(",")[0].strip()
        if first_ip:
            return first_ip

    if request.client and request.client.host:
        return request.client.host

    return "unknown"


login_rate_limiter = SlidingWindowRateLimiter(
    max_attempts=settings.config.auth.login_rate_limit_max_attempts,
    window_seconds=settings.config.auth.login_rate_limit_window_seconds,
)


def check_login_rate_limit(request: Request) -> None:
    client_ip = get_client_ip(request)
    login_rate_limiter.check(client_ip)
