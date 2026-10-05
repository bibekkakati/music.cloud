import threading
import time
from dataclasses import dataclass
from typing import Optional

from app.models.session import UserSession
from app.models.user import User


@dataclass(slots=True)
class CachedSessionEntry:
    session: UserSession
    user: Optional[User]
    cached_at: float  # monotonic timestamp
    ttl_seconds: float = 300.0  # 5 minutes default

    def is_expired(self) -> bool:
        # Check cache TTL (5 minutes)
        if time.monotonic() - self.cached_at > self.ttl_seconds:
            return True
        # Check database session expiration / grace period
        return self.session.is_expired and not self.session.is_within_grace_period()


class SessionCache:
    """
    Thread-safe in-memory server-level cache for active user sessions.
    Validating sessions with the database on every request is slow;
    this cache keeps valid sessions in memory with a 5-minute TTL.
    """

    DEFAULT_TTL_SECONDS: float = 300.0  # 5 minutes

    def __init__(self, default_ttl_seconds: float = DEFAULT_TTL_SECONDS):
        self.default_ttl = default_ttl_seconds
        self._cache: dict[str, CachedSessionEntry] = {}
        self._lock = threading.Lock()
        self._hits = 0
        self._misses = 0

    def get(self, token: str) -> UserSession | None:
        """
        Retrieve a valid cached session by token if within 5-minute TTL.
        Returns a fresh detached UserSession instance, or None on cache miss/expiry.
        """
        with self._lock:
            entry = self._cache.get(token)
            if entry is None:
                self._misses += 1
                return None

            if entry.is_expired():
                del self._cache[token]
                self._misses += 1
                return None

            self._hits += 1
            # Reconstruct clean transient instances to prevent any SQLAlchemy session-binding issues
            session_copy = UserSession(
                id=entry.session.id,
                token=entry.session.token,
                user_id=entry.session.user_id,
                created_at=entry.session.created_at,
                expires_at=entry.session.expires_at,
            )
            if entry.user is not None:
                session_copy.user = User(
                    id=entry.user.id,
                    email=entry.user.email,
                    is_admin=entry.user.is_admin,
                    created_at=entry.user.created_at,
                    updated_at=entry.user.updated_at,
                )
            return session_copy

    def set(
        self,
        token: str,
        session: UserSession,
        user: Optional[User] = None,
        ttl_seconds: Optional[float] = None,
    ) -> None:
        """
        Cache a session (and optional user) for up to ttl_seconds (default 5 minutes).
        """
        ttl = ttl_seconds if ttl_seconds is not None else self.default_ttl
        now_mono = time.monotonic()

        # Create detached copy for cache
        session_copy = UserSession(
            id=session.id,
            token=session.token,
            user_id=session.user_id,
            created_at=session.created_at,
            expires_at=session.expires_at,
        )

        user_copy = None
        user_to_cache = user or getattr(session, "user", None)
        if user_to_cache is not None:
            user_copy = User(
                id=user_to_cache.id,
                email=user_to_cache.email,
                is_admin=user_to_cache.is_admin,
                created_at=user_to_cache.created_at,
                updated_at=user_to_cache.updated_at,
            )

        with self._lock:
            # Self-evict expired entries if cache is growing
            if len(self._cache) > 500:
                self._evict_expired_unlocked(now_mono)

            self._cache[token] = CachedSessionEntry(
                session=session_copy,
                user=user_copy,
                cached_at=now_mono,
                ttl_seconds=ttl,
            )

    def invalidate(self, token: str) -> None:
        """
        Explicitly remove a session from the cache (e.g., on logout or revocation).
        """
        with self._lock:
            self._cache.pop(token, None)

    def clear(self) -> None:
        """Clear all cached sessions."""
        with self._lock:
            self._cache.clear()
            self._hits = 0
            self._misses = 0

    def stats(self) -> dict:
        """Return cache hit/miss statistics and current size."""
        with self._lock:
            total = self._hits + self._misses
            hit_ratio = (self._hits / total) if total > 0 else 0.0
            return {
                "size": len(self._cache),
                "hits": self._hits,
                "misses": self._misses,
                "hit_ratio": round(hit_ratio, 4),
            }

    def _evict_expired_unlocked(self, now_mono: float) -> None:
        expired_keys = [
            k for k, v in self._cache.items()
            if now_mono - v.cached_at > v.ttl_seconds or v.is_expired()
        ]
        for k in expired_keys:
            del self._cache[k]


from app.core.config import settings

session_cache = SessionCache(default_ttl_seconds=settings.config.auth.session_cache_ttl_seconds)
