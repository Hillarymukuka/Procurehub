"""RFQ and quotation schemas."""

from datetime import datetime, date
from decimal import Decimal
from typing import Any, List, Optional

from pydantic import Field, model_validator, field_validator

from .common import ORMBase


class RFQCreate(ORMBase):
    rfq_number: Optional[str] = None
    title: str
    description: str
    category: str
    budget: Decimal = Field(gt=0)
    currency: str = "USD"
    deadline_days: int = Field(gt=0, description="Number of days from now for the deadline")


class RFQUpdate(ORMBase):
    description: Optional[str] = None
    budget: Optional[Decimal] = None
    deadline: Optional[datetime] = None
    status: Optional[str] = None
    
    @field_validator('deadline')
    @classmethod
    def deadline_not_in_past(cls, v: Optional[datetime]) -> Optional[datetime]:
        if v is not None and v.date() < date.today():
            raise ValueError('RFQ deadline cannot be in the past')
        return v


class RFQDocumentRead(ORMBase):
    id: int
    file_path: str
    original_filename: str
    uploaded_at: datetime


class PurchaseOrderRead(ORMBase):
    id: int
    po_number: str
    supplier_id: Optional[int] = None
    supplier_name: Optional[str] = None
    supplier_number: Optional[str] = None
    amount: Decimal
    currency: str
    rfq_id: int
    rfq_number: Optional[str] = None
    rfq_title: str
    approved_at: Optional[datetime] = None
    submitted_at: datetime


class RFQRead(ORMBase):
    id: int
    rfq_number: str
    title: str
    description: str
    category: str
    budget: Decimal
    currency: str
    deadline: datetime
    status: str
    response_locked: bool = False
    created_at: Optional[datetime]
    created_by_id: Optional[int] = None
    created_by_name: Optional[str] = None
    created_by_role: Optional[str] = None
    documents: List["RFQDocumentRead"] = []


class RFQReadForSupplier(ORMBase):
    """RFQ schema for suppliers - excludes budget information."""
    id: int
    rfq_number: str
    title: str
    description: str
    category: str
    currency: str
    deadline: datetime
    status: str
    response_locked: bool = False
    created_at: Optional[datetime]
    documents: List["RFQDocumentRead"] = []
    has_responded: bool = False
    quotation_status: Optional[str] = None


class QuotationCreate(ORMBase):
    amount: Decimal = Field(gt=0)
    currency: str = "USD"
    tax_type: Optional[str] = None  # 'VAT', 'TOT', or None
    tax_amount: Optional[Decimal] = None
    notes: Optional[str] = None


class QuotationRead(ORMBase):
    id: int
    rfq_id: int
    supplier_id: int
    supplier_name: Optional[str] = None
    supplier_number: Optional[str] = None
    amount: Decimal
    currency: str
    tax_type: Optional[str] = None
    tax_amount: Optional[Decimal] = None
    notes: Optional[str]
    status: str
    submitted_at: datetime
    approved_at: Optional[datetime]
    document_path: Optional[str] = None
    original_filename: Optional[str] = None
    budget_override_justification: Optional[str] = None
    
    # Delivery tracking fields
    delivery_status: Optional[str] = None
    delivered_at: Optional[datetime] = None
    delivery_note_path: Optional[str] = None
    delivery_note_filename: Optional[str] = None

    @model_validator(mode='before')
    @classmethod
    def extract_supplier_info(cls, data: Any) -> Any:
        """Extract supplier name and number from the supplier relationship."""
        if isinstance(data, dict):
            return data
        
        # If data is an ORM model instance, convert to dict and add supplier info
        if hasattr(data, '__dict__'):
            result = {
                'id': getattr(data, 'id', None),
                'rfq_id': getattr(data, 'rfq_id', None),
                'supplier_id': getattr(data, 'supplier_id', None),
                'amount': getattr(data, 'amount', None),
                'currency': getattr(data, 'currency', 'USD'),
                'notes': getattr(data, 'notes', None),
                'status': getattr(data, 'status', None),
                'submitted_at': getattr(data, 'submitted_at', None),
                'approved_at': getattr(data, 'approved_at', None),
                'document_path': getattr(data, 'document_path', None),
                'original_filename': getattr(data, 'original_filename', None),
                'tax_type': getattr(data, 'tax_type', None),
                'tax_amount': getattr(data, 'tax_amount', None),
                'budget_override_justification': getattr(data, 'budget_override_justification', None),
                'delivery_status': getattr(data, 'delivery_status', None),
                'delivered_at': getattr(data, 'delivered_at', None),
                'delivery_note_path': getattr(data, 'delivery_note_path', None),
                'delivery_note_filename': getattr(data, 'delivery_note_filename', None),
            }
            
            # Add supplier info if relationship is loaded
            supplier = getattr(data, 'supplier', None)
            if supplier:
                result['supplier_name'] = getattr(supplier, 'company_name', None)
                result['supplier_number'] = getattr(supplier, 'supplier_number', None)
            
            return result
        
        return data


class RFQWithQuotations(RFQRead):
    quotations: List[QuotationRead] = []


class ProcurementRFQCreate(RFQCreate):
    supplier_ids: List[int] = Field(default_factory=list)
