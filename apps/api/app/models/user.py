from uuid import uuid7, UUID
from datetime import datetime, timezone
from typing import TYPE_CHECKING

from sqlmodel import Field, Relationship, SQLModel

if TYPE_CHECKING:
    from app.models.session import UserSession


class User(SQLModel, table=True):
    __tablename__ = "users"

    id: UUID = Field(default_factory=uuid7, primary_key=True, index=True)
    email: str = Field(unique=True, index=True, nullable=False)
    is_admin: bool = Field(default=False)
    created_at: datetime = Field(
        default_factory=lambda: datetime.now(timezone.utc),
        nullable=False,
        schema_extra={"sa_type": "TIMESTAMPTZ"} 
    )
    updated_at: datetime = Field(
        default_factory=lambda: datetime.now(timezone.utc),
        nullable=False,
        schema_extra={"sa_type": "TIMESTAMPTZ"}
    )

    sessions: list["UserSession"] = Relationship(
        back_populates="user", cascade_delete=True
    )
