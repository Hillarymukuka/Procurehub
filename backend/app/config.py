"""Application configuration using environment-driven settings."""

from functools import lru_cache
from pathlib import Path
from typing import List, Optional

from pydantic import Field
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    app_name: str = "ProcuraHub"
    environment: str = Field(default="development", env="ENVIRONMENT")

    database_url: str = Field(
        default="sqlite:///./backend/procurahub.db", env="DATABASE_URL"
    )
    secret_key: str = Field(
        default="change-me-in-production", env="SECRET_KEY"
    )
    access_token_expire_minutes: int = Field(default=60, env="ACCESS_TOKEN_EXPIRE_MINUTES")
    algorithm: str = Field(default="HS256", env="JWT_ALGORITHM")
    
    def __init__(self, **kwargs):
        super().__init__(**kwargs)
        # Validate SECRET_KEY is strong enough for production
        if self.environment == "production" and self.secret_key == "change-me-in-production":
            raise ValueError(
                "CRITICAL SECURITY ERROR: SECRET_KEY must be changed from default value in production! "
                "Generate a secure key with: python -c 'import secrets; print(secrets.token_urlsafe(64))'"
            )
        if len(self.secret_key) < 32 and self.environment == "production":
            raise ValueError(
                "CRITICAL SECURITY ERROR: SECRET_KEY must be at least 32 characters long in production!"
            )

    email_sender: str = Field(default="noreply@procurahub.local", env="EMAIL_SENDER")
    email_console_fallback: bool = Field(default=True, env="EMAIL_CONSOLE_FALLBACK")
    
    # SMTP Configuration
    smtp_host: str = Field(default="smtp.gmail.com", env="SMTP_HOST")
    smtp_port: int = Field(default=587, env="SMTP_PORT")
    smtp_username: Optional[str] = Field(default=None, env="SMTP_USERNAME")
    smtp_password: Optional[str] = Field(default=None, env="SMTP_PASSWORD")
    smtp_use_tls: bool = Field(default=True, env="SMTP_USE_TLS")

    upload_dir: Optional[Path] = Field(default=None, env="UPLOAD_DIR")

    invitation_batch_size: int = Field(default=25, env="INVITATION_BATCH_SIZE")
    cors_allow_origins: List[str] = Field(
        default_factory=lambda: ["http://localhost:5173", "http://127.0.0.1:5173"],
        env="CORS_ALLOW_ORIGINS",
    )

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"

    @property
    def resolved_upload_dir(self) -> Path:
        """Resolve the target directory for uploaded files."""
        if self.upload_dir:
            return Path(self.upload_dir).resolve()
        project_root = Path(__file__).resolve().parents[2]
        return project_root / "uploads"

    @property
    def resolved_cors_origins(self) -> list[str]:
        """Return sanitized CORS origins list compatible with CORSMiddleware."""
        origins: list[str] = []
        for origin in self.cors_allow_origins:
            if origin == "*":
                # Wildcard is only valid when credentials are disabled; skip to avoid misconfiguration.
                continue
            trimmed = origin.rstrip("/")
            if trimmed and trimmed not in origins:
                origins.append(trimmed)
        return origins or ["http://localhost:5173"]


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    """Provide a cached settings object."""
    return Settings()
