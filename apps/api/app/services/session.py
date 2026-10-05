import hashlib
import secrets
import uuid
from datetime import datetime, timedelta, timezone

from sqlmodel import Session, col, func, select

from app.core.config import settings
from app.models.session import UserSession
from app.models.user import User
from app.services.session_cache import session_cache


class SessionService:
    @property
    def default_expiry_days(self) -> int:
        return settings.config.auth.session_expiry_days

    @property
    def default_grace_period_minutes(self) -> int:
        return settings.config.auth.session_grace_period_minutes

    def __init__(self, db: Session):
        self.db = db

    @staticmethod
    def hash_token(raw_token: str) -> str:
        """Compute SHA-256 hex digest of the raw session token."""
        return hashlib.sha256(raw_token.encode("utf-8")).hexdigest()

    def create_session(
        self,
        user_id: uuid.UUID,
        expiry_days: int | None = None,
    ) -> tuple[UserSession, str]:
        if expiry_days is None:
            expiry_days = self.default_expiry_days
        raw_token = secrets.token_urlsafe(32)
        token_hash = self.hash_token(raw_token)
        now = datetime.now(timezone.utc)
        expires_at = now + timedelta(days=expiry_days)

        user_session = UserSession(
            token=token_hash,
            user_id=user_id,
            created_at=now,
            expires_at=expires_at,
        )
        self.db.add(user_session)
        self.db.commit()
        self.db.refresh(user_session)

        # Cache session immediately with 5-minute TTL
        user = self.db.exec(select(User).where(User.id == user_id)).first()
        session_cache.set(raw_token, user_session, user=user)
        session_cache.set(token_hash, user_session, user=user)
        return user_session, raw_token

    def get_valid_session(
        self,
        token: str,
        grace_period_minutes: int | None = None,
        renew_days: int | None = None,
    ) -> UserSession | None:
        if grace_period_minutes is None:
            grace_period_minutes = self.default_grace_period_minutes
        if renew_days is None:
            renew_days = self.default_expiry_days

        # 1. Fast Path: Check server-level in-memory cache (5-minute TTL)
        cached_session = session_cache.get(token)
        if cached_session is not None:
            return cached_session

        token_hash = self.hash_token(token)
        cached_by_hash = session_cache.get(token_hash)
        if cached_by_hash is not None:
            return cached_by_hash

        # 2. Slow Path: Validate against database (support SHA-256 and legacy plaintext tokens)
        statement = select(UserSession).where(
            (UserSession.token == token_hash) | (UserSession.token == token)
        )
        user_session = self.db.exec(statement).first()
        if user_session is None:
            session_cache.invalidate(token)
            session_cache.invalidate(token_hash)
            return None

        # Seamless upgrade: if matched legacy raw token, update DB record to SHA-256 hash
        if user_session.token == token:
            user_session.token = token_hash
            self.db.add(user_session)
            self.db.commit()
            self.db.refresh(user_session)

        now = datetime.now(timezone.utc)
        expires = user_session.expires_at
        if expires.tzinfo is None:
            expires = expires.replace(tzinfo=timezone.utc)

        # Check if session has expired
        if now >= expires:
            grace_delta = timedelta(minutes=grace_period_minutes)
            if now <= expires + grace_delta:
                # Expired within 30-minute grace period: auto-renew expiry seamlessly!
                user_session.expires_at = now + timedelta(days=renew_days)
                self.db.add(user_session)
                self.db.commit()
                self.db.refresh(user_session)
            else:
                # Expired beyond grace period: clean up and invalidate
                session_cache.invalidate(token)
                session_cache.invalidate(token_hash)
                self.db.delete(user_session)
                self.db.commit()
                return None
        elif expires - now < timedelta(days=1):
            # Sliding renewal: if session is active and less than 1 day remains, extend
            user_session.expires_at = now + timedelta(days=renew_days)
            self.db.add(user_session)
            self.db.commit()
            self.db.refresh(user_session)

        # Cache the validated session and associated user with 5-minute TTL
        user = self.db.exec(select(User).where(User.id == user_session.user_id)).first()
        session_cache.set(token, user_session, user=user)
        session_cache.set(token_hash, user_session, user=user)
        return user_session

    def refresh_session(
        self,
        token: str,
        renew_days: int | None = None,
    ) -> UserSession | None:
        if renew_days is None:
            renew_days = self.default_expiry_days
        token_hash = self.hash_token(token)
        statement = select(UserSession).where(
            (UserSession.token == token_hash) | (UserSession.token == token)
        )
        user_session = self.db.exec(statement).first()
        if user_session is None:
            session_cache.invalidate(token)
            session_cache.invalidate(token_hash)
            return None

        if user_session.token == token:
            user_session.token = token_hash

        now = datetime.now(timezone.utc)
        user_session.expires_at = now + timedelta(days=renew_days)
        self.db.add(user_session)
        self.db.commit()
        self.db.refresh(user_session)

        user = self.db.exec(select(User).where(User.id == user_session.user_id)).first()
        session_cache.set(token, user_session, user=user)
        session_cache.set(token_hash, user_session, user=user)
        return user_session

    def delete_session(self, token: str) -> bool:
        token_hash = self.hash_token(token)
        session_cache.invalidate(token)
        session_cache.invalidate(token_hash)
        statement = select(UserSession).where(
            (UserSession.token == token_hash) | (UserSession.token == token)
        )
        user_session = self.db.exec(statement).first()
        if user_session is None:
            return False

        self.db.delete(user_session)
        self.db.commit()
        return True

    def cleanup_expired(self, grace_period_minutes: int | None = None) -> int:
        if grace_period_minutes is None:
            grace_period_minutes = self.default_grace_period_minutes
        now = datetime.now(timezone.utc)
        cutoff = now - timedelta(minutes=grace_period_minutes)
        statement = select(UserSession).where(UserSession.expires_at <= cutoff)
        expired_sessions = self.db.exec(statement).all()
        for session in expired_sessions:
            session_cache.invalidate(session.token)
            self.db.delete(session)
        if expired_sessions:
            self.db.commit()
        return len(expired_sessions)

    def count_active_sessions(self, grace_period_minutes: int | None = None) -> int:
        if grace_period_minutes is None:
            grace_period_minutes = self.default_grace_period_minutes
        now = datetime.now(timezone.utc)
        cutoff = now - timedelta(minutes=grace_period_minutes)
        statement = select(func.count(col(UserSession.id))).where(
            UserSession.expires_at > cutoff
        )
        count = self.db.exec(statement).first()
        return count or 0
