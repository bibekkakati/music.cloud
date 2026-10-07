from uuid import uuid7, UUID
from datetime import datetime, timedelta, timezone
from typing import TYPE_CHECKING, Optional

from sqlmodel import Field, Relationship, SQLModel

if TYPE_CHECKING:
    from app.models.user import User


class UserSession(SQLModel, table=True):
    __tablename__ = "sessions"

    id: UUID = Field(default_factory=uuid7, primary_key=True, index=True)
    token: str = Field(unique=True, index=True, nullable=False)
    user_id: UUID = Field(foreign_key="users.id", index=True, nullable=False)
    created_at: datetime = Field(
        default_factory=lambda: datetime.now(timezone.utc),
        nullable=False,
        schema_extra={"sa_type": "TIMESTAMPTZ"} 
    )
    expires_at: datetime = Field(nullable=False, index=True)

    user: Optional["User"] = Relationship(back_populates="sessions")

    @property
    def is_expired(self) -> bool:
        expires = self.expires_at
        if expires.tzinfo is None:
            expires = expires.replace(tzinfo=timezone.utc)
        return datetime.now(timezone.utc) >= expires

    def is_within_grace_period(self, grace_minutes: int = 30) -> bool:
        expires = self.expires_at
        if expires.tzinfo is None:
            expires = expires.replace(tzinfo=timezone.utc)
        now = datetime.now(timezone.utc)
        return expires <= now <= expires + timedelta(minutes=grace_minutes)
