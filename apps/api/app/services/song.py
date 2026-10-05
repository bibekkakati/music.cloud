import logging
from uuid import UUID, uuid7

from sqlmodel import Session, select

from app.core.config import settings
from app.infra.mq import queue
from app.models.song import Song, SongProcessingStatus
from app.models.user import User
from app.schemas.song import SongUploadResponsePayload
from app.services.storage import storage

logger = logging.getLogger("uvicorn.error")


class SongService:
    def __init__(self, db: Session) -> None:
        self.db = db
        self.base_folder: str = "./tmp"

    def get_stream_url(self, master_aac_key: str | None, master_mp3_key: str | None = None) -> str | None:
        """
        Build the absolute stream URL for the song.
        Prefers HLS AAC master playlist (master_aac_key), falls back to master_mp3_key.
        """
        key = master_aac_key or master_mp3_key
        if not key:
            return None
        if key.startswith("http://") or key.startswith("https://"):
            return key
        stream_base_url = (settings.EDGE_WORKER_URL or "").rstrip("/")
        if not stream_base_url:
            return key
        return f"{stream_base_url}/{key.lstrip('/')}"

    def get_cover_art_url(self, cover_art_key: str | None) -> str | None:
        """
        Build the Edge URL for song cover art.
        Served directly by the edge Edge worker with aggressive caching.
        """
        if not cover_art_key:
            return None
        if cover_art_key.startswith("http://") or cover_art_key.startswith("https://"):
            return cover_art_key
        base_url = settings.EDGE_WORKER_URL.rstrip("/")
        return f"{base_url}/{cover_art_key.lstrip('/')}"

    def get_song(self, song_id: str) -> Song:
        """
        Get song from database
        """
        song = self.db.get(Song, song_id)

        if not song:
            raise ValueError("Song not found")

        return song

    def get_all_songs(
        self,
        cursor: str | UUID | None = None,
        status: SongProcessingStatus = None,
        is_public: bool | None = None,
        limit: int | None = 20,
    ) -> list[Song]:
        """
        Get all songs from database

        Args:
            cursor: Cursor for pagination (cursor is uuidv7 timestamp sorted)
            status: Optional song processing status filter
            is_public: Optional song visibility filter (True for public, False for private)
            limit: Optional query limit (default 20, None for no limit)

        Returns:
            List of songs (descending order)
        """
        query = select(Song)

        if cursor:
            cursor_uuid: UUID | None = None
            if isinstance(cursor, UUID):
                cursor_uuid = cursor
            elif isinstance(cursor, str) and cursor.strip() and cursor.strip() != "0":
                try:
                    cursor_uuid = UUID(cursor.strip())
                except ValueError:
                    cursor_uuid = None

            if cursor_uuid:
                query = query.where(Song.id < cursor_uuid)

        if status:
            query = query.where(Song.status == status)

        if is_public is not None:
            query = query.where(Song.is_public == is_public)

        if limit is not None:
            query = query.limit(limit)

        query = query.order_by(Song.id.desc())

        result = self.db.exec(query).all()

        return result

    def get_upload_url(
        self,
        user: User,
        title: str,
        artist: str,
        extension: str,
        content_type: str,
        is_public: bool = False,
    ) -> SongUploadResponsePayload:
        """
        Generates a pre-signed S3 PUT URL for uploading the original song file.
        Creates a song record in the database with status UPLOADING.
        """

        original_key = f"originals/{uuid7().hex}.{extension}"

        song = self.create_song(user, title, artist, original_key, is_public=is_public)
        song_id = str(song.id)

        url = storage.generate_presigned_upload_url(
            key=original_key, content_type=content_type
        )
        return SongUploadResponsePayload(id=song_id, url=url, key=original_key)

    def create_song(
        self, user: User, title: str, artist: str, key: str, is_public: bool = False
    ) -> Song:
        """
        Creates a song record in the database with status UPLOADING.
        """
        song = Song(
            title=title,
            artist=artist,
            original_key=key,
            uploaded_by=user.id,
            is_public=is_public,
        )
        self.db.add(song)
        self.db.commit()
        self.db.refresh(song)

        return song

    def update_song_metadata(
        self, song_id: str, title: str, artist: str, is_public: bool | None = None
    ) -> Song:
        """
        Updates the metadata of a song.
        """
        song = self.get_song(song_id)

        song.title = title
        song.artist = artist
        if is_public is not None:
            song.is_public = is_public

        self.db.add(song)
        self.db.commit()
        self.db.refresh(song)

        return song

    def update_song_visibility(self, song_id: str, is_public: bool) -> Song:
        """
        Updates the visibility (public/private) of a song.
        """
        song = self.get_song(song_id)

        song.is_public = is_public

        self.db.add(song)
        self.db.commit()
        self.db.refresh(song)

        return song

    async def process_song(self, user: User, song_id: str, trim_start_sec: float) -> Song:
        """
        Process song after upload (extract metadata, generate variants, etc).
        """
        song = self.db.exec(
            select(Song).where(Song.id == song_id).where(Song.uploaded_by == user.id)
        ).first()

        if not song:
            raise ValueError("Song not found")

        if song.status in [SongProcessingStatus.PROCESSING, SongProcessingStatus.DONE]:
            pass

        song.status = SongProcessingStatus.UPLOADED
        self.db.add(song)
        self.db.commit()
        self.db.refresh(song)

        await queue.add(
            "process-song",
            {"song_id": str(song.id), "trim_start_sec": trim_start_sec},
            {"attempts": 2},
        )

        return song
