"""Authentication schemas."""

from datetime import datetime
from typing import Optional

from pydantic import Field, field_validator

from .common import ORMBase


class Token(ORMBase):
    access_token: str
    token_type: str = "bearer"


class TokenPayload(ORMBase):
    sub: Optional[str] = None
    exp: Optional[int] = None


class LoginRequest(ORMBase):
    email: str
    password: str
    
    @field_validator('email')
    @classmethod
    def validate_email(cls, v: str) -> str:
        """Basic email validation that allows .local domains."""
        v = v.lower().strip()
        if '@' not in v or len(v) < 3:
            raise ValueError('Invalid email format')
        return v


class UserBase(ORMBase):
    email: str
    full_name: str
    
    @field_validator('email')
    @classmethod
    def validate_email(cls, v: str) -> str:
        """Basic email validation that allows .local domains."""
        v = v.lower().strip()
        if '@' not in v or len(v) < 3:
            raise ValueError('Invalid email format')
        return v


class UserCreate(UserBase):
    password: str = Field(min_length=8)
    role: str
    department_id: Optional[int] = None  # Required for HeadOfDepartment role


class UserRead(UserBase):
    id: int
    role: str
    is_active: bool
    timezone: Optional[str] = "Africa/Cairo"
    created_at: Optional[datetime]
    department_name: Optional[str] = None  # For HeadOfDepartment role


class UserUpdate(ORMBase):
    """Schema for updating user profile settings."""
    full_name: Optional[str] = None
    timezone: Optional[str] = None
