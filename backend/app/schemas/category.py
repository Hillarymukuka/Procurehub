"""Category schemas."""

from datetime import datetime
from typing import Optional

from .common import ORMBase


class CategoryBase(ORMBase):
    name: str
    description: Optional[str] = None


class CategoryCreate(CategoryBase):
    pass


class CategoryUpdate(ORMBase):
    name: Optional[str] = None
    description: Optional[str] = None


class CategoryRead(CategoryBase):
    id: int
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
