"""Supplier related endpoints."""

from __future__ import annotations

import json
from typing import List, Optional

from fastapi import APIRouter, Depends, File, Form, HTTPException, Request, UploadFile, status
from fastapi.responses import FileResponse
from slowapi import Limiter
from slowapi.util import get_remote_address
from sqlalchemy.orm import Session, joinedload, selectinload

from ..database import get_db

router = APIRouter()
limiter = Limiter(key_func=get_remote_address)

from ..dependencies import get_current_supplier_profile, require_roles, get_current_active_user
from ..models import (
    Quotation,
    QuotationStatus,
    RFQ,
    RFQInvitation,
    RFQStatus,
    SupplierCategory,
    SupplierCategoryType,
    SupplierDocument,
    SupplierDocumentType,
    SupplierProfile,
    User,
    UserRole,
)
from ..schemas import (
    RFQRead,
    RFQReadForSupplier,
    SupplierProfileRead,
    SupplierRegistrationRequest,
    SupplierRegistrationResponse,
    UserCreate,
)
from ..services.auth import create_user, get_user_by_email
from ..services.email import email_service
from ..services.file_storage import save_upload_file
from ..services.rfq import close_expired_rfqs
from ..utils.supplier_utils import generate_supplier_number

@router.get("/documents/{document_id}/download", response_class=FileResponse)
def download_supplier_document(
    document_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Download a supplier document by its ID with authorization check."""
    document = db.query(SupplierDocument).filter(SupplierDocument.id == document_id).first()
    if not document or not getattr(document, "file_path", None):
        raise HTTPException(status_code=404, detail="Document not found")
    
    # Authorization check - only SuperAdmin, Procurement, Procurement Officers, and document owner can access
    user_role = current_user.role
    
    # Allow admin and procurement roles to view all documents
    if user_role not in [UserRole.superadmin, UserRole.procurement, UserRole.procurement_officer]:
        # Suppliers can only access their own documents
        if user_role == UserRole.supplier:
            supplier_profile = db.query(SupplierProfile).filter(
                SupplierProfile.user_id == current_user.id
            ).first()
            
            if not supplier_profile or document.supplier_id != supplier_profile.id:
                raise HTTPException(
                    status_code=403,
                    detail="Not authorized to access this document"
                )
        else:
            raise HTTPException(
                status_code=403,
                detail="Not authorized to access this document"
            )
    
    return FileResponse(
        path=getattr(document, "file_path"),
        filename=getattr(document, "original_filename"),
        media_type="application/octet-stream",
        headers={"Content-Disposition": f'attachment; filename="{getattr(document, "original_filename")}"'}
    )


def _parse_categories(raw: Optional[str]) -> List[str]:
    if not raw:
        return []
    try:
        parsed = json.loads(raw)
        if isinstance(parsed, list):
            return [str(item).strip() for item in parsed if str(item).strip()]
    except json.JSONDecodeError:
        pass
    return [part.strip() for part in raw.split(",") if part.strip()]


def _resolve_categories(names: List[str]) -> List[SupplierCategory]:
    if not names:
        return []

    cleaned: List[str] = []
    seen: set[str] = set()
    for raw in names:
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
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Suppliers can only have a primary and secondary category.",
        )

    category_types = [SupplierCategoryType.primary, SupplierCategoryType.secondary]
    resolved: List[SupplierCategory] = []
    for index, category_name in enumerate(cleaned):
        category_type = category_types[index]
        resolved.append(
            SupplierCategory(name=category_name, category_type=category_type)
        )
    return resolved


def _store_supplier_document(
    db: Session,
    profile_id: int,
    document_type: SupplierDocumentType,
    upload: UploadFile | None,
) -> None:
    if not upload or not upload.filename:
        return
    stored_path = save_upload_file(upload, subdir=f"supplier_{profile_id}/documents")
    document = SupplierDocument(
        supplier_id=profile_id,
        document_type=document_type,
        file_path=str(stored_path),
        original_filename=upload.filename,
    )
    db.add(document)


@router.post(
    "/register",
    response_model=SupplierRegistrationResponse,
    status_code=status.HTTP_201_CREATED,
)
@limiter.limit("3/hour")  # Rate limit supplier registration to prevent abuse
async def register_supplier(
    request: Request,
    company_name: str = Form(...),
    full_name: str = Form(...),
    email: str = Form(...),
    password: str = Form(...),
    contact_phone: Optional[str] = Form(None),
    address: Optional[str] = Form(None),
    preferred_currency: Optional[str] = Form("USD"),
    categories: Optional[str] = Form(None),
    incorporation_file: UploadFile | None = File(None),
    tax_clearance_file: UploadFile | None = File(None),
    company_profile_file: UploadFile | None = File(None),
    db: Session = Depends(get_db),
) -> SupplierRegistrationResponse:
    """Register a supplier account along with supporting documents."""
    if get_user_by_email(db, email):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Email already registered")

    registration = SupplierRegistrationRequest(
        company_name=company_name,
        full_name=full_name,
        email=email,
        password=password,
        contact_phone=contact_phone,
        address=address,
        preferred_currency=preferred_currency,
        categories=_parse_categories(categories),
    )

    user_create = UserCreate(
        email=registration.email,
        full_name=registration.full_name,
        password=registration.password,
        role=UserRole.supplier.value,
    )
    user = create_user(db, user_create)

    # Generate unique supplier number
    supplier_number = generate_supplier_number(db)

    profile = SupplierProfile(
        supplier_number=supplier_number,
        company_name=registration.company_name,
        contact_email=registration.email,
        contact_phone=registration.contact_phone,
        address=registration.address,
        preferred_currency=registration.preferred_currency,
        user_id=user.id,
    )
    db.add(profile)
    db.flush()

    profile.categories = _resolve_categories(registration.categories)

    _store_supplier_document(db, getattr(profile, "id", 0), SupplierDocumentType.incorporation, incorporation_file)
    _store_supplier_document(db, getattr(profile, "id", 0), SupplierDocumentType.tax_clearance, tax_clearance_file)
    _store_supplier_document(db, getattr(profile, "id", 0), SupplierDocumentType.company_profile, company_profile_file)

    email_service.send_email(
        [registration.email],
        subject="Welcome to ProcuraHub",
        body=(
            f"Hello {registration.full_name},\n\n"
            "Your supplier account has been created successfully. "
            "You can now sign in to respond to RFQs and manage your company profile.\n\n"
            "Regards,\nProcurement Team"
        ),
    )

    db.commit()
    def extract_id(obj):
        val = getattr(obj, 'id', None)
        if val is None:
            return 0
        return int(val)
    return SupplierRegistrationResponse(user_id=extract_id(user), supplier_id=extract_id(profile))


@router.get("/me/profile", response_model=SupplierProfileRead)
def get_my_profile(
    profile: SupplierProfile = Depends(get_current_supplier_profile),
) -> SupplierProfile:
    return profile


@router.get("/me/invitations")
def get_my_invitations(
    profile: SupplierProfile = Depends(get_current_supplier_profile),
    db: Session = Depends(get_db),
):
    close_expired_rfqs(db)
    invitations = (
        db.query(RFQInvitation, RFQ)
        .join(RFQ, RFQInvitation.rfq_id == RFQ.id)
        .options(selectinload(RFQ.documents))
        .filter(RFQInvitation.supplier_id == profile.id)
        .order_by(RFQInvitation.invited_at.desc())
        .all()
    )

    results = []
    for invitation, rfq in invitations:
        existing_quotation = (
            db.query(Quotation)
            .filter(Quotation.rfq_id == rfq.id, Quotation.supplier_id == profile.id)
            .first()
        )
        results.append(
            {
                "rfq_id": rfq.id,
                "rfq_number": rfq.rfq_number,
                "rfq_title": rfq.title,
                "rfq_description": rfq.description,
                "rfq_status": rfq.status.value if isinstance(rfq.status, RFQStatus) else rfq.status,
                "category": rfq.category,
                "deadline": rfq.deadline,
                "status": invitation.status,
                "invited_at": invitation.invited_at,
                "has_responded": existing_quotation is not None,
                "quotation_status": existing_quotation.status.value if existing_quotation else None,
                "documents": [
                    {
                        "id": document.id,
                        "original_filename": document.original_filename,
                        "file_path": document.file_path,
                        "uploaded_at": document.uploaded_at,
                    }
                    for document in rfq.documents
                ],
            }
        )
    return results


@router.get("/me/rfqs/active", response_model=list[RFQReadForSupplier])
def get_active_rfqs(
    current_supplier: SupplierProfile = Depends(get_current_supplier_profile),
    db: Session = Depends(get_db),
):
    close_expired_rfqs(db)
    active_rfqs = (
        db.query(RFQ)
        .options(selectinload(RFQ.documents))
        .join(RFQInvitation, RFQ.id == RFQInvitation.rfq_id)
        .filter(
            RFQInvitation.supplier_id == current_supplier.id,
            RFQ.status == RFQStatus.open,
        )
        .order_by(RFQ.deadline.asc())
        .all()
    )
    rfq_ids = [rfq.id for rfq in active_rfqs]
    quotation_map: dict[int, Quotation] = {}
    if rfq_ids:
        quotations = (
            db.query(Quotation)
            .filter(
                Quotation.supplier_id == current_supplier.id,
                Quotation.rfq_id.in_(rfq_ids),
            )
            .all()
        )
        quotation_map = {quotation.rfq_id: quotation for quotation in quotations}

    results: list[RFQReadForSupplier] = []
    for rfq in active_rfqs:
        quotation = quotation_map.get(rfq.id)
        has_responded = quotation is not None
        status_value: str | None = None
        if quotation:
            raw_status = getattr(quotation, "status", None)
            status_value = raw_status.value if isinstance(raw_status, QuotationStatus) else raw_status
        rfq_schema = RFQReadForSupplier.model_validate(rfq)
        results.append(
            rfq_schema.model_copy(
                update={
                    "has_responded": has_responded,
                    "quotation_status": status_value,
                }
            )
        )
    return results


@router.get("/me/purchase-orders", response_model=List[dict])
def get_purchase_orders(
    current_supplier: SupplierProfile = Depends(get_current_supplier_profile),
    db: Session = Depends(get_db),
):
    """Return quotations that have been approved for the supplier."""
    purchase_orders = (
        db.query(Quotation)
        .options(joinedload(Quotation.rfq))
        .filter(
            Quotation.supplier_id == current_supplier.id,
            Quotation.status == QuotationStatus.approved,
        )
        .order_by(Quotation.approved_at.desc())
        .all()
    )

    results = []
    for quotation in purchase_orders:
        rfq = quotation.rfq
        results.append(
            {
                "id": quotation.id,
                "rfq_id": rfq.id if rfq else None,
                "rfq_title": rfq.title if rfq else "",
                "rfq_category": rfq.category if rfq else "",
                "amount": float(getattr(quotation, "amount", 0.0)),
                "currency": quotation.currency,
                "notes": quotation.notes,
                "submitted_at": quotation.submitted_at,
                "approved_at": quotation.approved_at,
                "original_filename": quotation.original_filename,
            }
        )
    return results
