from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, EmailStr


class AdminUserRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    email: EmailStr
    is_admin: bool
    created_at: datetime
    updated_at: datetime
    last_active_at: datetime | None = None


class AdminCreateUserRequest(BaseModel):
    email: EmailStr
    is_admin: bool = False


class AdminCreateUserResponse(BaseModel):
    user: AdminUserRead
    generated_password: str


class AdminResetPasswordResponse(BaseModel):
    user_id: UUID
    generated_password: str
    message: str
