"""User and authentication centric models."""

import enum

from sqlalchemy import Boolean, Column, DateTime, Enum, Integer, String, func
from sqlalchemy.orm import relationship

from ..database import Base


class UserRole(str, enum.Enum):
    superadmin = "SuperAdmin"
    procurement = "Procurement"
    procurement_officer = "ProcurementOfficer"
    head_of_department = "HeadOfDepartment"
    requester = "Requester"
    finance = "Finance"  # Deprecated, kept for backwards compatibility
    supplier = "Supplier"


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String(255), unique=True, nullable=False, index=True)
    hashed_password = Column(String(255), nullable=False)
    full_name = Column(String(255), nullable=False)
    role = Column(Enum(UserRole, values_callable=lambda x: [e.value for e in x]), nullable=False, index=True)
    is_active = Column(Boolean, default=True)
    timezone = Column(String(50), default="Africa/Cairo")  # User's timezone
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    supplier_profile = relationship(
        "SupplierProfile", back_populates="user", uselist=False
    )
    quotations = relationship(
        "Quotation",
        foreign_keys="[Quotation.supplier_user_id]",
        back_populates="supplier_user",
        cascade="all, delete-orphan",
    )
    sent_messages = relationship(
        "Message",
        foreign_keys="[Message.sender_id]",
        back_populates="sender",
        cascade="all, delete-orphan",
    )
    received_messages = relationship(
        "Message",
        foreign_keys="[Message.recipient_id]",
        back_populates="recipient",
        cascade="all, delete-orphan",
    )

