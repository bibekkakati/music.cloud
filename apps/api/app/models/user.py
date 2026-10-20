from datetime import UTC, datetime
from typing import TYPE_CHECKING
from uuid import UUID, uuid7

from sqlmodel import Field, Relationship, SQLModel

if TYPE_CHECKING:
    from app.models.session import UserSession


class User(SQLModel, table=True):
    __tablename__ = "users"

    id: UUID = Field(default_factory=uuid7, primary_key=True, index=True)
    email: str = Field(unique=True, index=True, nullable=False)
    hashed_password: str = Field(nullable=False)
    is_admin: bool = Field(default=False)
    last_active_at: datetime | None = Field(
        default=None,
        nullable=True,
        schema_extra={"sa_type": "TIMESTAMPTZ"},
    )
    created_at: datetime = Field(
        default_factory=lambda: datetime.now(UTC),
        nullable=False,
        schema_extra={"sa_type": "TIMESTAMPTZ"},
    )
    updated_at: datetime = Field(
        default_factory=lambda: datetime.now(UTC),
        nullable=False,
        schema_extra={"sa_type": "TIMESTAMPTZ"},
    )

    sessions: list["UserSession"] = Relationship(
        back_populates="user", cascade_delete=True
    )
