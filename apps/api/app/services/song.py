import asyncio
import logging
from datetime import UTC, datetime
from uuid import UUID, uuid7

from sqlmodel import Session, select

from app.core.config import settings
from app.infra.mq import queue
from app.models.song import Song, SongProcessingStatus
from app.models.user import User
from app.schemas.song import (
    CoverArtUploadResponsePayload,
    SongDownloadUrlResponsePayload,
    SongUploadResponsePayload,
)
from app.services.ai_agent import aiagent
from app.services.master import MasterService
from app.services.song_search import SongSearchPayload, song_search
from app.services.storage import storage

logger = logging.getLogger("uvicorn.error")


class SongService:
    def __init__(self, db: Session) -> None:
        self.db = db
        self.base_folder: str = "./tmp"

    def get_song(self, song_id: str | UUID) -> Song:
        """
        Get song from database
        """
        song = self.db.get(Song, song_id)

        if not song:
            raise ValueError("Song not found")

        return song

    def get_songs_by_ids(
        self, song_ids: list[str | UUID]
    ) -> list[Song | SongSearchPayload]:
        """
        Fetch raw song entities for a list of song IDs.
        Priority:
        1. In-memory song_search index.
        2. Database query for any missing IDs.
        Preserves requested order.
        """
        if not song_ids:
            return []

        # Deduplicate while preserving order
        ordered_ids: list[str] = list(
            dict.fromkeys(str(sid).strip() for sid in song_ids if sid and str(sid).strip())
        )
        found_map: dict[str, Song | SongSearchPayload] = {}

        # 1. First priority: Check in song_search index
        for sid in ordered_ids:
            cached_payload = song_search.songs_by_id.get(sid)
            if cached_payload:
                found_map[sid] = cached_payload

        # 2. Fetch missing IDs from database
        missing_ids = [sid for sid in ordered_ids if sid not in found_map]
        if missing_ids:
            missing_uuids: list[UUID] = []
            for sid in missing_ids:
                try:
                    missing_uuids.append(UUID(sid))
                except (ValueError, TypeError):
                    pass

            if missing_uuids:
                db_songs = self.db.exec(
                    select(Song).where(
                        Song.id.in_(missing_uuids),
                        Song.is_public == True,
                        Song.status == SongProcessingStatus.DONE,
                    )
                ).all()

                for song in db_songs:
                    found_map[str(song.id)] = song

        # Return raw song entities ordered according to requested list
        return [found_map[sid] for sid in ordered_ids if sid in found_map]

    def mark_processing(self, song_id: str | UUID) -> None:
        """Mark song status as PROCESSING."""
        song = self.db.get(Song, song_id)
        if song:
            song.status = SongProcessingStatus.PROCESSING
            self.db.add(song)
            self.db.commit()

    def mark_failed(self, song_id: str | UUID) -> None:
        """Mark song status as FAILED."""
        song = self.db.get(Song, song_id)
        if song:
            song.status = SongProcessingStatus.FAILED
            self.db.add(song)
            self.db.commit()

    def mark_completed(
        self,
        song_id: str | UUID,
        title: str | None,
        artist: str | None,
        year: int | None,
        album: str | None,
        duration_sec: int,
        bitrate_kbps: int,
        master_mp3_key: str | None,
        master_aac_key: str | None,
        cover_art_key: str | None,
    ) -> Song | None:
        """Mark song as completed with extracted audio metadata and update search index."""
        song = self.db.get(Song, song_id)
        if not song:
            logger.error("Song %s not found when marking completed", song_id)
            return None

        if title:
            song.title = title
        if artist:
            clean_artist = artist.replace("/", ", ").replace("-", " ")
            song.artist = clean_artist

        song.year = year
        song.album = album
        song.duration_sec = duration_sec
        song.source_bitrate_kbps = bitrate_kbps
        song.master_mp3_key = master_mp3_key
        song.master_aac_key = master_aac_key
        song.cover_art_key = cover_art_key
        song.status = SongProcessingStatus.DONE
        song.updated_at = datetime.now(UTC)

        self.db.add(song)
        self.db.commit()
        self.db.refresh(song)

        song_search.update_song(song)
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
            key=original_key,
            content_type=content_type,
            expires_in=settings.config.storage.presigned_upload_expiry_seconds,
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

    def get_cover_art_upload_url(
        self,
        song_id: str,
        extension: str,
        content_type: str,
    ) -> CoverArtUploadResponsePayload:
        """
        Generates a pre-signed S3/R2 PUT URL for uploading song cover art.
        Key format: cover_art/{song_id}.{extension} (standard format used across system).
        """
        song = self.get_song(song_id)
        ext = extension.lstrip(".").lower()
        if ext == "jpeg":
            ext = "jpg"
        cover_art_key = f"{settings.config.storage.cover_art_folder}/{song.id}.{ext}"

        url = storage.generate_presigned_upload_url(
            key=cover_art_key,
            content_type=content_type,
            expires_in=settings.config.storage.presigned_upload_expiry_seconds,
        )
        return CoverArtUploadResponsePayload(
            song_id=str(song.id),
            url=url,
            key=cover_art_key,
        )

    def update_song_cover_art(
        self,
        song_id: str,
        cover_art_key: str,
    ) -> Song:
        """
        Updates the cover_art_key of a song.
        """
        song = self.get_song(song_id)
        song.cover_art_key = cover_art_key
        song.updated_at = datetime.now(UTC)

        self.db.add(song)
        self.db.commit()
        self.db.refresh(song)

        return song

    def update_song_metadata(
        self,
        song_id: str,
        title: str,
        artist: str,
        is_public: bool | None = None,
        cover_art_key: str | None = None,
    ) -> Song:
        """
        Updates the metadata of a song, optionally including cover art key.
        """
        song = self.get_song(song_id)

        song.title = title
        song.artist = artist
        if is_public is not None:
            song.is_public = is_public
        if cover_art_key is not None:
            song.cover_art_key = cover_art_key
        song.updated_at = datetime.now(UTC)

        self.db.add(song)
        self.db.commit()
        self.db.refresh(song)

        return song

    async def process_song(
        self, user: User, song_id: str, trim_start_sec: float
    ) -> Song:
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

    def get_song_download_url(
        self,
        song_id: str,
    ) -> SongDownloadUrlResponsePayload:
        """
        Generates a pre-signed download URL for original song.
        """
        song = self.get_song(song_id)

        url = storage.generate_presigned_download_url(
            key=song.original_key,
        )
        return SongDownloadUrlResponsePayload(
            song_id=str(song.id),
            url=url,
            key=song.original_key,
        )

    async def delete_song(self, song_id: str) -> None:
        """
        Enqueues asynchronous permanent song deletion to BullMQ and evicts song from search index.
        """
        song = self.get_song(song_id)

        # Evict from search index immediately so user queries won't return it
        try:
            song_search.remove_song(str(song.id))
        except Exception as e:  # noqa: BLE001
            logger.warning("Error evicting song %s from search index: %s", song_id, e)

        # Enqueue job to BullMQ sending only the song_id
        await queue.add(
            "delete-song",
            {"song_id": str(song.id)},
            {"attempts": 3, "removeOnComplete": True},
        )

    async def sync_properties(self, song_id: str | UUID) -> Song:
        """
        Manually trigger the agent to extract genre, moods, and language for a song,
        map them using MasterService, and save to the database and search index.
        """
        song = self.get_song(song_id)

        properties = await asyncio.to_thread(
            aiagent.get_song_properties,
            title=song.title,
            artist=song.artist,
            album=song.album,
        )

        if not properties:
            raise ValueError(
                f"Agent could not identify properties for '{song.title}'. Please verify the title/artist or try again."
            )

        master_service = MasterService(self.db)

        # Resolve genre ID
        genre_res = master_service.get_genre_by_name(properties.genre.value)
        song.genre = genre_res[0] if genre_res else None

        # Resolve mood IDs
        mood_ids = []
        for m in properties.moods:
            m_res = master_service.get_mood_by_name(m.value)
            if m_res:
                mood_ids.append(m_res[0])
        song.moods = mood_ids

        # Resolve language ID
        lang_res = master_service.get_language_by_name(properties.language.value)
        song.language = lang_res[0] if lang_res else None

        song.updated_at = datetime.now(UTC)
        self.db.add(song)
        self.db.commit()
        self.db.refresh(song)

        song_search.update_song(song)
        return song
