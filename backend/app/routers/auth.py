"""Authentication endpoints."""

from datetime import timedelta

from fastapi import APIRouter, Depends, HTTPException, Request, status
from fastapi.security import OAuth2PasswordRequestForm
from slowapi import Limiter
from slowapi.util import get_remote_address
from sqlalchemy.orm import Session

from .. import schemas
from ..config import get_settings
from ..dependencies import get_current_active_user, require_roles
from ..models import User, UserRole
from ..services.auth import authenticate_user, create_user, get_user_by_email
from ..utils.security import create_access_token
from ..database import get_db


router = APIRouter()
settings = get_settings()
limiter = Limiter(key_func=get_remote_address)


@router.post("/token", response_model=schemas.Token)
@limiter.limit("5/minute")  # Strict rate limit for login attempts
def login_for_access_token(
    request: Request,
    form_data: OAuth2PasswordRequestForm = Depends(),
    db: Session = Depends(get_db)
):
    user = authenticate_user(db, form_data.username, form_data.password)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )

    access_token = create_access_token(
        subject=str(user.id),
        expires_delta=timedelta(minutes=settings.access_token_expire_minutes),
    )
    return schemas.Token(access_token=access_token)


@router.post(
    "/users",
    response_model=schemas.UserRead,
    status_code=status.HTTP_201_CREATED,
)
def create_user_account(
    user_in: schemas.UserCreate,
    db: Session = Depends(get_db),
    _: User = Depends(require_roles(UserRole.superadmin)),
):
    if get_user_by_email(db, user_in.email):
        raise HTTPException(status_code=400, detail="Email already registered")
    user = create_user(db, user_in)
    return user


@router.get("/me", response_model=schemas.UserRead)
def read_current_user(
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    """Get current user info including department name for HOD users."""
    from ..models.user import UserRole
    from ..models.department import Department
    
    # For HeadOfDepartment users, add their department name
    department_name = None
    if current_user.role == UserRole.head_of_department:
        department = db.query(Department).filter(
            Department.head_of_department_id == current_user.id
        ).first()
        if department:
            department_name = department.name
    
    # Create response with department_name
    return schemas.UserRead(
        id=current_user.id,
        email=current_user.email,
        full_name=current_user.full_name,
        role=current_user.role.value,  # Convert enum to string value
        is_active=current_user.is_active,
        timezone=current_user.timezone,
        created_at=current_user.created_at,
        department_name=department_name
    )


@router.put("/me", response_model=schemas.UserRead)
def update_current_user(
    user_update: schemas.UserUpdate,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    """Update current user's profile settings (name, timezone, etc)."""
    if user_update.full_name is not None:
        setattr(current_user, "full_name", user_update.full_name)
    
    if user_update.timezone is not None:
        setattr(current_user, "timezone", user_update.timezone)
    
    db.commit()
    db.refresh(current_user)
    return current_user
