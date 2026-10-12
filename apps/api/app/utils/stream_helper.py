import jwt
from datetime import datetime, timezone, timedelta
from app.core.config import settings

def generate_stream_token(user_id: str, expires_in_seconds: int | None = None) -> tuple[str, datetime]:
    """
    Generate an HS256 JWT stream token verified by the Cloudflare edge worker.
    """
    if expires_in_seconds is None:
        expires_in_seconds = settings.config.auth.stream_token_expiry_seconds
    now = datetime.now(timezone.utc)
    expires_at = now + timedelta(seconds=expires_in_seconds)

    # Standard JWT claims use Unix timestamps in SECONDS
    payload = {
        "sub": str(user_id),
        "exp": int(expires_at.timestamp()),
        "iat": int(now.timestamp()),
    }

    secret = settings.AUTH_SECRET
    
    # Generate standard JWT string
    token = jwt.encode(payload, secret, algorithm="HS256")
    
    return token, expires_at


def get_stream_url(
    master_aac_key: str | None = None,
    master_mp3_key: str | None = None,
) -> str | None:
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


def get_cover_art_url(cover_art_key: str | None = None) -> str | None:
    """
    Build the Edge URL for song cover art.
    Served directly by the edge worker with caching.
    """
    if not cover_art_key:
        return None
    if cover_art_key.startswith("http://") or cover_art_key.startswith("https://"):
        return cover_art_key
    base_url = (settings.EDGE_WORKER_URL or "").rstrip("/")
    if not base_url:
        return cover_art_key
    return f"{base_url}/{cover_art_key.lstrip('/')}"
