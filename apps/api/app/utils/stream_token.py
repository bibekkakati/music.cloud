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
