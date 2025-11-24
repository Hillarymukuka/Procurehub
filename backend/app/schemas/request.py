from datetime import datetime
from decimal import Decimal
from enum import Enum
from typing import List, Optional

from pydantic import BaseModel, Field


class RequestStatusEnum(str, Enum):
    pending_hod = "pending_hod"  # Awaiting Head of Department review
    rejected_by_hod = "rejected_by_hod"
    pending_procurement = "pending_procurement"
    rejected_by_procurement = "rejected_by_procurement"
    pending_finance_approval = "pending_finance_approval"  # Deprecated
    rejected_by_finance = "rejected_by_finance"  # Deprecated
    finance_approved = "finance_approved"  # Deprecated
    rfq_issued = "rfq_issued"
    completed = "completed"


class RequestBase(BaseModel):
    title: str
    description: str
    justification: str
    category: str
    department_id: int
    needed_by: datetime


class RequestCreate(RequestBase):
    pass


class RequestUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    justification: Optional[str] = None
    category: Optional[str] = None
    department_id: Optional[int] = None
    needed_by: Optional[datetime] = None
    procurement_notes: Optional[str] = None


class RequestHODReview(BaseModel):
    """HOD review and approval payload."""
    title: Optional[str] = None
    description: Optional[str] = None
    justification: Optional[str] = None
    category: Optional[str] = None
    department_id: Optional[int] = None
    needed_by: Optional[datetime] = None
    hod_notes: Optional[str] = None


class RequestHODRejection(BaseModel):
    """HOD rejection payload."""
    reason: str
    hod_notes: Optional[str] = None


class RequestProcurementReview(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    justification: Optional[str] = None
    category: Optional[str] = None
    department_id: Optional[int] = None
    needed_by: Optional[datetime] = None
    budget_amount: Decimal = Field(..., gt=0)
    budget_currency: str = Field(default="ZMW", min_length=1, max_length=16)
    procurement_notes: Optional[str] = None


class RequestDenial(BaseModel):
    reason: Optional[str] = None


class RequestFinanceApproval(BaseModel):
    budget_amount: Optional[Decimal] = Field(default=None, gt=0)
    budget_currency: Optional[str] = Field(default=None, min_length=1, max_length=16)
    finance_notes: Optional[str] = None


class RequestFinanceRejection(BaseModel):
    reason: Optional[str] = None
    finance_notes: Optional[str] = None



class RequestSupplierInvite(BaseModel):
    supplier_ids: List[int]
    rfq_deadline: datetime
    notes: Optional[str] = None


class RequestDocumentRead(BaseModel):
    id: int
    original_filename: str
    file_path: str
    uploaded_at: datetime

    class Config:
        from_attributes = True


class RequestResponse(BaseModel):
    id: int
    title: str
    description: str
    justification: str
    category: str
    department_id: Optional[int] = None
    department_name: Optional[str] = None
    needed_by: datetime
    status: RequestStatusEnum
    hod_notes: Optional[str] = None
    hod_rejection_reason: Optional[str] = None
    hod_reviewer_id: Optional[int] = None
    hod_reviewer_name: Optional[str] = None
    hod_reviewed_at: Optional[datetime] = None
    procurement_notes: Optional[str] = None
    finance_notes: Optional[str] = None  # Deprecated
    requester_id: Optional[int] = None
    requester_name: Optional[str] = None
    procurement_reviewer_id: Optional[int] = None
    procurement_reviewer_name: Optional[str] = None
    procurement_reviewed_at: Optional[datetime] = None
    finance_reviewer_id: Optional[int] = None  # Deprecated
    finance_reviewer_name: Optional[str] = None  # Deprecated
    finance_reviewed_at: Optional[datetime] = None  # Deprecated
    proposed_budget_amount: Optional[Decimal] = None
    proposed_budget_currency: Optional[str] = None
    finance_budget_amount: Optional[Decimal] = None  # Deprecated
    finance_budget_currency: Optional[str] = None  # Deprecated
    procurement_rejection_reason: Optional[str] = None
    finance_rejection_reason: Optional[str] = None  # Deprecated
    budget: Optional[Decimal] = None
    currency: Optional[str] = None
    approved_by_id: Optional[int] = None
    approved_by_name: Optional[str] = None
    approved_at: Optional[datetime] = None
    created_at: datetime
    updated_at: Optional[datetime] = None
    rfq_id: Optional[int] = None
    rfq_title: Optional[str] = None
    rfq_number: Optional[str] = None
    rfq_invited_at: Optional[datetime] = None
    documents: List[RequestDocumentRead] = []

    class Config:
        from_attributes = True
