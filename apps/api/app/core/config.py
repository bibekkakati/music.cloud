import logging
import os
import sys
from pydantic import BaseModel, ValidationError, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

logger = logging.getLogger("uvicorn.error")


class AuthConfig(BaseModel):
    session_expiry_days: int = 30
    session_renew_threshold_days: int = 1
    session_renew_duration_days: int = 30
    session_grace_period_minutes: int = 30
    session_cache_ttl_seconds: float = 300.0
    stream_token_expiry_seconds: int = 14400
    login_rate_limit_max_attempts: int = 5
    login_rate_limit_window_seconds: int = 60


class AudioProcessingConfig(BaseModel):
    target_bitrates_kbps: list[int] = [256, 320]
    target_format: list[str] = ["aac"]
    hls_first_segment_duration_seconds: int = 4
    hls_segment_duration_seconds: int = 10
    ffmpeg_timeout_seconds: int = 600
    ffprobe_timeout_seconds: int = 60
    bitrate_tolerance_kbps: int = 8
    max_concurrent_s3_uploads: int = 10
    temp_scratch_directory: str = "./tmp"


class SearchConfig(BaseModel):
    fuzzy_similarity_threshold: int = 65
    max_search_results: int = 50


class StorageConfig(BaseModel):
    presigned_upload_expiry_seconds: int = 3600
    cover_art_folder: str = "cover_art"


class AppConfig(BaseModel):
    auth: AuthConfig = AuthConfig()
    audio_processing: AudioProcessingConfig = AudioProcessingConfig()
    search: SearchConfig = SearchConfig()
    storage: StorageConfig = StorageConfig()


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env", env_file_encoding="utf-8", extra="ignore"
    )

    AUTH_SECRET: str
    PASSCODE: str
    DATABASE_URL: str
    CORS_ORIGINS: str

    S3_REGION: str = "auto"
    S3_TOKEN: str | None = None
    S3_KEY: str = ""
    S3_SECRET: str = ""
    S3_ENDPOINT: str = ""
    S3_BUCKET: str = ""

    EDGE_WORKER_URL: str = ""

    # Domain Configuration
    config: AppConfig = AppConfig()

    @field_validator("PASSCODE")
    @classmethod
    def validate_passcode(cls, v: str) -> str:
        if not v or not v.strip():
            raise ValueError("PASSCODE cannot be empty.")
        return v.strip()

    @property
    def cors_origins_list(self) -> list[str]:
        if not self.CORS_ORIGINS:
            return []
        return [origin.strip() for origin in self.CORS_ORIGINS.split(",") if origin.strip()]


try:
    settings = Settings()
except ValidationError as exc:
    missing_fields = []
    other_errors = []
    for err in exc.errors():
        field_name = ".".join(str(loc) for loc in err.get("loc", []))
        if err.get("type") == "missing":
            missing_fields.append(field_name)
        else:
            other_errors.append(f"{field_name}: {err.get('msg', 'invalid value')}")

    print("\n" + "=" * 64, file=sys.stderr)
    print("❌ CONFIGURATION ERROR: Failed to load application settings!", file=sys.stderr)
    if missing_fields:
        print("\nMissing required environment variable(s) in .env:", file=sys.stderr)
        for field in missing_fields:
            print(f"   • {field}", file=sys.stderr)
    if other_errors:
        print("\nInvalid configuration value(s):", file=sys.stderr)
        for error in other_errors:
            print(f"   • {error}", file=sys.stderr)
    print("\nPlease verify your apps/api/.env file configuration.", file=sys.stderr)
    print("=" * 64 + "\n", file=sys.stderr)
    sys.exit(1)
