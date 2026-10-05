from typing import Annotated

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from app.infra.database import DatabaseSession
from app.models.session import UserSession
from app.models.user import User
from app.services.session import SessionService
from app.services.user import UserService

security = HTTPBearer(auto_error=False)

BearerCredentials = Annotated[
    HTTPAuthorizationCredentials | None,
    Depends(security),
]


def _unauthorized(detail: str) -> HTTPException:
    return HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail=detail,
        headers={"WWW-Authenticate": "Bearer"},
    )


def _get_current_session(
    credentials: BearerCredentials,
    db: DatabaseSession,
) -> UserSession:
    if credentials is None:
        raise _unauthorized("Missing authentication token")

    session = SessionService(db).get_valid_session(credentials.credentials)

    if session is None:
        raise _unauthorized("Session has expired or is invalid")

    return session


CurrentSession = Annotated[UserSession, Depends(_get_current_session)]


def get_current_user(
    current_session: CurrentSession,
    db: DatabaseSession,
) -> User:
    cached_user = getattr(current_session, "user", None)
    if cached_user is not None:
        return cached_user

    user = UserService(db).get_by_id(current_session.user_id)

    if user is None:
        raise _unauthorized("User associated with this session no longer exists")

    return user


_get_current_user = get_current_user
CurrentUser = Annotated[User, Depends(get_current_user)]


def require_admin(current_user: CurrentUser) -> User:
    if not current_user.is_admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Administrative privileges required.",
        )

    return current_user


_require_admin = require_admin
AdminUser = Annotated[User, Depends(require_admin)]
