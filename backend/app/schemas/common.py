"""Shared schema utilities."""

from datetime import datetime
from typing import Optional

try:
    from pydantic import BaseModel, ConfigDict
except ImportError:  # pragma: no cover - fallback for pydantic v1
    from pydantic import BaseModel  # type: ignore
    ConfigDict = None  # type: ignore


class ORMBase(BaseModel):
    """Base class that works with SQLAlchemy ORM instances."""

    if ConfigDict is not None:
        model_config = ConfigDict(from_attributes=True)
    else:  # pragma: no cover - executed on pydantic v1
        class Config:
            orm_mode = True


class TimestampedModel(ORMBase):
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

