import hashlib
import secrets
from datetime import datetime, timedelta, timezone
from uuid import UUID

from sqlmodel import Session, col, func, select

from app.core.config import settings
from app.models.session import UserSession
from app.models.user import User
from app.services.cache import CacheService, cache

# Extend an active session when less than this much lifetime remains.
RENEW_THRESHOLD = timedelta(days=1)


def _as_utc(value: datetime) -> datetime:
    return value if value.tzinfo else value.replace(tzinfo=timezone.utc)


class SessionService:
    """
    Session lifecycle: create, validate (get), refresh and delete.

    Sessions are looked up by the SHA-256 hash of the bearer token. The cache is
    checked first; on a miss the session is loaded from the database, its expiry
    is validated, and it is cached for min(session_cache_ttl_seconds, time left).
    Cache eviction is left to the cache backend via TTL.
    """

    def __init__(self, db: Session, cache_service: CacheService | None = None) -> None:
        self.db = db
        self.cache = cache_service or cache
        self.auth_config = settings.config.auth

    # =========================================================================
    # Helpers
    # =========================================================================
    @staticmethod
    def hash_token(raw_token: str) -> str:
        """Compute SHA-256 hex digest of the raw session token."""
        return hashlib.sha256(raw_token.encode("utf-8")).hexdigest()

    @staticmethod
    def _cache_key(token_hash: str) -> str:
        return f"session:{token_hash}"

    def _cache_put(self, session: UserSession, user: User | None) -> None:
        seconds_left = (_as_utc(session.expires_at) - datetime.now(timezone.utc)).total_seconds()
        ttl = min(self.auth_config.session_cache_ttl_seconds, seconds_left)
        if ttl < 1:
            return
        payload = {
            "session": session.model_dump(mode="json"),
            "user": user.model_dump(mode="json") if user else None,
        }
        self.cache.set_json(self._cache_key(session.token), payload, ttl_seconds=ttl)

    def _cache_get(self, token_hash: str) -> UserSession | None:
        key = self._cache_key(token_hash)
        data = self.cache.get_json(key)
        if not data:
            return None
        try:
            session = UserSession.model_validate(data["session"])
            if data.get("user"):
                session.user = User.model_validate(data["user"])
            return session
        except Exception:  # noqa: BLE001 - corrupt/stale cache entry, fall back to DB
            self.cache.delete(key)
            return None

    def _renew(self, session: UserSession) -> None:
        session.expires_at = datetime.now(timezone.utc) + timedelta(
            days=self.auth_config.session_expiry_days
        )
        self.db.add(session)
        self.db.commit()
        self.db.refresh(session)

    # =========================================================================
    # Lifecycle
    # =========================================================================
    def create_session(self, user_id: UUID) -> tuple[UserSession, str]:
        """Create a session and return it along with the raw bearer token."""
        raw_token = secrets.token_urlsafe(32)
        now = datetime.now(timezone.utc)
        session = UserSession(
            token=self.hash_token(raw_token),
            user_id=user_id,
            created_at=now,
            expires_at=now + timedelta(days=self.auth_config.session_expiry_days),
        )
        self.db.add(session)
        self.db.commit()
        self.db.refresh(session)

        self._cache_put(session, self.db.get(User, user_id))
        return session, raw_token

    def get_valid_session(self, token: str) -> UserSession | None:
        """Return the session for a raw bearer token, or None if invalid/expired."""
        token_hash = self.hash_token(token)

        # Cache hit: trust the TTL, no expiry re-validation.
        cached = self._cache_get(token_hash)
        if cached is not None:
            return cached

        # Cache miss: load from DB and validate expiry.
        session = self.db.exec(
            select(UserSession).where(UserSession.token == token_hash)
        ).first()
        if session is None:
            return None

        now = datetime.now(timezone.utc)
        expires = _as_utc(session.expires_at)
        grace = timedelta(minutes=self.auth_config.session_grace_period_minutes)

        if now > expires + grace:
            self.db.delete(session)
            self.db.commit()
            return None

        # Covers both "expired but within grace" and "about to expire".
        if expires - now < RENEW_THRESHOLD:
            self._renew(session)

        user = self.db.get(User, session.user_id)
        session.user = user
        self._cache_put(session, user)
        return session

    def delete_session(self, session: UserSession) -> bool:
        """Remove a session from the cache and the database."""
        self.cache.delete(self._cache_key(session.token))
        db_session = self.db.get(UserSession, session.id)
        if db_session is None:
            return False
        self.db.delete(db_session)
        self.db.commit()
        return True

    def delete_all_user_sessions(self, user_id: UUID) -> int:
        """Revoke all sessions for a specific user from database and cache."""
        statement = select(UserSession).where(UserSession.user_id == user_id)
        sessions = self.db.exec(statement).all()
        count = len(sessions)
        for s in sessions:
            self.cache.delete(self._cache_key(s.token))
            self.db.delete(s)
        self.db.commit()
        return count

    def count_active_sessions(self) -> int:
        cutoff = datetime.now(timezone.utc) - timedelta(
            minutes=self.auth_config.session_grace_period_minutes
        )
        count = self.db.exec(
            select(func.count(col(UserSession.id))).where(UserSession.expires_at > cutoff)
        ).first()
        return count or 0
