from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status

from app.core.exceptions import UserAlreadyExistsError, UserNotFoundError
from app.dependencies.auth import require_admin
from app.infra.database import DatabaseSession
from app.schemas.admin_user import (
    AdminCreateUserRequest,
    AdminCreateUserResponse,
    AdminResetPasswordResponse,
    AdminUserRead,
)
from app.services.user import UserService

router = APIRouter(prefix="/users", dependencies=[Depends(require_admin)])


@router.get("", response_model=list[AdminUserRead])
def list_users(
    db: DatabaseSession,
) -> list[AdminUserRead]:
    """List all registered users, their roles, and last active timestamps."""
    users = UserService(db).list_all_users()
    return [
        AdminUserRead(
            id=u.id,
            email=u.email,
            is_admin=u.is_admin,
            created_at=u.created_at,
            updated_at=u.updated_at,
            last_active_at=u.last_active_at,
        )
        for u in users
    ]


@router.post(
    "",
    response_model=AdminCreateUserResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_user(
    payload: AdminCreateUserRequest,
    db: DatabaseSession,
) -> AdminCreateUserResponse:
    """
    Provision a new user account with an auto-generated secure password.
    Returns the one-time generated password for the admin to copy.
    """
    try:
        user, generated_password = UserService(db).provision_user(
            email=payload.email,
            is_admin=payload.is_admin,
        )
    except UserAlreadyExistsError as exc:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=exc.message,
        ) from exc

    return AdminCreateUserResponse(
        user=AdminUserRead(
            id=user.id,
            email=user.email,
            is_admin=user.is_admin,
            created_at=user.created_at,
            updated_at=user.updated_at,
            last_active_at=user.last_active_at,
        ),
        generated_password=generated_password,
    )


@router.post(
    "/{user_id}/reset-password", response_model=AdminResetPasswordResponse
)
def reset_password(
    user_id: UUID,
    db: DatabaseSession,
) -> AdminResetPasswordResponse:
    """
    Generate a new secure password for the user and invalidate all their active sessions.
    Returns the one-time generated password for the admin to copy.
    """
    try:
        generated_password = UserService(db).reset_password(user_id)
    except UserNotFoundError as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=exc.message,
        ) from exc

    return AdminResetPasswordResponse(
        user_id=user_id,
        generated_password=generated_password,
        message="Password has been reset successfully. All active sessions have been terminated.",
    )
