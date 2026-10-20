from datetime import datetime, timezone

from sqlmodel import Session

from app.core.exceptions import InvalidCredentialsError
from app.core.security import verify_password
from app.schemas.auth import LoginRequest, SessionResponse
from app.services.session import SessionService
from app.services.user import UserService


class AuthService:
    def __init__(self, db: Session):
        self.db = db

    def authenticate_and_login(self, login_data: LoginRequest) -> SessionResponse:
        user_email = login_data.email.strip().lower() if login_data.email else ""
        user_password = login_data.password.strip() if login_data.password else ""

        if not user_email or not user_password:
            raise InvalidCredentialsError("Email and passcode cannot be empty")

        user_service = UserService(self.db)
        user = user_service.get_by_email(user_email)

        if not user or not user.hashed_password:
            raise InvalidCredentialsError("Invalid email or passcode")

        if not verify_password(user_password, user.hashed_password):
            raise InvalidCredentialsError("Invalid email or passcode")

        # Update last_active_at on successful authentication
        user.last_active_at = datetime.now(timezone.utc)
        self.db.add(user)
        self.db.commit()

        # Create session in database with initial expiration
        new_session, raw_token = SessionService(self.db).create_session(
            user_id=user.id
        )

        return SessionResponse(
            access_token=raw_token,
            token_type="bearer",
            expires_at=new_session.expires_at,
        )
