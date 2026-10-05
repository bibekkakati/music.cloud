import time
from collections import defaultdict
import threading
from fastapi import HTTPException, Request, status

from app.core.config import settings


class SlidingWindowRateLimiter:
    """
    Thread-safe in-memory sliding window rate limiter for FastAPI routes.
    Tracks timestamps of requests per client key (e.g., client IP).
    """

    def __init__(self, max_attempts: int, window_seconds: int):
        self.max_attempts = max_attempts
        self.window_seconds = window_seconds
        self._history: dict[str, list[float]] = defaultdict(list)
        self._lock = threading.Lock()
        self._last_cleanup = time.monotonic()

    def _cleanup_stale(self, now: float) -> None:
        """Periodically purge IPs that have had no activity for over 2 window intervals."""
        cutoff = now - (self.window_seconds * 2)
        stale_keys = [
            ip for ip, timestamps in self._history.items()
            if not timestamps or timestamps[-1] < cutoff
        ]
        for ip in stale_keys:
            self._history.pop(ip, None)
        self._last_cleanup = now

    def check(self, client_ip: str) -> None:
        now = time.monotonic()
        cutoff = now - self.window_seconds

        with self._lock:
            if now - self._last_cleanup > 300:
                self._cleanup_stale(now)

            timestamps = [t for t in self._history[client_ip] if t > cutoff]

            if len(timestamps) >= self.max_attempts:
                oldest = timestamps[0]
                retry_after = max(1, int(self.window_seconds - (now - oldest)))
                raise HTTPException(
                    status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                    detail=f"Too many login attempts. Please try again in {retry_after} seconds.",
                    headers={"Retry-After": str(retry_after)},
                )

            timestamps.append(now)
            self._history[client_ip] = timestamps


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
