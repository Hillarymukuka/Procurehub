"""Supplier related persistence models."""

import enum

from sqlalchemy import (
    Column,
    DateTime,
    Enum,
    ForeignKey,
    Integer,
    Numeric,
    String,
    UniqueConstraint,
    func,
)
from sqlalchemy.orm import relationship

from ..database import Base


class SupplierProfile(Base):
    __tablename__ = "supplier_profiles"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), unique=True)
    supplier_number = Column(String(20), unique=True, nullable=False, index=True)
    company_name = Column(String(255), nullable=False)
    contact_email = Column(String(255), nullable=False)
    contact_phone = Column(String(100), nullable=True)
    address = Column(String(500), nullable=True)
    preferred_currency = Column(String(16), nullable=True)

    invitations_sent = Column(Integer, default=0)
    last_invited_at = Column(DateTime(timezone=True), nullable=True)
    total_awarded_value = Column(Numeric(12, 2), default=0)

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    user = relationship("User", back_populates="supplier_profile")
    categories = relationship(
        "SupplierCategory",
        back_populates="supplier",
        cascade="all, delete-orphan",
    )
    documents = relationship(
        "SupplierDocument",
        back_populates="supplier",
        cascade="all, delete-orphan",
    )
    invitations = relationship("RFQInvitation", back_populates="supplier")
    quotations = relationship("Quotation", back_populates="supplier")
    messages = relationship("Message", back_populates="supplier")


class SupplierCategoryType(str, enum.Enum):
    primary = "primary"
    secondary = "secondary"


class SupplierCategory(Base):
    __tablename__ = "supplier_categories"

    id = Column(Integer, primary_key=True, index=True)
    supplier_id = Column(
        Integer, ForeignKey("supplier_profiles.id", ondelete="CASCADE"), nullable=False
    )
    name = Column(String(100), nullable=False, index=True)
    category_type = Column(Enum(SupplierCategoryType), nullable=False, default=SupplierCategoryType.primary)

    supplier = relationship("SupplierProfile", back_populates="categories")

    __table_args__ = (UniqueConstraint("supplier_id", "name", name="uq_supplier_category"),)


class SupplierDocumentType(str, enum.Enum):
    incorporation = "incorporation"
    tax_clearance = "tax_clearance"
    company_profile = "company_profile"
    other = "other"


class SupplierDocument(Base):
    __tablename__ = "supplier_documents"

    id = Column(Integer, primary_key=True, index=True)
    supplier_id = Column(
        Integer, ForeignKey("supplier_profiles.id", ondelete="CASCADE"), nullable=False
    )
    document_type = Column(Enum(SupplierDocumentType), nullable=False)
    file_path = Column(String(500), nullable=False)
    original_filename = Column(String(255), nullable=True)
    uploaded_at = Column(DateTime(timezone=True), server_default=func.now())

    supplier = relationship("SupplierProfile", back_populates="documents")
