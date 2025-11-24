"""One-time database initialization endpoint for production deployment."""

from fastapi import APIRouter, HTTPException, Depends
from sqlalchemy.orm import Session
from pydantic import BaseModel, EmailStr

from ..database import get_db
from ..models.user import User
from ..models.department import Department
from ..services.auth import hash_password
from ..config import get_settings

router = APIRouter(prefix="/setup", tags=["setup"])


class InitializeRequest(BaseModel):
    """Request to initialize database with super admin."""
    admin_email: EmailStr
    admin_password: str
    secret_token: str  # Must match SECRET_KEY for security


@router.post("/initialize")
def initialize_database(
    request: InitializeRequest,
    db: Session = Depends(get_db)
) -> dict:
    """
    Initialize production database with super admin user.
    This endpoint can only be called once and requires the SECRET_KEY as token.
    
    After calling this endpoint once, it will be disabled automatically.
    """
    settings = get_settings()
    
    # Verify secret token matches SECRET_KEY
    if request.secret_token != settings.secret_key:
        raise HTTPException(status_code=403, detail="Invalid secret token")
    
    # Check if any users exist (prevents re-initialization)
    existing_users = db.query(User).first()
    if existing_users:
        raise HTTPException(
            status_code=400,
            detail="Database already initialized. This endpoint is disabled."
        )
    
    # Create super admin user
    hashed_password = hash_password(request.admin_password)
    
    super_admin = User(
        email=request.admin_email,
        hashed_password=hashed_password,
        role="superadmin",
        is_active=True,
        full_name="Super Administrator",
        department_id=None
    )
    
    db.add(super_admin)
    db.commit()
    db.refresh(super_admin)
    
    return {
        "status": "success",
        "message": "Database initialized successfully",
        "admin_email": super_admin.email,
        "admin_id": super_admin.id,
        "note": "This endpoint is now disabled. Please login with your admin credentials."
    }


@router.get("/status")
def check_initialization_status(db: Session = Depends(get_db)) -> dict:
    """Check if database has been initialized."""
    user_count = db.query(User).count()
    department_count = db.query(Department).count()
    
    return {
        "initialized": user_count > 0,
        "user_count": user_count,
        "department_count": department_count
    }
