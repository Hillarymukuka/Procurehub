"""Supplier related schemas."""

from datetime import datetime
from typing import List, Optional

from pydantic import BaseModel, Field, field_validator

from .common import ORMBase


def validate_email_field(v: str) -> str:
    """Basic email validation that allows .local domains."""
    v = v.lower().strip()
    if '@' not in v or len(v) < 3:
        raise ValueError('Invalid email format')
    return v


class SupplierDocumentRead(ORMBase):
    id: int
    document_type: str
    file_path: str
    original_filename: Optional[str]
    uploaded_at: datetime


class SupplierCategoryRead(ORMBase):
    id: int
    name: str
    category_type: str


class SupplierCreate(BaseModel):
    """Schema for creating a new supplier."""
    company_name: str = Field(..., min_length=1, max_length=255)
    contact_email: str = Field(..., min_length=3, max_length=255)
    full_name: str = Field(..., min_length=1, max_length=255)
    password: str = Field(..., min_length=6, max_length=255)
    contact_phone: Optional[str] = Field(None, max_length=50)
    address: Optional[str] = Field(None, max_length=500)
    preferred_currency: str = Field(default="USD", max_length=10)

class SupplierProfileRead(ORMBase):
    id: int
    supplier_number: str
    company_name: str
    contact_email: str
    contact_phone: Optional[str]
    address: Optional[str]
    preferred_currency: Optional[str]
    invitations_sent: int
    last_invited_at: Optional[datetime]
    documents: List[SupplierDocumentRead] = []
    categories: List[SupplierCategoryRead] = []
    
    @field_validator('contact_email')
    @classmethod
    def validate_contact_email(cls, v: str) -> str:
        return validate_email_field(v)


class SupplierRegistrationResponse(ORMBase):
    user_id: int
    supplier_id: int


class SupplierRegistrationRequest(ORMBase):
    company_name: str
    full_name: str
    email: str
    password: str
    contact_phone: Optional[str]
    address: Optional[str]
    preferred_currency: Optional[str] = "USD"
    categories: List[str] = Field(default_factory=list)
    
    @field_validator('email')
    @classmethod
    def validate_email(cls, v: str) -> str:
        return validate_email_field(v)

    @field_validator('categories')
    @classmethod
    def validate_categories(cls, categories: List[str]) -> List[str]:
        cleaned: List[str] = []
        seen: set[str] = set()
        for raw in categories:
            if not raw:
                continue
            name = raw.strip()
            if not name:
                continue
            key = name.lower()
            if key in seen:
                continue
            seen.add(key)
            cleaned.append(name)
        if len(cleaned) > 2:
            raise ValueError("Suppliers can only have a primary and secondary category.")
        return cleaned


class SupplierInvitationRead(ORMBase):
    rfq_id: int
    rfq_title: str
    category: str
    deadline: datetime
    status: str
    invited_at: datetime
