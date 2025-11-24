"""FastAPI application entrypoint for ProcuraHub."""

import logging
import sys

from fastapi import FastAPI, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded

from .config import get_settings
from .database import Base, engine
from .routers import api_router
from .utils.migrations import run_startup_migrations

logger = logging.getLogger("procurahub")
# Ensure INFO logs are visible in development to aid diagnostics
logging.basicConfig(
    level=logging.INFO,
    stream=sys.stdout,
    format="%(levelname)s:%(name)s:%(message)s",
)


def create_app() -> FastAPI:
    settings = get_settings()

    app = FastAPI(title=settings.app_name)
    
    # Initialize rate limiter
    limiter = Limiter(key_func=get_remote_address, default_limits=["100/minute"])
    app.state.limiter = limiter
    app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

    # Security headers middleware
    @app.middleware("http")
    async def add_security_headers(request: Request, call_next):
        response = await call_next(request)
        
        # Prevent MIME type sniffing
        response.headers["X-Content-Type-Options"] = "nosniff"
        
        # Prevent clickjacking
        response.headers["X-Frame-Options"] = "DENY"
        
        # XSS protection (legacy but still useful)
        response.headers["X-XSS-Protection"] = "1; mode=block"
        
        # HTTPS enforcement (only in production)
        if settings.environment == "production":
            response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"
        
        # Content Security Policy
        response.headers["Content-Security-Policy"] = (
            "default-src 'self'; "
            "script-src 'self' 'unsafe-inline' 'unsafe-eval'; "
            "style-src 'self' 'unsafe-inline'; "
            "img-src 'self' data: https:; "
            "font-src 'self' data:; "
            "connect-src 'self'; "
            "frame-ancestors 'none';"
        )
        
        # Restrict browser features
        response.headers["Permissions-Policy"] = "geolocation=(), microphone=(), camera=()"
        
        # Referrer policy
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
        
        return response

    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.resolved_cors_origins,
        allow_credentials=True,
        allow_methods=["GET", "POST", "PUT", "DELETE", "PATCH"],
        allow_headers=["Authorization", "Content-Type"],
        expose_headers=["Content-Disposition"],
    )

    Base.metadata.create_all(bind=engine)
    run_startup_migrations(engine)
    
    # Auto-initialize admin account for testing (SQLite ephemeral storage)
    if settings.environment == "production":
        from .database import SessionLocal
        from .models.user import User
        from .utils.security import get_password_hash
        
        db = SessionLocal()
        try:
            # Check if admin exists
            admin_exists = db.query(User).filter(User.role == "SuperAdmin").first()
            if not admin_exists:
                # Auto-create default admin for testing
                admin = User(
                    email="hillarymukuka@gmail.com",
                    hashed_password=get_password_hash("12makumba!"),
                    role="SuperAdmin",
                    is_active=True,
                    full_name="Super Administrator"
                )
                db.add(admin)
                db.commit()
                logger.info("Auto-created super admin account for testing")
        except Exception as e:
            logger.error(f"Failed to auto-create admin: {e}")
            db.rollback()
        finally:
            db.close()

    upload_dir = settings.resolved_upload_dir
    upload_dir.mkdir(parents=True, exist_ok=True)
    app.mount("/uploads", StaticFiles(directory=upload_dir), name="uploads")

    app.include_router(api_router)

    @app.get("/health")
    def healthcheck() -> dict[str, str]:
        return {"status": "ok"}

    return app


app = create_app()
