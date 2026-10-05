"""
Audio processing pipeline.

Public API: `AudioProcessor.process()` — the sole async entry point.

Steps (internal):
1. Probe uploaded file for quality info (bitrate, codec, sample rate).
2. Transcode into required renditions: {aac} × {256k, 320k}.
3. Package each rendition as HLS (segments + playlist).
4. Build a master playlist referencing all renditions (per format).
5. Run steps 2-3 either sequentially or in parallel across available vCPUs.

Requires: ffmpeg, ffprobe on PATH.
"""

import asyncio
import json
import logging
import os
import shutil
import subprocess
from concurrent.futures import ThreadPoolExecutor, as_completed
from dataclasses import dataclass
from pathlib import Path
from typing import Literal

__all__ = ["AudioProcessor"]

logger = logging.getLogger("uvicorn.error")

# ffprobe tag keys vary by container/tagger (ID3 vs Vorbis comments vs MP4 atoms).
# Map several possible source keys to one normalized field.
_TAG_ALIASES = {
    "title": ["title"],
    "artist": ["artist"],
    "album": ["album"],
    "album_artist": ["album_artist", "albumartist", "album artist"],
    "genre": ["genre"],
    "year": ["date", "year", "TYER", "TDRC"],
    "track_number": ["track", "tracknumber", "TRCK"],
}

from app.core.config import settings

Format = Literal["aac"]

BITRATES: list[int] = settings.config.audio_processing.target_bitrates_kbps
FORMATS: list[Format] = settings.config.audio_processing.target_format
HLS_FIRST_SEGMENT_SECONDS: int = settings.config.audio_processing.hls_first_segment_duration_seconds
HLS_SEGMENT_SECONDS: int = settings.config.audio_processing.hls_segment_duration_seconds
FFMPEG_TIMEOUT_SECONDS: int = settings.config.audio_processing.ffmpeg_timeout_seconds
FFPROBE_TIMEOUT_SECONDS: int = settings.config.audio_processing.ffprobe_timeout_seconds
TOLERANCE_KBPS: int = settings.config.audio_processing.bitrate_tolerance_kbps

FORMAT_SETTINGS: dict = {
    "mp3": {"codec": "libmp3lame", "hls_segment_type": "mpegts", "ext": "ts"},
    "aac": {"codec": "aac", "hls_segment_type": "mpegts", "ext": "ts"},
}


# --------------------------------------------------------------------------
# Internal dataclasses (module-level so they're picklable for the process pool)
# --------------------------------------------------------------------------


@dataclass
class AudioInfo:
    path: str
    duration_sec: float
    bitrate_kbps: int
    sample_rate: int
    codec: str
    channels: int
    title: str | None = None
    artist: str | None = None
    album: str | None = None
    album_artist: str | None = None
    genre: str | None = None
    year: str | None = None
    track_number: str | None = None
    has_embedded_art: bool = False


@dataclass
class _RenditionJob:
    source_path: str
    output_dir: str  # e.g. .../aac/256k
    format: Format
    bitrate_kbps: int
    trim_start_sec: float = 0.0  # seconds to skip from the front
    duration_sec: float = 0.0  # source duration, used to compute cut times


@dataclass
class _RenditionResult:
    format: Format
    bitrate_kbps: int
    playlist_path: str
    segment_dir: str
    ok: bool
    error: str | None = None


@dataclass
class ProcessingResult:
    """
    Everything about a completed run, stored on the processor instance
    after process() finishes. Every path here is absolute, so a caller
    (e.g. an uploader) never needs to reconstruct paths from output_root.
    """

    metadata: AudioInfo
    output_root: str
    renditions: list[_RenditionResult]
    master_playlist_paths: dict[Format, str]  # {"aac": "/abs/.../master_aac.m3u8"}
    cover_art_path: str | None
    workers_used: int


class AudioProcessor:
    """
    Encapsulates the full audio-to-HLS pipeline for a single file.

    Every path produced during processing (output root, master playlists,
    per-rendition playlists/segment dirs, cover art) is stored on the
    instance after `process()` completes, so callers don't need to
    re-derive or pass around output_root themselves - just read the
    processor's properties.

    Usage::
        processor = AudioProcessor("upload.mp3", "/out/hls", trim_start_sec=0)
        await processor.process()

        processor.output_root            # "/out/hls"
        processor.master_playlist_paths  # {"aac": "/out/hls/master_aac.m3u8"}
        processor.info                   # AudioInfo(...)
        processor.result                 # full ProcessingResult
    """

    def __init__(
        self,
        source_path: str,
        output_root: str,
        trim_start_sec: float = 0.0,
        max_workers: int | None = None,
    ) -> None:
        """
        Args:
            source_path:    Path to the uploaded audio file.
            output_root:    Directory for all generated HLS output.
            trim_start_sec: Seconds to skip from the front.
            max_workers:    Parallel ffmpeg workers (None = auto/vCPU count).
        """
        self._source_path = str(Path(source_path).resolve())
        self._output_root = str(Path(output_root).resolve())
        self.trim_start_sec = trim_start_sec
        self._max_workers = max_workers

        # Populated during process(); None/empty until then.
        self._info: AudioInfo | None = None
        self._renditions: list[_RenditionResult] = []
        self._master_playlist_paths: dict[Format, str] = {}
        self._cover_art_path: str | None = None
        self._workers_used: int | None = None
        self._processed: bool = False

    # ------------------------------------------------------------------
    # Public read-only properties
    # ------------------------------------------------------------------

    @property
    def source_path(self) -> str:
        return self._source_path

    @property
    def output_root(self) -> str:
        return self._output_root

    @property
    def info(self) -> AudioInfo:
        self._require_processed()
        return self._info

    @property
    def renditions(self) -> list[_RenditionResult]:
        self._require_processed()
        return self._renditions

    @property
    def master_playlist_paths(self) -> dict[Format, str]:
        """e.g. {"aac": "/out/hls/song_1/master_aac.m3u8"}"""
        self._require_processed()
        return self._master_playlist_paths

    @property
    def cover_art_path(self) -> str | None:
        """None if process() hasn't run, or the source has no embedded art."""
        return self._cover_art_path

    @property
    def is_processed(self) -> bool:
        return self._processed

    @property
    def result(self) -> ProcessingResult:
        """Full snapshot of everything produced by this run."""
        self._require_processed()
        return ProcessingResult(
            metadata=self._info,
            output_root=self._output_root,
            renditions=self._renditions,
            master_playlist_paths=self._master_playlist_paths,
            cover_art_path=self._cover_art_path,
            workers_used=self._workers_used,
        )

    def _require_processed(self) -> None:
        if not self._processed:
            raise RuntimeError(
                "AudioProcessor.process() must complete before accessing this property."
            )

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    async def process(self) -> None:
        """
        Async entry point — the only public method that does work.

        Runs the blocking pipeline in a background thread via asyncio's
        default executor, so the FastAPI event loop stays free to serve
        other requests while ffmpeg jobs run.

        After this completes, all result data is available via this
        instance's properties (info, renditions, master_playlist_paths,
        cover_art_path, result) — nothing is returned directly.

        Raises:
            FileNotFoundError: If source_path does not exist.
            RuntimeError:      If ffmpeg/ffprobe missing or any rendition fails.
            ValueError:        If trim_start_sec is invalid or source has zero duration.
        """
        if not Path(self._source_path).is_file():
            raise FileNotFoundError(f"Source file does not exist: {self._source_path}")

        if not shutil.which("ffmpeg") or not shutil.which("ffprobe"):
            raise RuntimeError(
                "ffmpeg and ffprobe must be installed and available on PATH"
            )

        loop = asyncio.get_running_loop()
        await loop.run_in_executor(
            None,  # default ThreadPoolExecutor
            self._run_pipeline,
        )

    async def extract_cover_art(self) -> str | None:
        """
        Extract embedded cover art (if present) to a standalone image file
        under output_root. Stores the result on the instance
        (cover_art_path) and also returns it.

        Safe to call before or after process() - only needs the source
        file, not any transcoding output. Runs off the event loop thread
        since it shells out to ffmpeg.
        """
        Path(self._output_root).mkdir(parents=True, exist_ok=True)
        loop = asyncio.get_running_loop()
        path = await loop.run_in_executor(None, self._extract_cover_art_sync)
        self._cover_art_path = path
        return path

    # ------------------------------------------------------------------
    # Orchestration methods
    # ------------------------------------------------------------------

    def _extract_cover_art_sync(self) -> str | None:
        cover_art_path = os.path.join(self._output_root, "cover.jpg")
        cmd = [
            "ffmpeg",
            "-y",
            "-i",
            self._source_path,
            "-an",
            "-vcodec",
            "copy",
            cover_art_path,
        ]
        try:
            subprocess.run(cmd, capture_output=True, text=True, check=True)
            return cover_art_path if os.path.exists(cover_art_path) else None
        except subprocess.CalledProcessError:
            return None

    def _run_pipeline(self) -> None:
        """Full blocking pipeline — called from the async wrapper."""
        Path(self._output_root).mkdir(parents=True, exist_ok=True)

        # Step 1: Probe
        self._info = self._probe_audio()
        logger.info(
            "Probed %s: %s %dkbps %dHz %dch %.1fs",
            self._source_path,
            self._info.codec,
            self._info.bitrate_kbps,
            self._info.sample_rate,
            self._info.channels,
            self._info.duration_sec,
        )

        if self.trim_start_sec < 0:
            raise ValueError(f"trim_start_sec must be >= 0, got {self.trim_start_sec}")
        if self.trim_start_sec >= self._info.duration_sec:
            raise ValueError(
                f"trim_start_sec ({self.trim_start_sec}s) is >= source duration "
                f"({self._info.duration_sec}s) - nothing would be left to encode"
            )

        # Step 2+3: build jobs, gated by source quality (never upscale)
        jobs = self._build_jobs()
        logger.info("Created %d rendition jobs", len(jobs))

        cpu_count = os.cpu_count() or 1
        workers = self._max_workers if self._max_workers is not None else cpu_count

        results = self._execute_jobs(jobs, workers)

        failed = [r for r in results if not r.ok]
        if failed:
            details = "\n".join(
                f"- {r.format} {r.bitrate_kbps}k: {r.error}" for r in failed
            )
            raise RuntimeError(f"{len(failed)} rendition(s) failed:\n{details}")

        # Step 4: master playlist per format
        master_playlists = {
            fmt: self._build_master_playlist(self._output_root, results, fmt)
            for fmt in FORMATS
        }

        logger.info(
            "Pipeline complete: %d renditions, output=%s",
            len(results),
            self._output_root,
        )

        # Store everything on the instance - this is the whole point of
        # the refactor: no dict to pass around, no output_root to re-derive.
        self._renditions = results
        self._master_playlist_paths = master_playlists
        self._workers_used = workers
        self._processed = True

    def _execute_jobs(
        self, jobs: list[_RenditionJob], workers: int
    ) -> list[_RenditionResult]:
        """Run transcoding jobs sequentially or in parallel."""
        results: list[_RenditionResult] = []

        if workers <= 1:
            for job in jobs:
                results.append(self._transcode_to_hls(job))
        else:
            workers = min(workers, len(jobs))
            with ThreadPoolExecutor(max_workers=workers) as pool:
                futures = {
                    pool.submit(self._transcode_to_hls, job): job for job in jobs
                }
                for future in as_completed(futures):
                    try:
                        results.append(future.result())
                    except Exception as e:  # noqa: BLE001
                        job = futures[future]
                        logger.error(
                            "Worker crashed for %s/%dk: %s",
                            job.format,
                            job.bitrate_kbps,
                            e,
                        )
                        results.append(
                            _RenditionResult(
                                format=job.format,
                                bitrate_kbps=job.bitrate_kbps,
                                playlist_path="",
                                segment_dir=job.output_dir,
                                ok=False,
                                error=f"Worker process error: {e}",
                            )
                        )

        return results

    # ------------------------------------------------------------------
    # Step 1: Probe audio file metadata
    # ------------------------------------------------------------------

    def _probe_audio(self) -> AudioInfo:
        """
        Run ffprobe and extract both quality metadata (bitrate, codec, etc.)
        and descriptive tags (title/artist/album/etc.) embedded in the file.
        Tags come from ID3 (MP3), Vorbis comments (OGG/FLAC), or MP4 atoms
        (AAC/M4A) - ffprobe normalizes most of these into format.tags already.
        """
        file_path = self._source_path

        path = Path(file_path)
        if not path.is_file():
            raise FileNotFoundError(f"Source file does not exist: {file_path}")

        cmd = [
            "ffprobe",
            "-v",
            "error",
            "-show_entries",
            "format=duration,bit_rate:format_tags:stream=codec_name,sample_rate,channels,codec_type",
            "-of",
            "json",
            file_path,
        ]

        try:
            result = subprocess.run(
                cmd,
                capture_output=True,
                text=True,
                check=True,
                timeout=FFPROBE_TIMEOUT_SECONDS,
            )
        except subprocess.TimeoutExpired:
            raise RuntimeError(f"ffprobe timed out on {file_path}")
        except subprocess.CalledProcessError as e:
            raise RuntimeError(
                f"ffprobe failed for {file_path}: {e.stderr[:500]}"
            ) from e

        try:
            data = json.loads(result.stdout)
        except json.JSONDecodeError as e:
            raise RuntimeError(
                f"ffprobe returned invalid JSON for {file_path}: {e}"
            ) from e

        fmt = data.get("format", {})
        streams = data.get("streams", [])
        stream = next((s for s in streams if "codec_name" in s), {})

        # An embedded cover image shows up as a second (video/image) stream
        has_art = any(s.get("codec_type") == "video" for s in streams)

        tags = fmt.get("tags", {}) or {}

        if not stream:
            raise RuntimeError(
                f"No audio stream found in {file_path}. "
                f"ffprobe returned {len(streams)} stream(s) with no codec info."
            )

        duration = float(fmt.get("duration", 0) or 0)
        if duration <= 0:
            raise ValueError(f"Source file has zero or negative duration: {file_path}")

        # bit_rate may be missing on some containers; fall back to size/duration
        bitrate = fmt.get("bit_rate")
        if bitrate is None:
            size_bytes = os.path.getsize(file_path)
            bitrate = int((size_bytes * 8) / duration)
        else:
            bitrate = int(bitrate)

        return AudioInfo(
            path=file_path,
            duration_sec=round(duration, 2),
            bitrate_kbps=round(bitrate / 1000),
            sample_rate=int(stream.get("sample_rate", 0) or 0),
            codec=stream.get("codec_name", "unknown"),
            channels=int(stream.get("channels", 0) or 0),
            title=self._extract_tag(tags, "title"),
            artist=self._extract_tag(tags, "artist"),
            album=self._extract_tag(tags, "album"),
            album_artist=self._extract_tag(tags, "album_artist"),
            genre=self._extract_tag(tags, "genre"),
            year=self._extract_tag(tags, "year"),
            track_number=self._extract_tag(tags, "track_number"),
            has_embedded_art=has_art,
        )

    def _extract_tag(self, tags: dict, field: str) -> str | None:
        """Case-insensitive lookup across known alias keys for a metadata field."""
        lower_tags = {k.lower(): v for k, v in tags.items()}
        for alias in _TAG_ALIASES[field]:
            if alias.lower() in lower_tags:
                return lower_tags[alias.lower()]
        return None

    # ------------------------------------------------------------------
    # Step 2+3: Transcode + HLS packaging
    # ------------------------------------------------------------------

    @staticmethod
    def _transcode_to_hls(job: _RenditionJob) -> _RenditionResult:
        """
        Transcode source audio to the target format/bitrate and segment it
        directly into HLS (.ts segments + .m3u8 playlist) in one ffmpeg pass.

        Static method so it remains picklable for ProcessPoolExecutor.
        """
        if not 0 < HLS_FIRST_SEGMENT_SECONDS <= HLS_SEGMENT_SECONDS:
            raise ValueError("hls_first_segment_duration_seconds must be > 0 and <= hls_segment_duration_seconds")

        settings = FORMAT_SETTINGS[job.format]
        out_dir = Path(job.output_dir)
        out_dir.mkdir(parents=True, exist_ok=True)

        playlist_path = out_dir / "playlist.m3u8"
        segment_pattern = out_dir / "seg_%03d.ts"

        # Cut points: 4, 14, 24, ... (first segment short, rest HLS_SEGMENT_SECONDS)
        remaining = job.duration_sec - job.trim_start_sec
        cuts, t = [], float(HLS_FIRST_SEGMENT_SECONDS)
        while t < remaining - 1.0:  # skip a cut that would leave a <1s tail
            cuts.append(t)
            t += HLS_SEGMENT_SECONDS
        segment_times = ",".join(f"{c:g}" for c in cuts)

        cmd = ["ffmpeg", "-y"]
        if job.trim_start_sec > 0:
            cmd += ["-ss", str(job.trim_start_sec)]

        cmd += ["-i", job.source_path, "-vn",
                "-c:a", settings["codec"],
                "-b:a", f"{job.bitrate_kbps}k",
                "-f", "segment",
                "-segment_format", settings["hls_segment_type"],
                "-segment_list", str(playlist_path),
                "-segment_list_type", "m3u8",
                "-segment_list_size", "0"]
        
        if segment_times:
            cmd += ["-segment_times", segment_times]
        cmd += [str(segment_pattern)]

        try:
            subprocess.run(
                cmd,
                capture_output=True,
                text=True,
                check=True,
                timeout=FFMPEG_TIMEOUT_SECONDS,
            )
            return _RenditionResult(
                format=job.format,
                bitrate_kbps=job.bitrate_kbps,
                playlist_path=str(playlist_path),
                segment_dir=str(out_dir),
                ok=True,
            )
        except subprocess.TimeoutExpired:
            return _RenditionResult(
                format=job.format,
                bitrate_kbps=job.bitrate_kbps,
                playlist_path=str(playlist_path),
                segment_dir=str(out_dir),
                ok=False,
                error=f"ffmpeg timed out after {FFMPEG_TIMEOUT_SECONDS}s",
            )
        except subprocess.CalledProcessError as e:
            return _RenditionResult(
                format=job.format,
                bitrate_kbps=job.bitrate_kbps,
                playlist_path=str(playlist_path),
                segment_dir=str(out_dir),
                ok=False,
                error=e.stderr[-2000:],
            )

    # ------------------------------------------------------------------
    # Step 4: Master playlist
    # ------------------------------------------------------------------

    @staticmethod
    def _build_master_playlist(
        output_root: str,
        results: list[_RenditionResult],
        fmt: Format,
    ) -> str:
        """
        Build one master.m3u8 per format, referencing that format's bitrate
        renditions so the player can switch quality without switching codec.
        """
        fmt_results = sorted(
            (r for r in results if r.format == fmt and r.ok),
            key=lambda r: r.bitrate_kbps,
        )
        if not fmt_results:
            raise ValueError(f"No successful renditions for format={fmt}")

        codec_tag = "mp4a.40.2" if fmt == "aac" else "mp4a.40.34"
        lines = ["#EXTM3U"]
        for r in fmt_results:
            bandwidth = r.bitrate_kbps * 1000
            rel_path = os.path.relpath(r.playlist_path, output_root)
            lines.append(
                f'#EXT-X-STREAM-INF:BANDWIDTH={bandwidth},CODECS="{codec_tag}"'
            )
            lines.append(rel_path)

        master_path = Path(output_root) / f"master_{fmt}.m3u8"
        master_path.write_text("\n".join(lines) + "\n")
        return str(master_path)

    # ------------------------------------------------------------------
    # Job builder (quality gate)
    # ------------------------------------------------------------------

    def _build_jobs(self) -> list[_RenditionJob]:
        """
        Quality gate: never upscale. Only generate renditions at bitrates
        <= the source's actual bitrate (with a small tolerance).
        If the source is lower than every target bitrate, emit one
        rendition per format at the source's own bitrate.
        """
        assert self._info is not None, "_probe_audio() must run before _build_jobs()"

        effective_ceiling = self._info.bitrate_kbps + TOLERANCE_KBPS
        allowed_bitrates = [b for b in BITRATES if b <= effective_ceiling]

        # if the source is lower quality than our lowest target (128k)
        # then just use the source bitrate for all formats
        if not allowed_bitrates:
            allowed_bitrates = [self._info.bitrate_kbps]

        jobs = []
        for fmt in FORMATS:
            for bitrate in allowed_bitrates:
                out_dir = os.path.join(self._output_root, fmt, f"{bitrate}k")
                jobs.append(
                    _RenditionJob(
                        self._source_path,
                        out_dir,
                        fmt,
                        bitrate,
                        self.trim_start_sec,
                        self._info.duration_sec,
                    )
                )
        return jobs
