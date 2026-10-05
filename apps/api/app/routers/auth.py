from typing import Annotated

from fastapi import APIRouter, Body, Depends, HTTPException, status

from app.core.exceptions import InvalidCredentialsError
from app.core.rate_limit import check_login_rate_limit
from app.dependencies.auth import CurrentSession
from app.infra.database import DatabaseSession
from app.schemas.auth import LoginRequest, SessionResponse
from app.services.auth import AuthService
from app.services.session import SessionService

router = APIRouter(prefix="/auth")


@router.post(
    "/login",
    response_model=SessionResponse,
    status_code=status.HTTP_200_OK,
    dependencies=[Depends(check_login_rate_limit)],
)
def login(
    login_data: Annotated[LoginRequest, Body(..., embed=True)],
    db: DatabaseSession,
) -> SessionResponse:
    """
    Login using email and passcode (as password).
    Creates a new user if the email does not exist yet.
    """
    try:
        auth_service = AuthService(db)
        return auth_service.authenticate_and_login(login_data)
    except InvalidCredentialsError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=str(exc),
            headers={"WWW-Authenticate": "Bearer"},
        ) from exc


@router.post("/logout", status_code=status.HTTP_200_OK)
def logout(
    current_session: CurrentSession,
    db: DatabaseSession,
):
    """Revoke the current database session."""
    session_service = SessionService(db)
    session_service.delete_session(current_session.token)


@router.post("/refresh", response_model=SessionResponse, status_code=status.HTTP_200_OK)
def refresh_session(
    current_session: CurrentSession,
    db: DatabaseSession,
) -> SessionResponse:
    """
    Explicitly renew the current session expiry.
    """
    session_service = SessionService(db)
    refreshed = session_service.refresh_session(current_session.token)
    if refreshed is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Session has expired or is invalid",
            headers={"WWW-Authenticate": "Bearer"},
        )
    return SessionResponse(
        access_token=refreshed.token,
        token_type="bearer",
        expires_at=refreshed.expires_at,
    )
