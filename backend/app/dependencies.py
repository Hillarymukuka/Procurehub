"""Reusable FastAPI dependencies."""

from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session

from .database import get_db
from .models import SupplierProfile, User, UserRole
from .utils.security import decode_token


oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/token")


def get_current_user(
    token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)
) -> User:
    """Return the currently authenticated user."""
    payload = decode_token(token)
    if not payload or "sub" not in payload:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Could not validate credentials",
            headers={"WWW-Authenticate": "Bearer"},
        )

    user_id = int(payload["sub"])
    user = db.get(User, user_id)
    if not user or not user.is_active:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Inactive user")
    return user


def get_current_active_user(
    current_user: User = Depends(get_current_user),
) -> User:
    """Ensure the current user is active."""
    if not current_user.is_active:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Inactive user")
    return current_user


def require_roles(*roles: UserRole):
    """Dependency to enforce role-based access control."""

    def dependency(current_user: User = Depends(get_current_active_user)) -> User:
        # Ensure we are comparing enum values or the enum object itself
        user_role_value = current_user.role.value if isinstance(current_user.role, UserRole) else current_user.role
        
        allowed_role_values = [role.value for role in roles]
        
        if user_role_value not in allowed_role_values and current_user.role not in roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN, 
                detail=f"Not authorized. Role '{user_role_value}' is not in allowed roles."
            )
        return current_user

    return dependency


def get_current_supplier_profile(
    current_user: User = Depends(require_roles(UserRole.supplier)),
    db: Session = Depends(get_db),
) -> SupplierProfile:
    """Fetch the supplier profile for the current supplier user."""
    from sqlalchemy.orm import joinedload
    
    profile = (
        db.query(SupplierProfile)
        .options(joinedload(SupplierProfile.categories))
        .filter(SupplierProfile.user_id == current_user.id)
        .first()
    )
    if not profile:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Supplier profile not found",
        )
    return profile
