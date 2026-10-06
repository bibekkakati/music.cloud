from datetime import datetime
from uuid import UUID

from pydantic import BaseModel


# --- Public / Standard User Schemas ---
class SongPublicResponsePayload(BaseModel):
    id: UUID | str
    title: str
    artist: str
    duration_sec: int | None = None
    cover_art_url: str | None = None
    stream_url: str | None = None


# --- Admin Only Schemas ---
class AdminSongResponsePayload(BaseModel):
    id: UUID | str
    title: str
    artist: str
    duration_sec: int | None = None
    original_key: str
    master_mp3_key: str | None = None
    master_aac_key: str | None = None
    cover_art_key: str | None = None
    cover_art_url: str | None = None
    source_bitrate_kbps: int | None = None
    status: str | None = None
    is_public: bool = False
    created_at: datetime
    updated_at: datetime


# Aliases for backward compatibility
SongMetadataResponsePayload = SongPublicResponsePayload
SongSearchResponsePayload = SongPublicResponsePayload
SongResponsePayload = AdminSongResponsePayload


class SongUploadResponsePayload(BaseModel):
    id: UUID | str
    url: str
    key: str


class SongProcessRequestPayload(BaseModel):
    song_id: str
    trim_start_sec: float = 0.0


class CoverArtUploadResponsePayload(BaseModel):
    song_id: str
    url: str
    key: str


class CoverArtUpdateRequestPayload(BaseModel):
    cover_art_key: str


class SongMetaDataUpdateRequestPayload(BaseModel):
    song_id: str
    title: str
    artist: str = "Unknown"
    is_public: bool | None = None
    cover_art_key: str | None = None


class SongVisibilityUpdateRequestPayload(BaseModel):
    song_id: str
    is_public: bool


class StreamTokenResponsePayload(BaseModel):
    token: str
    token_type: str = "bearer"
    expires_at: datetime


class StreamSongResponsePayload(BaseModel):
    id: UUID | str
    title: str | None = None
    artist: str | None = None
    master_mp3_key: str | None = None
    master_aac_key: str | None = None
    cover_art_url: str | None = None