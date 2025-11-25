"""RFQ and quotation endpoints."""

from datetime import datetime, timezone
from zoneinfo import ZoneInfo
from decimal import Decimal
from typing import Any, Iterable, Sequence

from fastapi import APIRouter, BackgroundTasks, Depends, File, Form, HTTPException, Request, UploadFile, status
from fastapi.responses import FileResponse, Response
from pydantic import ValidationError
from sqlalchemy.orm import Session, selectinload, joinedload
from starlette.datastructures import UploadFile as StarletteUploadFile

from ..config import get_settings
from ..database import get_db
from ..dependencies import get_current_active_user, get_current_supplier_profile, require_roles
from ..models import (
    CompanySettings,
    Message,
    MessageStatus,
    Quotation,
    QuotationStatus,
    RFQ,
    RFQDocument,
    RFQInvitation,
    RFQStatus,
    RequestStatus,
    SupplierProfile,
    User,
    UserRole,
)
from ..schemas import ProcurementRFQCreate, RFQRead, RFQUpdate, RFQWithQuotations, PurchaseOrderRead
from ..services.email import email_service
from ..services.email_templates import (
    quotation_approved_email,
    quotation_rejected_email,
    quotation_submitted_email,
    rfq_invitation_email,
)
from ..services.file_storage import save_upload_file
from ..services.pdf_generator import generate_purchase_order_pdf
from ..services.rfq import close_expired_rfqs, create_invitations, select_suppliers_for_rfq, generate_rfq_number

router = APIRouter()
settings = get_settings()


def _normalize_deadline(deadline: datetime) -> datetime:
    """Keep deadline as Africa/Cairo time with timezone info."""
    cairo_tz = ZoneInfo("Africa/Cairo")
    if deadline.tzinfo:
        # Convert to Africa/Cairo if it has a different timezone
        return deadline.astimezone(cairo_tz)
    # If no timezone, assume it's Africa/Cairo time
    return deadline.replace(tzinfo=cairo_tz)


def _ensure_deadline_in_future(deadline: datetime) -> datetime:
    normalized = _normalize_deadline(deadline)
    cairo_tz = ZoneInfo("Africa/Cairo")
    now_cairo = datetime.now(cairo_tz)
    if normalized <= now_cairo:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Deadline must be in the future",
        )
    return normalized


def _coerce_supplier_ids(raw: Any) -> list[int]:
    """Coerce various supplier_id formats (list, comma separated string, etc.) into integers."""
    if raw is None:
        return []

    if isinstance(raw, (list, tuple, set)):
        items: Iterable[Any]
        items = raw
    else:
        items = [raw]

    collected: list[int] = []
    for item in items:
        if item is None:
            continue
        if isinstance(item, str):
            parts: Sequence[str] = [part.strip() for part in item.split(",")]
        else:
            parts = [item]
        for part in parts:
            if part in ("", None):
                continue
            try:
                collected.append(int(part))
            except (TypeError, ValueError) as exc:
                raise HTTPException(
                    status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                    detail="supplier_ids must be integers",
                ) from exc
    return collected


async def _extract_procurement_payload(request: Request) -> tuple[ProcurementRFQCreate, list[UploadFile]]:
    """Parse either JSON or multipart RFQ submissions for procurement users."""
    content_type = request.headers.get("content-type", "")
    attachments: list[UploadFile] = []

    if content_type.startswith("application/json"):
        raw_data: dict[str, Any] = await request.json()
        raw_supplier_ids = raw_data.pop("supplier_ids", None)
        supplier_ids = _coerce_supplier_ids(raw_supplier_ids)
    else:
        form = await request.form()
        raw_data = {
            "title": form.get("title"),
            "description": form.get("description"),
            "category": form.get("category"),
            "budget": form.get("budget"),
            "currency": form.get("currency"),
            "deadline": form.get("deadline"),
        }
        supplier_values = form.getlist("supplier_ids")
        supplier_ids = _coerce_supplier_ids(supplier_values)
        
        # Get all files from the form
        all_files = form.getlist("files")
        attachments = [
            file
            for file in all_files
            if isinstance(file, StarletteUploadFile) and file.filename and file.filename.strip()
        ]

    raw_data["supplier_ids"] = supplier_ids

    try:
        submission = ProcurementRFQCreate(**raw_data)
    except ValidationError as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=exc.errors(),
        ) from exc
    except TypeError as exc:  # pragma: no cover - defensive fallback
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=str(exc),
        ) from exc

    return submission, attachments


@router.post(
    "/",
    response_model=RFQRead,
    status_code=status.HTTP_201_CREATED,
)
async def create_rfq(
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(UserRole.procurement, UserRole.procurement_officer, UserRole.superadmin)),
):
    close_expired_rfqs(db)

    submission, attachments = await _extract_procurement_payload(request)
    normalized_deadline = _ensure_deadline_in_future(submission.deadline)

    # Procurement Officers create RFQs in draft status pending approval
    user_role = getattr(current_user, "role")
    initial_status = RFQStatus.draft if user_role == UserRole.procurement_officer else RFQStatus.open

    rfq = RFQ(
        title=submission.title,
        description=submission.description,
        category=submission.category,
        budget=submission.budget,
        currency=submission.currency,
        deadline=normalized_deadline,
        status=initial_status,
        created_by_id=current_user.id,
    )
    db.add(rfq)
    db.flush()
    db.refresh(rfq)

    if not getattr(rfq, "rfq_number", None):
        rfq.rfq_number = generate_rfq_number(rfq.id, getattr(rfq, "created_at", None))

    # Only create invitations for open RFQs (created by Procurement/SuperAdmin)
    # Draft RFQs (created by Procurement Officers) will NOT have invitations created
    # Main Procurement will select suppliers and create invitations when approving the draft
    if initial_status == RFQStatus.open:
        supplier_ids = submission.supplier_ids or []
        if supplier_ids:
            suppliers = (
                db.query(SupplierProfile)
                .filter(SupplierProfile.id.in_(supplier_ids))
                .all()
            )
            # Validate supplier IDs exist - simplified for now
            if len(suppliers) != len(supplier_ids):
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="One or more supplier IDs not found",
                )
        else:
            suppliers = select_suppliers_for_rfq(
                db, str(rfq.category), limit=settings.invitation_batch_size
            )
        
        # Create invitations and send emails immediately for open RFQs
        create_invitations(db, rfq, suppliers, invited_by=current_user, send_emails=True)

    # Save uploaded documents to database
    for upload in attachments:
        try:
            saved_path = save_upload_file(upload, subdir=f"rfq_{rfq.id}/attachments")
            
            # Store relative path from uploads directory for web access
            upload_dir = settings.resolved_upload_dir
            try:
                relative_path = saved_path.relative_to(upload_dir)
                document_path = str(relative_path).replace('\\', '/')  # Normalize path separators
            except ValueError:
                # Fallback to full path if relative_to fails
                document_path = str(saved_path)
            
            # Create document record
            document = RFQDocument(
                rfq_id=rfq.id,
                file_path=document_path,
                original_filename=upload.filename or "unknown",
            )
            db.add(document)
            
        except Exception as e:
            print(f"Failed to save document {upload.filename}: {e}")
        finally:
            try:
                upload.file.close()
            except Exception:
                pass

    db.commit()  # Commit all changes including documents
    db.refresh(rfq)  # Refresh to get the latest state
    
    # Load documents relationship for the response
    rfq_with_docs = (
        db.query(RFQ)
        .options(selectinload(RFQ.documents))
        .filter(RFQ.id == rfq.id)
        .first()
    )
    
    return RFQRead.model_validate(rfq_with_docs)


@router.post("/{rfq_id}/approve-draft", response_model=RFQRead)
async def approve_draft_rfq(
    rfq_id: int,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(UserRole.superadmin, UserRole.procurement)),
):
    """
    Approve a draft RFQ created by a Procurement Officer.
    Only SuperAdmin and Procurement can approve draft RFQs.
    Changes the RFQ status from 'draft' to 'open' and sends invitation emails to selected suppliers.
    
    Expects JSON body: { "supplier_ids": [1, 2, 3] }
    """
    # Parse supplier IDs from request body
    try:
        body = await request.json()
        supplier_ids = body.get("supplier_ids", [])
    except Exception:
        supplier_ids = []
    
    rfq = (
        db.query(RFQ)
        .options(
            selectinload(RFQ.invitations),
            selectinload(RFQ.documents),
            selectinload(RFQ.created_by)
        )
        .filter(RFQ.id == rfq_id)
        .first()
    )
    if not rfq:
        raise HTTPException(status_code=404, detail="RFQ not found")
    
    # Verify it's in draft status
    if getattr(rfq, "status") != RFQStatus.draft:
        raise HTTPException(
            status_code=400, 
            detail=f"Can only approve RFQs in draft status. Current status: {getattr(rfq, 'status')}"
        )
    
    # Change status to open
    rfq.status = RFQStatus.open
    
    # Draft RFQs created by Procurement Officers have no invitations
    # Main Procurement creates invitations when approving
    
    # Get selected suppliers or auto-select from category
    if supplier_ids:
        suppliers = (
            db.query(SupplierProfile)
            .filter(SupplierProfile.id.in_(supplier_ids))
            .all()
        )
        if len(suppliers) != len(supplier_ids):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="One or more supplier IDs not found",
            )
    else:
        # Auto-select suppliers from category if none specified
        suppliers = select_suppliers_for_rfq(
            db, str(rfq.category), limit=settings.invitation_batch_size
        )
    
    # Create invitations and send emails
    create_invitations(db, rfq, suppliers, invited_by=current_user, send_emails=True)
    
    db.commit()
    db.refresh(rfq)
    
    # Prepare response with creator info
    rfq_dict = RFQRead.model_validate(rfq).model_dump()
    creator = getattr(rfq, "created_by", None)
    if creator:
        rfq_dict["created_by_name"] = getattr(creator, "full_name", None)
        rfq_dict["created_by_role"] = getattr(creator, "role", None)
    
    return RFQRead(**rfq_dict)


@router.get("/", response_model=list[RFQRead])

def list_rfqs(
    db: Session = Depends(get_db),
    _: User = Depends(require_roles(UserRole.superadmin, UserRole.procurement, UserRole.procurement_officer, UserRole.requester, UserRole.finance)),
):
    close_expired_rfqs(db)
    rfqs = (
        db.query(RFQ)
        .options(selectinload(RFQ.created_by), selectinload(RFQ.documents))
        .order_by(RFQ.created_at.desc())
        .all()
    )
    
    # Add creator information to each RFQ
    result = []
    for rfq in rfqs:
        rfq_dict = RFQRead.model_validate(rfq).model_dump()
        creator = getattr(rfq, "created_by", None)
        if creator:
            rfq_dict["created_by_name"] = getattr(creator, "full_name", None)
            rfq_dict["created_by_role"] = getattr(creator, "role", None)
        result.append(RFQRead(**rfq_dict))
    
    return result


@router.get("/pending-finance-approvals", response_model=list[RFQWithQuotations])
def list_rfqs_with_pending_finance_approvals(
    db: Session = Depends(get_db),
    _: User = Depends(require_roles(UserRole.finance, UserRole.superadmin)),
):
    """Get RFQs that have quotations pending finance approval."""
    close_expired_rfqs(db)
    
    # Get all RFQs with quotations
    rfqs = (
        db.query(RFQ)
        .options(
            selectinload(RFQ.quotations).selectinload(Quotation.supplier),
            selectinload(RFQ.documents),
            selectinload(RFQ.created_by)
        )
        .order_by(RFQ.created_at.desc())
        .all()
    )
    
    # Filter to only include RFQs with pending finance approval quotations
    result = []
    for rfq in rfqs:
        # Check if this RFQ has any quotations pending finance approval
        has_pending = any(
            q.status == QuotationStatus.pending_finance_approval
            for q in rfq.quotations
        )
        
        if has_pending:
            rfq_dict = RFQWithQuotations.model_validate(rfq).model_dump()
            creator = getattr(rfq, "created_by", None)
            if creator:
                rfq_dict["created_by_name"] = getattr(creator, "full_name", None)
                rfq_dict["created_by_role"] = getattr(creator, "role", None)
            result.append(RFQWithQuotations(**rfq_dict))
    
    return result


@router.get("/finance-approved", response_model=list[RFQWithQuotations])
def list_finance_approved_rfqs(
    db: Session = Depends(get_db),
    _: User = Depends(require_roles(UserRole.finance, UserRole.superadmin)),
):
    """Get RFQs that were approved by Finance (had quotations that went through finance approval process)."""
    close_expired_rfqs(db)
    
    # Get all awarded RFQs with quotations that went through finance approval
    rfqs = (
        db.query(RFQ)
        .options(
            selectinload(RFQ.quotations).selectinload(Quotation.supplier),
            selectinload(RFQ.quotations).selectinload(Quotation.approved_by),
            selectinload(RFQ.documents),
            selectinload(RFQ.created_by)
        )
        .filter(RFQ.status == RFQStatus.awarded)
        .order_by(RFQ.created_at.desc())
        .all()
    )
    
    # Filter to only include RFQs where the approved quotation went through finance approval
    result = []
    for rfq in rfqs:
        # Find the approved quotation
        approved_quotation = next(
            (q for q in rfq.quotations if q.status == QuotationStatus.approved),
            None
        )
        
        # Check if this quotation went through finance approval process
        if approved_quotation and approved_quotation.finance_approval_requested_at:
            rfq_dict = RFQWithQuotations.model_validate(rfq).model_dump()
            creator = getattr(rfq, "created_by", None)
            if creator:
                rfq_dict["created_by_name"] = getattr(creator, "full_name", None)
                rfq_dict["created_by_role"] = getattr(creator, "role", None)
            result.append(RFQWithQuotations(**rfq_dict))
    
    return result


@router.get("/purchase-orders", response_model=list[PurchaseOrderRead])
def list_purchase_orders(
    db: Session = Depends(get_db),
    _: User = Depends(require_roles(UserRole.procurement, UserRole.superadmin)),
):
    approved_quotes = (
        db.query(Quotation)
        .options(joinedload(Quotation.supplier), joinedload(Quotation.rfq))
        .filter(Quotation.status == QuotationStatus.approved)
        .order_by(Quotation.approved_at.desc().nullslast(), Quotation.submitted_at.desc())
        .all()
    )

    purchase_orders: list[PurchaseOrderRead] = []
    for quotation in approved_quotes:
        supplier = quotation.supplier
        rfq = quotation.rfq
        reference_date = quotation.approved_at or quotation.submitted_at or datetime.utcnow()
        po_number = f"PO{quotation.id:05d}_{reference_date.strftime('%m%Y')}"
        purchase_orders.append(
            PurchaseOrderRead(
                id=quotation.id,
                po_number=po_number,
                supplier_id=supplier.id if supplier else None,
                supplier_name=supplier.company_name if supplier else None,
                supplier_number=supplier.supplier_number if supplier else None,
                amount=quotation.amount,
                currency=quotation.currency,
                rfq_id=rfq.id if rfq else quotation.rfq_id,
                rfq_number=getattr(rfq, "rfq_number", None) if rfq else None,
                rfq_title=rfq.title if rfq else "RFQ",
                approved_at=quotation.approved_at,
                submitted_at=quotation.submitted_at,
            )
        )

    return purchase_orders


@router.get("/{rfq_id}", response_model=RFQWithQuotations)
def read_rfq(
    rfq_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(UserRole.superadmin, UserRole.procurement, UserRole.procurement_officer, UserRole.requester, UserRole.finance)),
):
    close_expired_rfqs(db)
    rfq = (
        db.query(RFQ)
        .options(
            selectinload(RFQ.quotations).selectinload(Quotation.supplier),
            selectinload(RFQ.documents),
            selectinload(RFQ.created_by)
        )
        .filter(RFQ.id == rfq_id)
        .first()
    )
    if not rfq:
        raise HTTPException(status_code=404, detail="RFQ not found")
    
    # Implement response locking for transparency
    # If RFQ is locked and deadline hasn't passed, hide quotations from procurement
    response_locked = bool(getattr(rfq, "response_locked", False))
    cairo_tz = ZoneInfo("Africa/Cairo")
    current_time = datetime.now(cairo_tz)
    
    # Check if deadline has passed (unlock responses)
    deadline_passed = False
    try:
        rfq_deadline = rfq.deadline
        if rfq_deadline is not None:
            # Ensure deadline is timezone-aware for comparison
            if rfq_deadline.tzinfo is None:
                # If no timezone, assume it's Africa/Cairo time
                rfq_deadline = rfq_deadline.replace(tzinfo=cairo_tz)
            else:
                # Convert to Africa/Cairo for comparison
                rfq_deadline = rfq_deadline.astimezone(cairo_tz)
            deadline_passed = rfq_deadline < current_time
    except (AttributeError, TypeError):
        deadline_passed = False
    
    # If deadline has passed, unlock responses automatically
    if deadline_passed and response_locked:
        setattr(rfq, "response_locked", False)
        db.commit()
        response_locked = False
    
    # Hide quotations if locked and deadline hasn't passed
    if response_locked is True and deadline_passed is False:
        # Create a copy of the RFQ data with empty quotations
        rfq_dict = {
            "id": rfq.id,
            "rfq_number": rfq.rfq_number,
            "title": rfq.title,
            "description": rfq.description,
            "category": rfq.category,
            "budget": rfq.budget,
            "currency": rfq.currency,
            "deadline": rfq.deadline,
            "status": rfq.status,
            "response_locked": False,  # Show as unlocked since deadline passed
            "created_at": rfq.created_at,
            "created_by_id": rfq.created_by_id,
            "documents": rfq.documents,
            "quotations": []  # Hide quotations until deadline
        }
        # Add creator information
        creator = getattr(rfq, "created_by", None)
        if creator:
            rfq_dict["created_by_name"] = getattr(creator, "full_name", None)
            rfq_dict["created_by_role"] = getattr(creator, "role", None)
        return rfq_dict
    
    # Add creator information to response
    rfq_dict = RFQWithQuotations.model_validate(rfq).model_dump()
    creator = getattr(rfq, "created_by", None)
    if creator:
        rfq_dict["created_by_name"] = getattr(creator, "full_name", None)
        rfq_dict["created_by_role"] = getattr(creator, "role", None)
    
    return RFQWithQuotations(**rfq_dict)


@router.put("/{rfq_id}", response_model=RFQRead)
def update_rfq(
    rfq_id: int,
    rfq_in: RFQUpdate,
    db: Session = Depends(get_db),
    _: User = Depends(require_roles(UserRole.procurement, UserRole.superadmin)),
):
    close_expired_rfqs(db)
    rfq = db.query(RFQ).filter(RFQ.id == rfq_id).first()
    if not rfq:
        raise HTTPException(status_code=404, detail="RFQ not found")

    if rfq_in.deadline is not None:
        setattr(rfq, "deadline", _ensure_deadline_in_future(rfq_in.deadline))
    if rfq_in.description is not None:
        setattr(rfq, "description", rfq_in.description)
    if rfq_in.budget is not None:
        setattr(rfq, "budget", rfq_in.budget)
    if rfq_in.status is not None:
        setattr(rfq, "status", RFQStatus(rfq_in.status))
    return rfq


@router.post("/{rfq_id}/quotations", status_code=status.HTTP_201_CREATED)
async def submit_quotation(
    rfq_id: int,
    background_tasks: BackgroundTasks,
    amount: Decimal = Form(...),
    currency: str = Form("USD"),
    tax_type: str | None = Form(None),
    tax_amount: Decimal | None = Form(None),
    notes: str | None = Form(None),
    attachment: UploadFile | None = File(None),
    profile: SupplierProfile = Depends(get_current_supplier_profile),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    close_expired_rfqs(db)
    rfq = db.query(RFQ).filter(RFQ.id == rfq_id).first()
    if not rfq:
        raise HTTPException(status_code=404, detail="RFQ not found")
    rfq_status = getattr(rfq, "status")
    if rfq_status != RFQStatus.open:
        raise HTTPException(status_code=400, detail="RFQ is not open for quotations")

    invitation = (
        db.query(RFQInvitation)
        .filter(
            RFQInvitation.rfq_id == rfq_id,
            RFQInvitation.supplier_id == profile.id,
        )
        .first()
    )
    if not invitation:
        raise HTTPException(status_code=403, detail="Supplier not invited to this RFQ")

    existing_quotation = (
        db.query(Quotation)
        .filter(
            Quotation.rfq_id == rfq_id,
            Quotation.supplier_id == profile.id,
        )
        .first()
    )
    if existing_quotation:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="You have already submitted a quotation for this RFQ.",
        )

    document_path = None
    original_filename = None
    if attachment:
        stored_path = save_upload_file(attachment, subdir=f"rfq_{rfq_id}/quotations")
        # Store relative path from uploads directory for web access
        upload_dir = settings.resolved_upload_dir
        try:
            relative_path = stored_path.relative_to(upload_dir)
            document_path = str(relative_path).replace('\\', '/')  # Normalize path separators
        except ValueError:
            # Fallback to full path if relative_to fails
            document_path = str(stored_path)
        original_filename = attachment.filename

    quotation = Quotation(
        rfq_id=rfq_id,
        supplier_id=profile.id,
        supplier_user_id=current_user.id,
        amount=Decimal(amount),
        currency=currency,
        tax_type=tax_type,
        tax_amount=Decimal(tax_amount) if tax_amount else None,
        notes=notes,
        document_path=document_path,
        original_filename=original_filename,
        status=QuotationStatus.submitted,
    )
    db.add(quotation)
    db.flush()
    setattr(invitation, "responded_at", datetime.now(timezone.utc))
    setattr(invitation, "status", "responded")
    
    # Lock RFQ after first quotation submission to ensure transparency
    # This prevents procurement from viewing responses until deadline
    if not getattr(rfq, "response_locked", False):
        setattr(rfq, "response_locked", True)
    
    db.commit()
    db.refresh(quotation)
    
    # Notify procurement team about new quotation
    procurement_users = db.query(User).filter(
        User.role.in_([UserRole.procurement.value, UserRole.superadmin.value]),
        User.is_active == True
    ).all()
    
    supplier_name = str(getattr(profile, "company_name", ""))
    rfq_title = str(getattr(rfq, "title", ""))
    
    for proc_user in procurement_users:
        proc_email = str(getattr(proc_user, "email"))
        proc_name = str(getattr(proc_user, "full_name", "Procurement Team"))
        html_body = quotation_submitted_email(
            procurement_staff=proc_name,
            supplier_name=supplier_name,
            rfq_title=rfq_title,
        )
        
        plain_body = (
            f"Hello {proc_name},\n\n"
            f"A new quotation has been submitted:\n\n"
            f"Supplier: {supplier_name}\n"
            f"RFQ: {rfq_title}\n\n"
            f"Please log in to review the quotation.\n\n"
            f"Best regards,\nProcuraHub Team"
        )
        
        background_tasks.add_task(
            email_service.send_email,
            [proc_email],
            f"New Quotation - {rfq_title}",
            plain_body,
            html_body,
        )
    
    return {"quotation_id": quotation.id}


@router.post("/{rfq_id}/quotations/{quotation_id}/request-finance-approval")
def request_finance_approval(
    rfq_id: int,
    quotation_id: int,
    budget_override_justification: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(UserRole.procurement, UserRole.superadmin)),
):
    """
    Procurement requests Finance approval for a quotation that exceeds budget.
    """
    close_expired_rfqs(db)
    quotation = (
        db.query(Quotation)
        .filter(Quotation.id == quotation_id, Quotation.rfq_id == rfq_id)
        .first()
    )
    if not quotation:
        raise HTTPException(status_code=404, detail="Quotation not found")
    
    quotation_status = getattr(quotation, "status")
    if quotation_status == QuotationStatus.approved:
        raise HTTPException(status_code=400, detail="Quotation is already approved")
    
    if quotation_status == QuotationStatus.pending_finance_approval:
        raise HTTPException(status_code=400, detail="Finance approval has already been requested")
    
    # Update quotation status and store the justification
    setattr(quotation, "status", QuotationStatus.pending_finance_approval)
    setattr(quotation, "budget_override_justification", budget_override_justification)
    setattr(quotation, "finance_approval_requested_at", datetime.now(timezone.utc))
    setattr(quotation, "finance_approval_requested_by_id", current_user.id)
    
    db.commit()
    
    # TODO: Send email notification to Finance team
    # For now, just return success
    
    return {
        "status": "pending_finance_approval",
        "message": "Finance approval request submitted successfully"
    }


@router.post("/{rfq_id}/quotations/{quotation_id}/approve")
def approve_quotation(
    rfq_id: int,
    quotation_id: int,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(UserRole.finance, UserRole.superadmin, UserRole.procurement)),
    budget_override_justification: str | None = Form(None),
):
    """
    Approve a quotation.
    - Procurement can only approve quotations within budget
    - Finance/SuperAdmin can approve quotations pending finance approval or provide override justification
    """
    close_expired_rfqs(db)
    quotation = (
        db.query(Quotation)
        .filter(Quotation.id == quotation_id, Quotation.rfq_id == rfq_id)
        .first()
    )
    if not quotation:
        raise HTTPException(status_code=404, detail="Quotation not found")
    
    quotation_status = getattr(quotation, "status")
    if quotation_status == QuotationStatus.approved:
        return {"status": "approved"}
    
    # Check if quotation is pending finance approval
    if quotation_status == QuotationStatus.pending_finance_approval:
        # Only Finance and SuperAdmin can approve pending quotations
        if current_user.role not in [UserRole.finance, UserRole.superadmin]:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="This quotation is pending Finance approval. Only Finance or SuperAdmin can approve it."
            )
    # If direct approval (not pending), check if it needs finance approval
    elif budget_override_justification:
        # Only Finance and SuperAdmin can provide budget override
        if current_user.role not in [UserRole.finance, UserRole.superadmin]:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Only Finance or SuperAdmin can approve quotations that exceed the approved budget"
            )

    existing_winner = (
        db.query(Quotation)
        .filter(
            Quotation.rfq_id == rfq_id,
            Quotation.status == QuotationStatus.approved,
            Quotation.id != quotation_id,
        )
        .first()
    )
    if existing_winner:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="RFQ has already been awarded to another quotation",
        )

    rfq = quotation.rfq
    if not rfq:
        raise HTTPException(status_code=404, detail="RFQ not found")

    awarded_at = datetime.now(timezone.utc)
    # Use the amount field for awarded value; total_amount does not exist on the model
    awarded_value = getattr(quotation, "amount")
    currency = str(getattr(quotation, "currency"))
    supplier_profile = quotation.supplier
    supplier_email = str(getattr(supplier_profile, "contact_email", "")) if supplier_profile else None
    supplier_name = str(getattr(supplier_profile, "company_name", "Supplier")) if supplier_profile else "Supplier"

    request_obj = rfq.source_request
    if isinstance(request_obj, list):
        request_obj = request_obj[0] if request_obj else None
    requester_email = None
    requester_name = None
    if request_obj and request_obj.requester:
        requester_email = request_obj.requester.email
        requester_name = request_obj.requester.full_name

    other_quotations = (
        db.query(Quotation)
        .filter(Quotation.rfq_id == rfq_id, Quotation.id != quotation_id)
        .all()
    )
    losing_notifications: list[tuple[str, str]] = []
    for other in other_quotations:
        other_status = getattr(other, "status")
        if other_status != QuotationStatus.rejected:
            setattr(other, "status", QuotationStatus.rejected)
            setattr(other, "approved_at", None)
            setattr(other, "approved_by_id", None)
        if other.supplier and other.supplier.contact_email:
            losing_notifications.append(
                (other.supplier.contact_email, other.supplier.company_name or "Supplier")
            )

    invitations = (
        db.query(RFQInvitation)
        .filter(RFQInvitation.rfq_id == rfq_id)
        .all()
    )
    for invitation in invitations:
        inv_supplier_id = getattr(invitation, "supplier_id")
        quotation_supplier_id = getattr(quotation, "supplier_id")
        if inv_supplier_id == quotation_supplier_id:
            setattr(invitation, "status", "awarded")
            if getattr(invitation, "responded_at") is None:
                setattr(invitation, "responded_at", awarded_at)
        else:
            setattr(invitation, "status", "not_selected")

    setattr(quotation, "status", QuotationStatus.approved)
    setattr(quotation, "approved_at", awarded_at)
    setattr(quotation, "approved_by_id", current_user.id)
    
    # Save the finance approval justification to the quotation for record keeping
    if budget_override_justification:
        # If quotation already has a justification (from when finance approval was requested),
        # append the finance team's justification to it
        existing_justification = getattr(quotation, "budget_override_justification", None)
        if existing_justification:
            combined_justification = f"{existing_justification}\n\n[Finance Approval]: {budget_override_justification}"
            setattr(quotation, "budget_override_justification", combined_justification)
        else:
            setattr(quotation, "budget_override_justification", budget_override_justification)
    
    setattr(rfq, "status", RFQStatus.awarded)
    
    if budget_override_justification:
        setattr(rfq, "budget_override_justification", budget_override_justification)

    if supplier_profile and awarded_value is not None:
        current_total = getattr(supplier_profile, "total_awarded_value") or Decimal("0")
        setattr(supplier_profile, "total_awarded_value", current_total + Decimal(str(awarded_value)))

    if request_obj:
        setattr(request_obj, "status", RequestStatus.completed)

    db.commit()

    # Send approval email to winning supplier
    if supplier_email:
        tax_type = getattr(quotation, "tax_type", None)
        tax_amount = getattr(quotation, "tax_amount", None)
        
        html_body = quotation_approved_email(
            supplier_name=supplier_name,
            rfq_title=str(getattr(rfq, "title")),
            awarded_amount=awarded_value,
            currency=currency,
            tax_type=tax_type,
            tax_amount=tax_amount,
        )
        
        # Build plain text body with tax breakdown
        tax_info = ""
        total_amount = awarded_value
        if tax_type and tax_amount and tax_amount > 0:
            total_amount = awarded_value + tax_amount
            tax_rate = "16%" if tax_type == "VAT" else "5%" if tax_type == "TOT" else ""
            tax_info = f"\nBase amount: {awarded_value:,.2f} {currency}\n{tax_type} ({tax_rate}): {tax_amount:,.2f} {currency}\nTotal amount: {total_amount:,.2f} {currency}"
        else:
            tax_info = f"\nAwarded amount: {awarded_value:,.2f} {currency}"
        
        plain_body = (
            f"Congratulations {supplier_name},\n\n"
            f"Your quotation for RFQ '{getattr(rfq, 'title')}' has been approved."
            f"{tax_info}\n\n"
            f"Our procurement team will be in touch shortly.\n\n"
            f"Best regards,\nProcuraHub Team"
        )
        
        background_tasks.add_task(
            email_service.send_email,
            [supplier_email],
            f"Quotation Approved - {getattr(rfq, 'title')}",
            plain_body,
            html_body,
        )

    # Notify requester
    if requester_email:
        requester_salutation = (
            f"Hello {requester_name}" if requester_name else "Hello"
        )
        
        background_tasks.add_task(
            email_service.send_email,
            [requester_email],
            f"Supplier Awarded - {getattr(rfq, 'title')}",
            (
                f"{requester_salutation},\n\n"
                f"Procurement has awarded RFQ '{getattr(rfq, 'title')}' to {supplier_name}.\n\n"
                "You'll receive follow-up communication with the next steps."
            ),
        )

    # Notify losing suppliers
    for email, name in losing_notifications:
        html_body = quotation_rejected_email(
            supplier_name=name,
            rfq_title=str(getattr(rfq, "title")),
        )
        
        plain_body = (
            f"Hello {name},\n\n"
            f"Thank you for submitting a quotation for RFQ '{getattr(rfq, 'title')}'. "
            "After evaluation, another supplier has been selected for this award.\n\n"
            "We appreciate your participation and encourage you to respond to future invitations.\n\n"
            f"Best regards,\nProcuraHub Team"
        )
        
        background_tasks.add_task(
            email_service.send_email,
            [email],
            f"RFQ Update - {getattr(rfq, 'title')}",
            plain_body,
            html_body,
        )

    # Notify procurement staff about quotation approval/rejection
    procurement_creator = rfq.created_by
    if procurement_creator:
        # Build notification message
        approval_status = "APPROVED" if quotation_status != QuotationStatus.pending_finance_approval else "APPROVED BY FINANCE"
        
        notification_details = (
            f"RFQ: {getattr(rfq, 'title')}\n"
            f"Status: {approval_status}\n"
            f"Winning Supplier: {supplier_name}\n"
            f"Awarded Amount: {awarded_value:,.2f} {currency}\n"
        )
        
        # Add budget override justification if present
        if budget_override_justification:
            notification_details += f"\nBudget Override Justification:\n{budget_override_justification}\n"
        
        # Add information about rejected quotations
        if len(losing_notifications) > 0:
            notification_details += f"\nOther Quotations Rejected: {len(losing_notifications)}"
        
        message = Message(
            sender_id=current_user.id,
            recipient_id=procurement_creator.id,
            supplier_id=None,
            subject=f"Quotation Decision: {getattr(rfq, 'title')}",
            content=notification_details,
            status=MessageStatus.sent,
            created_at=datetime.now(timezone.utc)
        )
        
        db.add(message)
        db.commit()

    return {"status": "approved"}


@router.post("/{rfq_id}/quotations/{quotation_id}/reject")
def reject_quotation(
    rfq_id: int,
    quotation_id: int,
    background_tasks: BackgroundTasks,
    rejection_reason: str | None = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(UserRole.finance, UserRole.superadmin, UserRole.procurement)),
):
    """
    Reject a quotation.
    - Finance/SuperAdmin can reject pending finance approval requests
    - Procurement can reject regular submitted quotations
    """
    quotation = (
        db.query(Quotation)
        .filter(Quotation.id == quotation_id, Quotation.rfq_id == rfq_id)
        .first()
    )
    if not quotation:
        raise HTTPException(status_code=404, detail="Quotation not found")
    
    quotation_status = getattr(quotation, "status")
    
    # If quotation is pending finance approval, only Finance/SuperAdmin can reject
    if quotation_status == QuotationStatus.pending_finance_approval:
        if current_user.role not in [UserRole.finance, UserRole.superadmin]:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Only Finance or SuperAdmin can reject quotations pending finance approval"
            )
    
    # Get RFQ and supplier information before rejection
    rfq = quotation.rfq
    supplier_profile = quotation.supplier
    supplier_email = str(getattr(supplier_profile, "contact_email", "")) if supplier_profile else None
    supplier_name = str(getattr(supplier_profile, "company_name", "Supplier")) if supplier_profile else "Supplier"
    
    setattr(quotation, "status", QuotationStatus.rejected)
    db.commit()
    
    # Send email notification to supplier about rejection
    if supplier_email and rfq:
        html_body = quotation_rejected_email(
            supplier_name=supplier_name,
            rfq_title=str(getattr(rfq, "title")),
        )
        
        plain_body = (
            f"Hello {supplier_name},\n\n"
            f"Your quotation for RFQ '{getattr(rfq, 'title')}' has been reviewed and rejected.\n\n"
            "Thank you for your interest, and we encourage you to respond to future invitations.\n\n"
            f"Best regards,\nProcuraHub Team"
        )
        
        background_tasks.add_task(
            email_service.send_email,
            [supplier_email],
            f"Quotation Decision - {getattr(rfq, 'title')}",
            plain_body,
            html_body,
        )
    
    # Notify procurement staff about rejection
    if rfq:
        procurement_creator = rfq.created_by
        if procurement_creator:
            rejection_reason = f"Quotation from {supplier_name} has been rejected"
            if quotation_status == QuotationStatus.pending_finance_approval:
                rejection_reason += " by Finance"
            else:
                rejection_reason += " due to evaluation"
            
            message = Message(
                sender_id=current_user.id,
                recipient_id=procurement_creator.id,
                supplier_id=None,
                subject=f"Quotation Rejected: {getattr(rfq, 'title')}",
                content=f"RFQ: {getattr(rfq, 'title')}\nSupplier: {supplier_name}\nReason: {rejection_reason}",
                status=MessageStatus.sent,
                created_at=datetime.now(timezone.utc)
            )
            
            db.add(message)
            db.commit()
    
    return {"status": "rejected"}


@router.post("/{rfq_id}/quotations/{quotation_id}/mark-delivered")
async def mark_quotation_delivered(
    rfq_id: int,
    quotation_id: int,
    delivered_at: str = Form(...),
    delivery_note: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(UserRole.procurement, UserRole.superadmin)),
):
    """
    Mark an approved quotation as delivered and upload delivery note.
    - Only Procurement or SuperAdmin can mark deliveries
    - Delivery date must be after the approval date
    - Requires a delivery note document
    """
    quotation = (
        db.query(Quotation)
        .filter(Quotation.id == quotation_id, Quotation.rfq_id == rfq_id)
        .first()
    )
    if not quotation:
        raise HTTPException(status_code=404, detail="Quotation not found")
    
    # Check if quotation is approved
    if getattr(quotation, "status") != QuotationStatus.approved:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Only approved quotations can be marked as delivered"
        )
    
    # Parse delivery date
    try:
        from zoneinfo import ZoneInfo
        cairo_tz = ZoneInfo("Africa/Cairo")
        
        # Handle datetime-local format (YYYY-MM-DDTHH:MM)
        if 'T' in delivered_at and len(delivered_at) == 16:
            # Add seconds if missing
            delivered_at = delivered_at + ':00'
        
        # Parse the datetime
        delivered_datetime = datetime.fromisoformat(delivered_at.replace('Z', '+00:00'))
        
        # If no timezone info, assume Africa/Cairo
        if delivered_datetime.tzinfo is None:
            delivered_datetime = delivered_datetime.replace(tzinfo=cairo_tz)
        else:
            # Convert to Africa/Cairo
            delivered_datetime = delivered_datetime.astimezone(cairo_tz)
            
    except (ValueError, TypeError) as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid delivery date format: {str(e)}"
        )
    
    # Validate delivery date is after approval date
    approved_at = getattr(quotation, "approved_at")
    if approved_at:
        if approved_at.tzinfo is None:
            approved_at = approved_at.replace(tzinfo=cairo_tz)
        if delivered_datetime <= approved_at:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Delivery date must be after the approval date"
            )
    
    # Check if delivery note was provided
    if not delivery_note or not delivery_note.filename:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Delivery note document is required"
        )
    
    # Save delivery note
    from pathlib import Path
    settings = get_settings()
    
    # Use resolved_upload_dir which is guaranteed to be a Path object
    base_upload_dir = settings.resolved_upload_dir
    upload_dir = base_upload_dir / f"rfq_{rfq_id}" / "delivery_notes"
    upload_dir.mkdir(parents=True, exist_ok=True)
    
    file_extension = Path(delivery_note.filename).suffix
    safe_filename = f"delivery_note_{quotation_id}_{int(delivered_datetime.timestamp())}{file_extension}"
    file_path = upload_dir / safe_filename
    
    # Save the file
    content = await delivery_note.read()
    with open(file_path, "wb") as f:
        f.write(content)
    
    # Update quotation with delivery information
    setattr(quotation, "delivery_status", "delivered")
    setattr(quotation, "delivered_at", delivered_datetime)
    setattr(quotation, "delivery_note_path", str(file_path))
    setattr(quotation, "delivery_note_filename", delivery_note.filename)
    setattr(quotation, "marked_delivered_by_id", current_user.id)
    
    db.commit()
    
    return {
        "status": "delivered",
        "delivered_at": delivered_datetime.isoformat(),
        "delivery_note_filename": delivery_note.filename
    }


@router.get("/{rfq_id}/documents/{document_id}/download")
def download_rfq_document(
    rfq_id: int,
    document_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """Download an RFQ document. Accessible to suppliers with invitations and staff."""
    # Check if document exists and belongs to the RFQ
    document = (
        db.query(RFQDocument)
        .filter(RFQDocument.id == document_id, RFQDocument.rfq_id == rfq_id)
        .first()
    )
    if not document:
        raise HTTPException(status_code=404, detail="Document not found")
    
    # Check access permissions
    user_role = current_user.role
    if user_role in [UserRole.procurement, UserRole.procurement_officer, UserRole.superadmin, UserRole.finance, UserRole.requester]:
        # Staff can access any RFQ document
        pass
    elif user_role == UserRole.supplier:
        # Suppliers can only access documents for RFQs they were invited to
        # Query the supplier profile for this user
        supplier_profile = (
            db.query(SupplierProfile)
            .filter(SupplierProfile.user_id == current_user.id)
            .first()
        )
        if not supplier_profile:
            raise HTTPException(status_code=403, detail="Supplier profile not found")
        
        invitation = (
            db.query(RFQInvitation)
            .filter(
                RFQInvitation.rfq_id == rfq_id,
                RFQInvitation.supplier_id == supplier_profile.id
            )
            .first()
        )
        if not invitation:
            raise HTTPException(status_code=403, detail="You don't have access to this RFQ")
    else:
        raise HTTPException(status_code=403, detail="Access denied")
    
    # Construct file path
    upload_dir = settings.resolved_upload_dir
    file_path = upload_dir / getattr(document, "file_path")
    
    if not file_path.exists():
        raise HTTPException(status_code=404, detail="File not found on disk")
    
    return FileResponse(
        path=file_path,
        filename=getattr(document, "original_filename"),
        media_type="application/octet-stream"
    )


@router.get("/{rfq_id}/quotations/{quotation_id}/delivery-note/download")
def download_delivery_note(
    rfq_id: int,
    quotation_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(UserRole.procurement, UserRole.superadmin, UserRole.finance)),
):
    """Download the delivery note for a delivered quotation."""
    quotation = (
        db.query(Quotation)
        .filter(Quotation.id == quotation_id, Quotation.rfq_id == rfq_id)
        .first()
    )
    if not quotation:
        raise HTTPException(status_code=404, detail="Quotation not found")
    
    delivery_note_path = getattr(quotation, "delivery_note_path")
    delivery_note_filename = getattr(quotation, "delivery_note_filename")
    
    if not delivery_note_path:
        raise HTTPException(status_code=404, detail="No delivery note found for this quotation")
    
    from pathlib import Path
    file_path = Path(delivery_note_path)
    
    if not file_path.exists():
        raise HTTPException(status_code=404, detail="Delivery note file not found on disk")
    
    return FileResponse(
        path=file_path,
        filename=delivery_note_filename or "delivery_note.pdf",
        media_type="application/octet-stream"
    )


@router.get("/{rfq_id}/quotations/{quotation_id}/download")
def download_quotation(
    rfq_id: int,
    quotation_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(UserRole.procurement, UserRole.superadmin, UserRole.finance)),
):
    """Download the quotation document."""
    quotation = (
        db.query(Quotation)
        .filter(Quotation.id == quotation_id, Quotation.rfq_id == rfq_id)
        .first()
    )
    if not quotation:
        raise HTTPException(status_code=404, detail="Quotation not found")
    
    document_path = getattr(quotation, "document_path")
    original_filename = getattr(quotation, "original_filename")
    
    if not document_path:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, 
            detail="This quotation does not have an attached document"
        )
    
    from pathlib import Path
    # Use resolved_upload_dir like RFQ documents do
    upload_dir = settings.resolved_upload_dir
    file_path = upload_dir / document_path
    
    if not file_path.exists():
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Quotation file not found on disk: {document_path}"
        )
    
    return FileResponse(
        path=file_path,
        filename=original_filename or "quotation.pdf",
        media_type="application/octet-stream"
    )


@router.get("/{rfq_id}/quotations/{quotation_id}/purchase-order")
def download_purchase_order(
    rfq_id: int,
    quotation_id: int,
    db: Session = Depends(get_db),
    profile: SupplierProfile = Depends(get_current_supplier_profile),
):
    """
    Download Purchase Order PDF for approved quotation.
    Only the awarded supplier can download their PO.
    """
    # Get quotation
    quotation = (
        db.query(Quotation)
        .filter(
            Quotation.id == quotation_id,
            Quotation.rfq_id == rfq_id
        )
        .first()
    )
    
    if not quotation:
        raise HTTPException(status_code=404, detail="Quotation not found")
    
    # Verify supplier owns this quotation
    if getattr(quotation, "supplier_id") != profile.id:
        raise HTTPException(
            status_code=403,
            detail="You can only download your own purchase orders"
        )
    
    # Verify quotation is approved
    if getattr(quotation, "status") != QuotationStatus.approved:
        raise HTTPException(
            status_code=400,
            detail="Purchase order is only available for approved quotations"
        )
    
    # Get RFQ
    rfq = db.query(RFQ).filter(RFQ.id == rfq_id).first()
    if not rfq:
        raise HTTPException(status_code=404, detail="RFQ not found")
    
    # Get company settings
    company_settings = db.query(CompanySettings).first()
    if not company_settings:
        # Create default if not exists
        company_settings = CompanySettings(
            company_name="ProcuraHub",
            email="info@procurahub.com"
        )
        db.add(company_settings)
        db.commit()
        db.refresh(company_settings)
    
    # Generate PDF
    try:
        pdf_bytes = generate_purchase_order_pdf(
            rfq=rfq,
            quotation=quotation,
            supplier=profile,
            company_settings=company_settings
        )
        
        # Return PDF as response
        rfq_title = getattr(rfq, "title", "PO").replace(" ", "_")
        filename = f"PO_{rfq_title}_{quotation_id}.pdf"
        
        return Response(
            content=pdf_bytes,
            media_type="application/pdf",
            headers={
                "Content-Disposition": f'attachment; filename="{filename}"'
            }
        )
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to generate purchase order: {str(e)}"
        )

