import asyncio
import logging
import shutil
from contextlib import nullcontext
from dataclasses import dataclass
from pathlib import Path

from sqlmodel import Session

from app.core.config import settings
from app.infra.database import engine
from app.services.song import SongService
from app.services.storage import storage
from app.utils.audio_processor import AudioProcessor, AudioProcessorResult

logger = logging.getLogger("uvicorn.error")


@dataclass
class StorageUpload:
    local_path: Path
    s3_key: str
    content_type: str | None = None


class SongProcessor:
    def __init__(self, db: Session | None = None) -> None:
        self.db = db
        self.base_folder: str = settings.config.audio_processing.temp_scratch_directory

    def _get_db(self):
        if self.db is not None:
            return nullcontext(self.db)
        return Session(engine)

    def _download_song(
        self,
        key: str,
        destination: Path,
    ) -> None:
        """
        Download song from S3 to local temporary storage
        """
        with open(destination, "wb") as f:
            f.writelines(storage.download_file(key))

    async def _prepare_workspace(
        self,
        song_id: str,
        original_key: str,
    ) -> tuple[Path, Path]:
        """
        Prepare workspace for song processing
        """
        base_dir = Path(self.base_folder)

        original_file = base_dir / original_key
        output_dir = base_dir / str(song_id)

        original_file.parent.mkdir(
            parents=True,
            exist_ok=True,
        )

        output_dir.mkdir(
            parents=True,
            exist_ok=True,
        )

        if not original_file.exists():
            await asyncio.to_thread(
                self._download_song,
                original_key,
                original_file,
            )

        return original_file, output_dir

    def _mark_processing(self, song_id: str) -> None:
        """
        Mark song as processing using SongService
        """
        try:
            with self._get_db() as db:
                SongService(db).mark_processing(song_id)
        except Exception as e:  # noqa: BLE001
            logger.warning("Could not mark song %s as processing: %s", song_id, e)

    def _mark_failed(
        self,
        song_id: str,
        error: Exception,
    ) -> None:
        """
        Mark song as failed using SongService
        """
        logger.error(
            "Audio processing failed for song %s: %s",
            song_id,
            error,
        )

        try:
            with Session(engine) as db:
                SongService(db).mark_failed(song_id)
        except Exception as e:  # noqa: BLE001
            logger.error("Could not mark song %s as failed in database: %s", song_id, e)

    async def _process_audio(
        self,
        original_file: Path,
        output_dir: Path,
        trim_start_sec: float,
    ) -> AudioProcessorResult:
        """
        Process audio file via ffmpeg HLS pipeline
        """
        processor = AudioProcessor(
            source_path=str(original_file),
            output_root=str(output_dir),
            trim_start_sec=trim_start_sec,
        )

        await processor.process()
        await processor.extract_cover_art()

        return processor.result

    def _build_upload_manifest(
        self,
        song_id: str,
        result: AudioProcessorResult,
    ) -> tuple[list[StorageUpload], str | None, str | None, str | None]:
        """
        Build upload manifest for HLS playlists, segments, and cover art
        """
        storage_base_key = f"{song_id}/"

        uploads: list[StorageUpload] = []

        master_mp3_key = self._add_master_playlist(
            uploads,
            result.master_playlist_paths.get("mp3"),
            storage_base_key,
        )

        master_aac_key = self._add_master_playlist(
            uploads,
            result.master_playlist_paths.get("aac"),
            storage_base_key,
        )

        self._add_rendition_files(
            uploads,
            result.renditions,
            storage_base_key,
        )

        cover_art_key = self._add_cover_art(
            uploads,
            song_id,
            result.cover_art_path,
        )

        return (
            uploads,
            master_mp3_key,
            master_aac_key,
            cover_art_key,
        )

    def _add_master_playlist(
        self,
        uploads: list[StorageUpload],
        playlist_path: str | None,
        storage_base_key: str,
    ) -> str | None:
        """
        Add master playlist to upload manifest
        """
        if not playlist_path:
            return None

        s3_key = f"{storage_base_key}{Path(playlist_path).name}"

        uploads.append(
            StorageUpload(
                local_path=Path(playlist_path),
                s3_key=s3_key,
                content_type="application/vnd.apple.mpegurl",
            )
        )

        return s3_key

    def _add_rendition_files(
        self,
        uploads: list[StorageUpload],
        renditions,
        storage_base_key: str,
    ) -> None:
        """
        Add rendition files to upload manifest
        """
        for rendition in renditions:
            variant_base_key = (
                f"{storage_base_key}{rendition.format}/{rendition.bitrate_kbps}k"
            )

            for file_path in Path(rendition.segment_dir).iterdir():
                if not file_path.is_file():
                    continue

                content_type = (
                    "application/vnd.apple.mpegurl"
                    if file_path.suffix == ".m3u8"
                    else "video/mp2t"
                )

                uploads.append(
                    StorageUpload(
                        local_path=file_path,
                        s3_key=f"{variant_base_key}/{file_path.name}",
                        content_type=content_type,
                    )
                )

    def _add_cover_art(
        self,
        uploads: list[StorageUpload],
        song_id: str,
        cover_art_path: str | None,
    ) -> str | None:
        """
        Add cover art to upload manifest
        """
        if not cover_art_path:
            return None

        path = Path(cover_art_path)

        cover_art_key = f"{settings.config.storage.cover_art_folder}/{song_id}.{path.suffix.lstrip('.')}"

        uploads.append(
            StorageUpload(
                local_path=path,
                s3_key=cover_art_key,
                content_type="image/jpeg",
            )
        )

        return cover_art_key

    async def _upload_processed_files(
        self,
        uploads: list[StorageUpload],
    ) -> None:
        """
        Upload processed files to S3 concurrently (throttled to configured concurrency)
        """
        limit = settings.config.audio_processing.max_concurrent_s3_uploads
        semaphore = asyncio.Semaphore(limit)

        async def _upload_single(upload: StorageUpload) -> None:
            async with semaphore:
                await asyncio.to_thread(self._upload_file, upload)

        await asyncio.gather(*[_upload_single(u) for u in uploads])
        logger.info("Uploaded %d processed files to S3", len(uploads))

    def _upload_file(
        self,
        upload: StorageUpload,
    ) -> None:
        """
        Upload processed file to S3
        """
        with open(upload.local_path, "rb") as f:
            storage.upload_file(
                upload.s3_key,
                f,
                upload.content_type,
            )

    def _mark_completed(
        self,
        song_id: str,
        result: AudioProcessorResult,
        master_mp3_key: str | None,
        master_aac_key: str | None,
        cover_art_key: str | None,
    ) -> None:
        """
        Mark song as completed and update search index via SongService
        """
        metadata = result.metadata

        with self._get_db() as db:
            SongService(db).mark_completed(
                song_id=song_id,
                title=metadata.title,
                artist=metadata.artist,
                year=(
                    int(metadata.year)
                    if metadata.year and metadata.year.isdigit()
                    else None
                ),
                album=metadata.album,
                duration_sec=round(metadata.duration_sec),
                bitrate_kbps=metadata.bitrate_kbps,
                master_mp3_key=master_mp3_key,
                master_aac_key=master_aac_key,
                cover_art_key=cover_art_key,
            )

        logger.info(
            "Song %s processed successfully",
            song_id,
        )

    def _cleanup_workspace(
        self,
        original_file: Path,
        output_dir: Path,
    ) -> None:
        """
        Cleanup temporary workspace files safely
        """
        try:
            if original_file.exists():
                original_file.unlink(missing_ok=True)
            if output_dir.exists():
                shutil.rmtree(output_dir, ignore_errors=True)
            logger.info("Cleaned up workspace directory: %s", output_dir)
        except Exception as e:  # noqa: BLE001
            logger.warning(
                "Could not cleanup workspace for %s: %s",
                original_file,
                e,
            )

    async def _tag_song_properties(self, song_id: str) -> None:
        """
        Trigger agent to identify mood, genre, and language via SongService.sync_properties.
        Failures are logged as warnings and never propagate or fail the pipeline.
        """
        try:
            with self._get_db() as db:
                await SongService(db).sync_properties(song_id)
            logger.info("Tagged song properties successfully for song %s", song_id)
        except Exception as e:  # noqa: BLE001
            logger.warning("Failed to fetch song properties %s: %s", song_id, e)

    async def start_processing_pipeline(
        self,
        song_id: str,
        trim_start_sec: float,
        song_service: SongService | None = None,
    ) -> None:
        """
        Start song processing pipeline
        """
        # Fetch initial song record via SongService
        with self._get_db() as db:
            try:
                song = SongService(db).get_song(song_id)
                original_key = song.original_key
            except Exception as e:
                logger.error("Song %s not found in database: %s", song_id, e)
                return

        try:
            original_file, output_dir = await self._prepare_workspace(
                song_id, original_key
            )

            self._mark_processing(song_id)

            result: AudioProcessorResult = await self._process_audio(
                original_file,
                output_dir,
                trim_start_sec,
            )

            (
                uploads,
                master_mp3_key,
                master_aac_key,
                cover_art_key,
            ) = self._build_upload_manifest(
                song_id,
                result,
            )

            await self._upload_processed_files(uploads)

            self._mark_completed(
                song_id,
                result,
                master_mp3_key,
                master_aac_key,
                cover_art_key,
            )

            await asyncio.to_thread(
                self._cleanup_workspace,
                original_file,
                output_dir,
            )

            # Auto-tag song with genre, moods, and language
            await self._tag_song_properties(song_id)

        except Exception as e:  # noqa: BLE001
            self._mark_failed(song_id, e)


song_processor = SongProcessor()
