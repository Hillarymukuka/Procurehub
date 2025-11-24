"""Procurement category model."""

from sqlalchemy import Column, DateTime, Integer, String, func

from ..database import Base


class ProcurementCategory(Base):
    __tablename__ = "procurement_categories"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), unique=True, nullable=False, index=True)
    description = Column(String(500), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
