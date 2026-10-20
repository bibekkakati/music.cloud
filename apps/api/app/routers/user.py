from fastapi import APIRouter, Depends, status

from app.dependencies.auth import CurrentUser, get_current_user
from app.infra.database import DatabaseSession
from app.models.user import User
from app.schemas.user import UserRead
from app.services.user import UserService

router = APIRouter(prefix="/users", dependencies=[Depends(get_current_user)])


@router.get("/me", response_model=UserRead)
def get_current_user_profile(
    current_user: CurrentUser,
) -> User:
    """Get the current authenticated user's profile."""
    return current_user


@router.post("/heartbeat", status_code=status.HTTP_204_NO_CONTENT)
def heartbeat(
    current_user: CurrentUser,
    db: DatabaseSession,
) -> None:
    """
    Hit-only heartbeat endpoint. Returns 204 immediately.
    Updates the user's last_active_at timestamp.
    """
    UserService(db).touch_last_active(current_user.id)
