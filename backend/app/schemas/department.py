"""Department schemas."""

from datetime import datetime
from typing import Optional

from pydantic import BaseModel


class DepartmentRead(BaseModel):
    id: int
    name: str
    description: Optional[str] = None
    head_of_department_id: Optional[int] = None
    head_of_department_name: Optional[str] = None
    created_at: datetime
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True
