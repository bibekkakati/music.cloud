from uuid import uuid7, UUID
from datetime import datetime, timezone

from sqlmodel import Field, SQLModel

class Playlist(SQLModel, table=True):
    __tablename__ = "playlists"

    id: UUID = Field(default_factory=uuid7, primary_key=True, index=True)
    label: str = Field(nullable=False)
    owner_id: UUID = Field(nullable=False, foreign_key="users.id")
    is_deletable: bool = Field(default=True, nullable=False)
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

class PlaylistSong(SQLModel, table=True):
    __tablename__ = "playlist_songs"
    id: UUID = Field(default_factory=uuid7, primary_key=True, index=True)
    playlist_id: UUID = Field(nullable=False, foreign_key="playlists.id", index=True)
    song_id: UUID = Field(nullable=False, foreign_key="songs.id")
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
    