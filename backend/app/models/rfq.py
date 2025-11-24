"""RFQ, invitation, and quotation models."""

import enum
from decimal import Decimal

from sqlalchemy import (
    Boolean,
    Column,
    DateTime,
    Enum,
    ForeignKey,
    Integer,
    Numeric,
    String,
    Text,
    func,
)
from sqlalchemy.orm import relationship

from ..database import Base


class RFQStatus(str, enum.Enum):
    draft = "draft"
    open = "open"
    closed = "closed"
    awarded = "awarded"


class RFQ(Base):
    __tablename__ = "rfqs"

    id = Column(Integer, primary_key=True, index=True)
    rfq_number = Column(String(30), unique=True, index=True)
    title = Column(String(255), nullable=False)
    description = Column(Text, nullable=False)
    category = Column(String(120), nullable=False, index=True)
    budget = Column(Numeric(14, 2), nullable=False)
    currency = Column(String(10), default="USD")
    deadline = Column(DateTime(timezone=True), nullable=False, index=True)
    status = Column(Enum(RFQStatus), default=RFQStatus.open, index=True)
    response_locked = Column(Boolean, default=False, nullable=False)
    created_by_id = Column(Integer, ForeignKey("users.id"))
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    created_by = relationship("User")
    invitations = relationship(
        "RFQInvitation", back_populates="rfq", cascade="all, delete-orphan"
    )
    quotations = relationship(
        "Quotation", back_populates="rfq", cascade="all, delete-orphan"
    )
    documents = relationship(
        "RFQDocument", back_populates="rfq", cascade="all, delete-orphan"
    )


class RFQInvitation(Base):
    __tablename__ = "rfq_invitations"

    id = Column(Integer, primary_key=True, index=True)
    rfq_id = Column(Integer, ForeignKey("rfqs.id", ondelete="CASCADE"), nullable=False)
    supplier_id = Column(
        Integer, ForeignKey("supplier_profiles.id", ondelete="CASCADE"), nullable=False
    )
    invited_at = Column(DateTime(timezone=True), server_default=func.now())
    responded_at = Column(DateTime(timezone=True), nullable=True)
    status = Column(String(50), default="invited")

    rfq = relationship("RFQ", back_populates="invitations")
    supplier = relationship("SupplierProfile", back_populates="invitations")


class QuotationStatus(str, enum.Enum):
    draft = "draft"
    submitted = "submitted"
    pending_finance_approval = "pending_finance_approval"
    approved = "approved"
    rejected = "rejected"


class Quotation(Base):
    __tablename__ = "rfq_quotations"

    id = Column(Integer, primary_key=True, index=True)
    rfq_id = Column(Integer, ForeignKey("rfqs.id", ondelete="CASCADE"), nullable=False)
    supplier_id = Column(
        Integer, ForeignKey("supplier_profiles.id", ondelete="CASCADE"), nullable=False
    )
    supplier_user_id = Column(
        Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    amount = Column(Numeric(14, 2), nullable=False)
    currency = Column(String(10), default="USD")
    tax_type = Column(String(10), nullable=True)  # 'VAT', 'TOT', or None
    tax_amount = Column(Numeric(14, 2), nullable=True)
    notes = Column(Text, nullable=True)
    document_path = Column(String(500), nullable=True)
    original_filename = Column(String(255), nullable=True)
    status = Column(Enum(QuotationStatus), default=QuotationStatus.submitted)
    submitted_at = Column(DateTime(timezone=True), server_default=func.now())
    approved_at = Column(DateTime(timezone=True), nullable=True)
    approved_by_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    budget_override_justification = Column(Text, nullable=True)
    finance_approval_requested_at = Column(DateTime(timezone=True), nullable=True)
    finance_approval_requested_by_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    
    # Delivery tracking fields
    delivery_status = Column(String(20), nullable=True)  # 'delivered' or None
    delivered_at = Column(DateTime(timezone=True), nullable=True)
    delivery_note_path = Column(String(500), nullable=True)
    delivery_note_filename = Column(String(255), nullable=True)
    marked_delivered_by_id = Column(Integer, ForeignKey("users.id"), nullable=True)

    rfq = relationship("RFQ", back_populates="quotations")
    supplier = relationship("SupplierProfile", back_populates="quotations")
    supplier_user = relationship("User", foreign_keys=[supplier_user_id], back_populates="quotations")
    approved_by = relationship("User", foreign_keys=[approved_by_id])
    finance_approval_requested_by = relationship("User", foreign_keys=[finance_approval_requested_by_id])
    marked_delivered_by = relationship("User", foreign_keys=[marked_delivered_by_id])

    @property
    def supplier_name(self) -> str | None:
        """Convenience accessor for supplier company name."""
        return self.supplier.company_name if self.supplier else None


class RFQDocument(Base):
    __tablename__ = "rfq_documents"

    id = Column(Integer, primary_key=True, index=True)
    rfq_id = Column(Integer, ForeignKey("rfqs.id", ondelete="CASCADE"), nullable=False)
    file_path = Column(String(500), nullable=False)
    original_filename = Column(String(255), nullable=False)
    uploaded_at = Column(DateTime(timezone=True), server_default=func.now())

    rfq = relationship("RFQ", back_populates="documents")
