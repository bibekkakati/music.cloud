from datetime import datetime, timezone
from uuid import UUID

from sqlmodel import Session, select

from app.core.exceptions import UserAlreadyExistsError, UserNotFoundError
from app.core.security import generate_secure_password, hash_password
from app.models.user import User
from app.services.session import SessionService


class UserService:
    def __init__(self, db: Session):
        self.db = db

    def get_by_email(self, email: str) -> User | None:
        statement = select(User).where(User.email == email.strip().lower())
        return self.db.exec(statement).first()

    def get_by_id(self, user_id: UUID) -> User | None:
        return self.db.get(User, user_id)

    def create_user_with_password(
        self, email: str, hashed_password: str, is_admin: bool = False
    ) -> User:
        user = User(
            email=email.strip().lower(),
            hashed_password=hashed_password,
            is_admin=is_admin,
        )
        self.db.add(user)
        self.db.commit()
        self.db.refresh(user)
        return user

    def provision_user(self, email: str, is_admin: bool = False) -> tuple[User, str]:
        """
        Provisions a new user with an auto-generated secure password.
        Raises UserAlreadyExistsError if email is taken.
        Returns the created User instance and the raw one-time password.
        """
        normalized_email = email.strip().lower()
        if self.get_by_email(normalized_email):
            raise UserAlreadyExistsError("A user with this email address already exists.")

        generated_password = generate_secure_password(10)
        hashed_pw = hash_password(generated_password)

        user = self.create_user_with_password(
            email=normalized_email,
            hashed_password=hashed_pw,
            is_admin=is_admin,
        )
        return user, generated_password

    def reset_password(self, user_id: UUID) -> str:
        """
        Resets a user's password to a newly generated secure password and invalidates all active sessions.
        Raises UserNotFoundError if user is not found.
        Returns the raw one-time password.
        """
        user = self.get_by_id(user_id)
        if not user:
            raise UserNotFoundError("User not found.")

        generated_password = generate_secure_password(10)
        user.hashed_password = hash_password(generated_password)
        user.updated_at = datetime.now(timezone.utc)
        self.db.add(user)
        self.db.commit()
        self.db.refresh(user)

        # Invalidate all active sessions for this user in DB and Cache
        SessionService(self.db).delete_all_user_sessions(user.id)

        return generated_password

    def touch_last_active(self, user_id: UUID) -> None:
        """
        Updates the user's last_active_at timestamp.
        Safely swallows and rolls back any database errors to avoid breaking non-critical heartbeats.
        """
        try:
            user = self.db.get(User, user_id)
            if user:
                user.last_active_at = datetime.now(timezone.utc)
                self.db.add(user)
                self.db.commit()
        except Exception:
            self.db.rollback()

    def list_all_users(self) -> list[User]:
        statement = select(User).order_by(User.created_at.desc())
        return list(self.db.exec(statement).all())
