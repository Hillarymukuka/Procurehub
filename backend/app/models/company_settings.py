"""Company settings model for branding and document generation."""

from sqlalchemy import Column, Integer, String, Text
from sqlalchemy.sql import func
from sqlalchemy.types import DateTime

from ..database import Base


class CompanySettings(Base):
    """Company information for documents and branding."""
    
    __tablename__ = "company_settings"

    id = Column(Integer, primary_key=True, index=True)
    company_name = Column(String(255), nullable=False)
    address_line1 = Column(String(255))
    address_line2 = Column(String(255))
    city = Column(String(100))
    state = Column(String(100))
    postal_code = Column(String(20))
    country = Column(String(100))
    phone = Column(String(50))
    email = Column(String(255))
    website = Column(String(255))
    logo_path = Column(String(500))  # Path to uploaded logo
    
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
