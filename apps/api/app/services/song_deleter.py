import asyncio
import logging
import shutil
from contextlib import nullcontext
from pathlib import Path
from uuid import UUID

from sqlmodel import Session, delete

from app.core.config import settings
from app.infra.database import engine
from app.models.playlist import PlaylistSong
from app.models.song import Song
from app.services.song_search import song_search
from app.services.storage import storage

logger = logging.getLogger("uvicorn.error")


class SongDeleter:
    def __init__(self, db: Session | None = None) -> None:
        self.db = db

    def _get_db(self):
        if self.db is not None:
            return nullcontext(self.db)
        return Session(engine)

    def _get_song_metadata(self, song_id: str) -> tuple[str | None, str | None]:
        """
        Fetch song original_key and cover_art_key from database if song record exists.
        Returns (original_key, cover_art_key).
        """
        try:
            with self._get_db() as db:
                song = db.get(Song, UUID(song_id))
                if song:
                    return song.original_key, song.cover_art_key
        except Exception as e:  # noqa: BLE001
            logger.warning("Could not read metadata for song %s: %s", song_id, e)
        return None, None

    async def execute_deletion_pipeline(self, song_id: str) -> None:
        """
        Executes the 4-step idempotent song deletion pipeline:
        1. Delete the directory starting with the {song_id} prefix in S3/R2 storage (and original_key).
        2. Delete the cover art if exists.
        3. Delete the song reference from PlaylistSongs.
        4. Delete the song row from Songs table, remove from search index, and clean scratch temp files.

        All steps are idempotent. An unhandled error in any step will cause BullMQ to retry the job.
        Only when all 4 steps complete will the job be marked complete in BullMQ.
        """
        logger.info("Starting deletion pipeline for song %s", song_id)

        # Retrieve asset keys if song is still in the database
        original_key, cover_art_key = self._get_song_metadata(song_id)

        # Step 1: Delete directory starting with {song_id} prefix in S3/R2 storage
        await self._delete_song_audio_storage(song_id, original_key)

        # Step 2: Delete cover art if exists
        await self._delete_cover_art_storage(song_id, cover_art_key)

        # Step 3: Delete song reference from PlaylistSongs
        self._delete_playlist_associations(song_id)

        # Step 4: Delete the song row from Songs table
        self._delete_song_database_record(song_id)

        logger.info("Successfully completed deletion pipeline for song %s", song_id)

    async def _delete_song_audio_storage(
        self, song_id: str, original_key: str | None
    ) -> None:
        """
        Step 1: Delete all objects with {song_id} prefix in S3/R2 storage,
        plus the raw original audio file if present.
        """
        logger.info("Step 1/4: Deleting storage objects with prefix '%s/'", song_id)
        # Delete all variant playlists and HLS segments under prefix
        await asyncio.to_thread(storage.delete_prefix, f"{song_id}/")
        # Also clean any non-slash prefix matching song_id
        await asyncio.to_thread(storage.delete_prefix, f"{song_id}")

        if original_key:
            logger.info("Step 1/4: Deleting raw original audio key '%s'", original_key)
            await asyncio.to_thread(storage.delete_file, original_key)

    async def _delete_cover_art_storage(
        self, song_id: str, cover_art_key: str | None
    ) -> None:
        """
        Step 2: Delete cover art file and any cover_art prefix matching the song.
        """
        logger.info("Step 2/4: Deleting cover art for song %s", song_id)
        if cover_art_key:
            await asyncio.to_thread(storage.delete_file, cover_art_key)

        cover_folder = settings.config.storage.cover_art_folder
        # Delete by prefix in cover art folder (e.g. cover_art/{song_id}*)
        await asyncio.to_thread(storage.delete_prefix, f"{cover_folder}/{song_id}")

    def _delete_playlist_associations(self, song_id: str) -> None:
        """
        Step 3: Delete song reference from PlaylistSongs.
        """
        logger.info("Step 3/4: Deleting playlist associations for song %s", song_id)
        with self._get_db() as db:
            db.exec(delete(PlaylistSong).where(PlaylistSong.song_id == UUID(song_id)))
            db.commit()

    def _delete_song_database_record(self, song_id: str) -> None:
        """
        Step 4: Delete the song row from Songs table, remove from search index,
        and clean up any local scratch temp files.
        """
        logger.info("Step 4/4: Deleting song row from database for %s", song_id)
        # Evict from search index
        try:
            song_search.remove_song(song_id)
        except Exception as e:  # noqa: BLE001
            logger.warning("Error evicting song %s from search index: %s", song_id, e)

        # Delete database row
        with self._get_db() as db:
            song = db.get(Song, UUID(song_id))
            if song:
                db.delete(song)
                db.commit()

        # Clean up any local scratch temp directory if it exists
        try:
            temp_scratch = (
                Path(settings.config.audio_processing.temp_scratch_directory) / song_id
            )
            if temp_scratch.exists():
                shutil.rmtree(temp_scratch, ignore_errors=True)
        except Exception as e:  # noqa: BLE001
            logger.warning("Error cleaning scratch directory for %s: %s", song_id, e)
