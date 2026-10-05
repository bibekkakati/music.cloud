import secrets

from sqlmodel import Session

from app.core.config import settings
from app.core.exceptions import InvalidCredentialsError
from app.schemas.auth import LoginRequest, SessionResponse
from app.services.session import SessionService
from app.services.user import UserService


class AuthService:
    def __init__(self, db: Session):
        self.db = db

    def authenticate_and_login(self, login_data: LoginRequest) -> SessionResponse:
        server_passcode = settings.PASSCODE.strip() if settings.PASSCODE else ""
        if not server_passcode:
            raise InvalidCredentialsError("Server authentication passcode is not configured")

        user_password = login_data.password.strip() if login_data.password else ""
        if not user_password:
            raise InvalidCredentialsError("Passcode cannot be empty")

        if not secrets.compare_digest(user_password, server_passcode):
            raise InvalidCredentialsError("Invalid secret code or credentials")

        # Get existing user or register new user
        user_service = UserService(self.db)
        user, _ = user_service.get_or_create_user(login_data.email)

        # Create session in database with initial expiration
        session_service = SessionService(self.db)
        expiry_days = session_service.default_expiry_days

        new_session, raw_token = session_service.create_session(
            user_id=user.id,
            expiry_days=expiry_days,
        )

        return SessionResponse(
            access_token=raw_token,
            token_type="bearer",
            expires_at=new_session.expires_at,
        )
