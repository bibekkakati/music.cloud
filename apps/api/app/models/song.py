from uuid import uuid7, UUID
from datetime import datetime, timezone
from enum import Enum

from sqlmodel import Field, SQLModel


class SongProcessingStatus(str, Enum):
    UPLOADING = "uploading"
    UPLOADED = "uploaded"
    PROCESSING = "processing"
    DONE = "done"
    FAILED = "failed"


class Song(SQLModel, table=True):
    __tablename__ = "songs"

    id: UUID = Field(default_factory=uuid7, primary_key=True, index=True)
    title: str = Field(nullable=False)
    artist: str = Field(nullable=False)
    duration_sec: int = Field(nullable=True)
    original_key: str = Field(nullable=False)
    master_mp3_key: str = Field(nullable=True)
    master_aac_key: str = Field(nullable=True)
    cover_art_key: str = Field(nullable=True)
    source_bitrate_kbps: int = Field(nullable=True)
    status: SongProcessingStatus = Field(default=SongProcessingStatus.UPLOADING)
    is_public: bool = Field(default=False, nullable=False)

    uploaded_by: UUID = Field(nullable=False, foreign_key="users.id")
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
