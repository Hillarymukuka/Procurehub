"""Purchase request model representing requester submissions."""

import enum

from sqlalchemy import Column, DateTime, Enum, ForeignKey, Integer, Numeric, String, Text, func
from sqlalchemy.orm import relationship

from ..database import Base


class RequestStatus(str, enum.Enum):
    pending_hod = "pending_hod"  # Awaiting Head of Department review
    rejected_by_hod = "rejected_by_hod"
    pending_procurement = "pending_procurement"  # After HOD approval
    rejected_by_procurement = "rejected_by_procurement"
    pending_finance = "pending_finance_approval"  # Deprecated, kept for migration
    rejected_by_finance = "rejected_by_finance"  # Deprecated, kept for migration
    finance_approved = "finance_approved"  # Deprecated, kept for migration
    rfq_issued = "rfq_issued"
    completed = "completed"


class PurchaseRequest(Base):
    __tablename__ = "purchase_requests"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String(255), nullable=False)
    description = Column(Text, nullable=False)
    justification = Column(Text, nullable=False)
    category = Column(String(120), nullable=False, index=True)
    department_id = Column(Integer, ForeignKey("departments.id", ondelete="SET NULL"), nullable=True)
    proposed_budget_amount = Column("budget", Numeric(14, 2), nullable=True)
    proposed_budget_currency = Column("currency", String(16), nullable=True)
    finance_budget_amount = Column(Numeric(14, 2), nullable=True)
    finance_budget_currency = Column(String(16), nullable=True)
    needed_by = Column(DateTime(timezone=True), nullable=False)
    status = Column(Enum(RequestStatus), default=RequestStatus.pending_procurement, index=True)
    procurement_notes = Column(Text, nullable=True)
    finance_notes = Column(Text, nullable=True)  # Deprecated
    hod_notes = Column(Text, nullable=True)
    hod_rejection_reason = Column(Text, nullable=True)
    procurement_rejection_reason = Column(Text, nullable=True)
    finance_rejection_reason = Column(Text, nullable=True)  # Deprecated

    requester_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    hod_reviewer_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    procurement_reviewer_id = Column(
        "approved_by_id", Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    finance_reviewer_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)  # Deprecated
    rfq_id = Column(Integer, ForeignKey("rfqs.id", ondelete="SET NULL"), nullable=True)

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    hod_reviewed_at = Column(DateTime(timezone=True), nullable=True)
    procurement_reviewed_at = Column("approved_at", DateTime(timezone=True), nullable=True)
    finance_reviewed_at = Column(DateTime(timezone=True), nullable=True)  # Deprecated
    rfq_invited_at = Column(DateTime(timezone=True), nullable=True)

    requester = relationship("User", foreign_keys=[requester_id], backref="purchase_requests")
    hod_reviewer = relationship("User", foreign_keys=[hod_reviewer_id])
    procurement_reviewer = relationship("User", foreign_keys=[procurement_reviewer_id])
    finance_reviewer = relationship("User", foreign_keys=[finance_reviewer_id])  # Deprecated
    department = relationship("Department", back_populates="requests")
    rfq = relationship("RFQ", backref="source_request", uselist=False)
    documents = relationship(
        "RequestDocument", back_populates="request", cascade="all, delete-orphan", passive_deletes=True
    )


class RequestDocument(Base):
    __tablename__ = "request_documents"

    id = Column(Integer, primary_key=True, index=True)
    request_id = Column(Integer, ForeignKey("purchase_requests.id", ondelete="CASCADE"), nullable=False)
    file_path = Column(String(500), nullable=False)
    original_filename = Column(String(255), nullable=False)
    uploaded_by_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    uploaded_at = Column(DateTime(timezone=True), server_default=func.now())

    request = relationship("PurchaseRequest", back_populates="documents")
    uploaded_by = relationship("User")
