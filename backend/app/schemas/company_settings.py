"""Pydantic schemas for company settings."""

from datetime import datetime
from typing import Optional

from pydantic import BaseModel, EmailStr, Field


class CompanySettingsBase(BaseModel):
    """Base schema for company settings."""
    company_name: str = Field(..., min_length=1, max_length=255)
    address_line1: Optional[str] = Field(None, max_length=255)
    address_line2: Optional[str] = Field(None, max_length=255)
    city: Optional[str] = Field(None, max_length=100)
    state: Optional[str] = Field(None, max_length=100)
    postal_code: Optional[str] = Field(None, max_length=20)
    country: Optional[str] = Field(None, max_length=100)
    phone: Optional[str] = Field(None, max_length=50)
    email: Optional[EmailStr] = None
    website: Optional[str] = Field(None, max_length=255)


class CompanySettingsCreate(CompanySettingsBase):
    """Schema for creating company settings."""
    pass


class CompanySettingsUpdate(BaseModel):
    """Schema for updating company settings."""
    company_name: Optional[str] = Field(None, min_length=1, max_length=255)
    address_line1: Optional[str] = Field(None, max_length=255)
    address_line2: Optional[str] = Field(None, max_length=255)
    city: Optional[str] = Field(None, max_length=100)
    state: Optional[str] = Field(None, max_length=100)
    postal_code: Optional[str] = Field(None, max_length=20)
    country: Optional[str] = Field(None, max_length=100)
    phone: Optional[str] = Field(None, max_length=50)
    email: Optional[EmailStr] = None
    website: Optional[str] = Field(None, max_length=255)


class CompanySettingsRead(CompanySettingsBase):
    """Schema for reading company settings."""
    id: int
    logo_path: Optional[str] = None
    logo_url: Optional[str] = None  # Full URL for frontend
    created_at: datetime
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True
