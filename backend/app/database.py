"""Database connectivity and session management."""

from pathlib import Path
from typing import Generator

from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base, sessionmaker

from .config import get_settings


settings = get_settings()

connect_args = {}
database_url = settings.database_url

if database_url.startswith("sqlite"):
    connect_args["check_same_thread"] = False
    sqlite_path = database_url.split("sqlite:///")[-1]
    db_file = Path(sqlite_path).resolve()
    db_file.parent.mkdir(parents=True, exist_ok=True)

engine = create_engine(database_url, connect_args=connect_args)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()


def get_db() -> Generator:
    """Yield a database session within a managed transaction scope."""
    db = SessionLocal()
    try:
        yield db
        db.commit()
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()

