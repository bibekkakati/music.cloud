from uuid import UUID

from sqlmodel import Session, select

from app.models.user import User


class UserService:
    def __init__(self, db: Session):
        self.db = db

    def get_by_email(self, email: str) -> User | None:
        statement = select(User).where(User.email == email.lower())
        return self.db.exec(statement).first()

    def get_by_id(self, user_id: UUID) -> User | None:
        return self.db.get(User, user_id)

    def create_user(self, email: str) -> User:
        user = User(email=email.lower())
        self.db.add(user)
        self.db.commit()
        self.db.refresh(user)
        return user

    def get_or_create_user(self, email: str) -> tuple[User, bool]:
        user = self.get_by_email(email)
        if user:
            return user, False
        return self.create_user(email), True
