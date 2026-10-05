from fastapi import APIRouter, Depends

from app.dependencies.auth import CurrentUser, get_current_user
from app.models.user import User
from app.schemas.user import UserRead

router = APIRouter(prefix="/users", dependencies=[Depends(get_current_user)])


@router.get("/me", response_model=UserRead)
def get_current_user_profile(
    current_user: CurrentUser,
) -> User:
    """Get the current authenticated user's profile."""
    return current_user
