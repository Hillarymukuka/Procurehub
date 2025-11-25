"""Requester workflow endpoints for purchase requests."""

import logging
from datetime import datetime, timezone
from decimal import Decimal
from typing import List, Optional, cast

from fastapi import APIRouter, BackgroundTasks, Depends, File, HTTPException, Request, UploadFile, status
from fastapi.responses import FileResponse
from slowapi import Limiter
from slowapi.util import get_remote_address
from sqlalchemy.orm import Session

from ..database import get_db
from ..dependencies import get_current_active_user, require_roles
from ..models import (
    Department,
    ProcurementCategory,
    PurchaseRequest,
    RequestStatus,
    RequestDocument,
    RFQ,
    RFQStatus,
    SupplierProfile,
    User,
    UserRole,
)
from ..schemas.category import CategoryRead
from ..schemas.department import DepartmentRead
from ..schemas.request import (
    RequestCreate,
    RequestDenial,
    RequestDocumentRead,
    RequestFinanceApproval,
    RequestFinanceRejection,
    RequestHODReview,
    RequestHODRejection,
    RequestProcurementReview,
    RequestResponse,
    RequestStatusEnum,
    RequestSupplierInvite,
    RequestUpdate,
)
from ..services.rfq import create_invitations, generate_rfq_number
from ..services.email import email_service
from ..services.email_templates import (
    purchase_request_submitted_email,
    purchase_request_approved_procurement_email,
    purchase_request_approved_finance_email,
    purchase_request_rejected_email,
    new_request_for_procurement_email,
    new_request_for_finance_email,
)
from ..services.file_storage import save_upload_file
from ..config import get_settings

router = APIRouter(tags=["requests"])
logger = logging.getLogger("procurahub.requests")
settings = get_settings()
limiter = Limiter(key_func=get_remote_address)

def _user_role(user: User) -> UserRole:
    return cast(UserRole, user.role)


def _request_status(request: PurchaseRequest) -> RequestStatus:
    return cast(RequestStatus, request.status)


def _requester_id(request: PurchaseRequest) -> Optional[int]:
    return cast(Optional[int], request.requester_id)


def _build_request_response(
    request: PurchaseRequest, *, include_documents: bool = True
) -> RequestResponse:
    documents: List[RequestDocumentRead] = []
    if include_documents:
        documents = [
            RequestDocumentRead(
                id=cast(int, document.id),
                original_filename=cast(str, document.original_filename),
                file_path=cast(str, document.file_path),
                uploaded_at=cast(datetime, document.uploaded_at),
            )
            for document in request.documents
        ]

    proposed_amount = request.proposed_budget_amount
    if request.procurement_reviewer_id is None and (
        proposed_amount is None or (isinstance(proposed_amount, Decimal) and proposed_amount == 0)
    ):
        proposed_amount = None
    finance_amount = request.finance_budget_amount
    if request.finance_reviewer_id is None:
        finance_amount = None

    return RequestResponse(
        id=cast(int, request.id),
        title=cast(str, request.title),
        description=cast(str, request.description),
        justification=cast(str, request.justification),
        category=cast(str, request.category),
        department_id=cast(int, request.department_id) if request.department_id is not None else None,
        department_name=request.department.name if request.department else None,
        needed_by=cast(datetime, request.needed_by),
        status=RequestStatusEnum(request.status.value),
        hod_notes=cast(str, request.hod_notes) if hasattr(request, 'hod_notes') and request.hod_notes is not None else None,
        hod_rejection_reason=request.hod_rejection_reason if hasattr(request, 'hod_rejection_reason') else None,
        hod_reviewer_id=cast(int, request.hod_reviewer_id) if hasattr(request, 'hod_reviewer_id') and request.hod_reviewer_id is not None else None,
        hod_reviewer_name=request.hod_reviewer.full_name if hasattr(request, 'hod_reviewer') and request.hod_reviewer else None,
        hod_reviewed_at=cast(datetime, request.hod_reviewed_at) if hasattr(request, 'hod_reviewed_at') and request.hod_reviewed_at is not None else None,
        procurement_notes=cast(str, request.procurement_notes) if request.procurement_notes is not None else None,
        finance_notes=cast(str, request.finance_notes) if request.finance_notes is not None else None,
        requester_id=_requester_id(request),
        requester_name=request.requester.full_name if request.requester else None,
        procurement_reviewer_id=cast(int, request.procurement_reviewer_id)
        if request.procurement_reviewer_id is not None
        else None,
        procurement_reviewer_name=request.procurement_reviewer.full_name if request.procurement_reviewer else None,
        procurement_reviewed_at=cast(datetime, request.procurement_reviewed_at)
        if request.procurement_reviewed_at is not None
        else None,
        finance_reviewer_id=cast(int, request.finance_reviewer_id) if request.finance_reviewer_id is not None else None,
        finance_reviewer_name=request.finance_reviewer.full_name if request.finance_reviewer else None,
        finance_reviewed_at=cast(datetime, request.finance_reviewed_at)
        if request.finance_reviewed_at is not None
        else None,
        proposed_budget_amount=cast(Decimal, proposed_amount) if proposed_amount is not None else None,
        proposed_budget_currency=cast(str, request.proposed_budget_currency)
        if request.proposed_budget_currency is not None
        else None,
        finance_budget_amount=cast(Decimal, finance_amount)
        if finance_amount is not None
        else None,
        finance_budget_currency=cast(str, request.finance_budget_currency)
        if request.finance_budget_currency is not None
        else None,
        procurement_rejection_reason=request.procurement_rejection_reason,
        finance_rejection_reason=request.finance_rejection_reason,
        budget=cast(Decimal, proposed_amount) if proposed_amount is not None else None,
        currency=cast(str, request.proposed_budget_currency)
        if request.proposed_budget_currency is not None
        else None,
        approved_by_id=cast(int, request.procurement_reviewer_id)
        if request.procurement_reviewer_id is not None
        else None,
        approved_by_name=request.procurement_reviewer.full_name if request.procurement_reviewer else None,
        approved_at=cast(datetime, request.procurement_reviewed_at)
        if request.procurement_reviewed_at is not None
        else None,
        created_at=cast(datetime, request.created_at),
        updated_at=cast(datetime, request.updated_at) if request.updated_at is not None else None,
        rfq_id=cast(int, request.rfq_id) if request.rfq_id is not None else None,
        rfq_title=request.rfq.title if request.rfq else None,
        rfq_number=request.rfq.rfq_number if request.rfq else None,
        rfq_invited_at=cast(datetime, request.rfq_invited_at)
        if request.rfq_invited_at is not None
        else None,
        documents=documents,
    )


def _ensure_user_may_modify_documents(request: PurchaseRequest, user: User) -> None:
    role = _user_role(user)
    if role == UserRole.requester:
        if _requester_id(request) != user.id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Not authorized to update documents for this request",
            )
        return

    if role not in {UserRole.procurement, UserRole.superadmin, UserRole.finance}:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized to update documents for this request",
        )


def _apply_updates(request: PurchaseRequest, data: RequestUpdate) -> None:
    if data.title is not None:
        setattr(request, "title", data.title)
    if data.description is not None:
        setattr(request, "description", data.description)
    if data.justification is not None:
        setattr(request, "justification", data.justification)
    if data.category is not None:
        setattr(request, "category", data.category)
    if data.department_id is not None:
        setattr(request, "department_id", data.department_id)
    if data.needed_by is not None:
        setattr(request, "needed_by", data.needed_by)
    if data.procurement_notes is not None:
        setattr(request, "procurement_notes", data.procurement_notes)


@router.get("/categories", response_model=list[CategoryRead])
def list_request_categories(
    db: Session = Depends(get_db),
    _: User = Depends(get_current_active_user),
) -> list[ProcurementCategory]:
    """Return procurement categories for requesters."""
    categories = db.query(ProcurementCategory).order_by(ProcurementCategory.name.asc()).all()
    return categories


@router.get("/departments", response_model=list[DepartmentRead])
def list_departments(
    db: Session = Depends(get_db),
    _: User = Depends(get_current_active_user),
) -> list[Department]:
    """Return departments for requesters."""
    departments = db.query(Department).order_by(Department.name.asc()).all()
    return departments


@router.post("/", response_model=RequestResponse, status_code=status.HTTP_201_CREATED)
@limiter.limit("30/hour")  # Rate limit request creation to prevent spam
def create_request(
    request: Request,
    request_in: RequestCreate,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(UserRole.requester, UserRole.superadmin)),
):
    department = db.query(Department).filter(Department.id == request_in.department_id).first()
    if not department:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Department not found")

    request_obj = PurchaseRequest(
        title=request_in.title,
        description=request_in.description,
        justification=request_in.justification,
        category=request_in.category,
        department_id=request_in.department_id,
        needed_by=request_in.needed_by,
        requester_id=current_user.id,
        proposed_budget_amount=Decimal("0"),
        proposed_budget_currency="ZMW",
        status=RequestStatus.pending_hod,  # Request goes to HOD first
    )
    db.add(request_obj)
    db.commit()
    db.refresh(request_obj)
    
    # Send confirmation email to requester
    requester_name = str(getattr(current_user, "full_name", ""))
    requester_email = str(getattr(current_user, "email"))
    
    html_body = purchase_request_submitted_email(
        requester_name=requester_name,
        request_title=request_in.title,
        category=request_in.category,
        estimated_value=None,  # Not provided at submission
        currency="ZMW",
        justification=request_in.justification or "N/A",
    )
    
    plain_body = (
        f"Hello {requester_name},\n\n"
        f"Your purchase request '{request_in.title}' has been successfully submitted "
        f"and is now under review by your Head of Department.\n\n"
        f"Category: {request_in.category}\n"
        f"Justification: {request_in.justification}\n\n"
        f"You will receive updates as your request moves through the approval process.\n\n"
        f"Best regards,\nProcuraHub Team"
    )
    
    # Send email in background to avoid blocking the response
    background_tasks.add_task(
        email_service.send_email,
        [requester_email],
        f"Request Submitted - {request_in.title}",
        plain_body,
        html_body,
    )
    
    # Notify Head of Department for the selected department
    if department.head_of_department_id:
        hod = db.query(User).filter(User.id == department.head_of_department_id).first()
        if hod and getattr(hod, "email"):
            hod_email = str(getattr(hod, "email"))
            hod_name = str(getattr(hod, "full_name", "Head of Department"))
            
            plain_body_hod = (
                f"Hello {hod_name},\n\n"
                f"A new purchase request requires your review and approval.\n\n"
                f"Request Title: {request_in.title}\n"
                f"Requested by: {requester_name}\n"
                f"Department: {department.name}\n"
                f"Category: {request_in.category}\n"
                f"Needed by: {request_in.needed_by.strftime('%Y-%m-%d')}\n\n"
                f"Description: {request_in.description}\n\n"
                f"Justification: {request_in.justification}\n\n"
                f"Please log in to review and approve or reject this request.\n\n"
                f"Best regards,\nProcuraHub Team"
            )
            
            # Send HOD notification in background
            background_tasks.add_task(
                email_service.send_email,
                [hod_email],
                f"New Request for Review - {request_in.title}",
                plain_body_hod,
                None,
            )
    
    return _build_request_response(request_obj)


@router.get("/me", response_model=list[RequestResponse])
def list_my_requests(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(UserRole.requester, UserRole.superadmin)),
):
    query = db.query(PurchaseRequest).order_by(PurchaseRequest.created_at.desc())
    if _user_role(current_user) == UserRole.requester:
        query = query.filter(PurchaseRequest.requester_id == current_user.id)
    requests = query.all()
    return [_build_request_response(req) for req in requests]


@router.get("/", response_model=list[RequestResponse])
def list_requests(
    db: Session = Depends(get_db),
    current_user: User = Depends(
        require_roles(UserRole.procurement, UserRole.procurement_officer, UserRole.head_of_department, UserRole.superadmin, UserRole.finance)
    ),
):
    """List requests based on user role. HOD sees only their department's requests."""
    user_role = _user_role(current_user)
    
    # HOD sees only requests from their department(s)
    if user_role == UserRole.head_of_department:
        # Find all departments where this user is HOD
        departments = db.query(Department).filter(Department.head_of_department_id == current_user.id).all()
        dept_ids = [dept.id for dept in departments]
        
        if not dept_ids:
            return []  # HOD not assigned to any department
        
        requests = (
            db.query(PurchaseRequest)
            .filter(PurchaseRequest.department_id.in_(dept_ids))
            .order_by(PurchaseRequest.created_at.desc())
            .all()
        )
        return [_build_request_response(req) for req in requests]
    
    # Procurement and SuperAdmin see all requests
    requests = (
        db.query(PurchaseRequest)
        .order_by(PurchaseRequest.created_at.desc())
        .all()
    )
    include_documents = user_role != UserRole.finance
    return [_build_request_response(req, include_documents=include_documents) for req in requests]


@router.get("/{request_id}", response_model=RequestResponse)
def get_request(
    request_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    request_obj = db.query(PurchaseRequest).filter(PurchaseRequest.id == request_id).first()
    if not request_obj:
        raise HTTPException(status_code=404, detail="Request not found")

    user_role = _user_role(current_user)
    
    # Requester can only see their own requests
    if user_role == UserRole.requester and _requester_id(request_obj) != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized to access this request")
    
    # HOD can only see requests from their department(s)
    if user_role == UserRole.head_of_department:
        department = db.query(Department).filter(Department.id == request_obj.department_id).first()
        if not department or department.head_of_department_id != current_user.id:
            raise HTTPException(status_code=403, detail="Not authorized to access this request")
    
    # Procurement, SuperAdmin, and Finance can see all requests
    if user_role not in {UserRole.procurement, UserRole.superadmin, UserRole.finance, UserRole.requester, UserRole.head_of_department}:
        raise HTTPException(status_code=403, detail="Not authorized to access this request")

    include_documents = user_role != UserRole.finance
    return _build_request_response(request_obj, include_documents=include_documents)


@router.put("/{request_id}", response_model=RequestResponse)
def update_request(
    request_id: int,
    update_in: RequestUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    request_obj = db.query(PurchaseRequest).filter(PurchaseRequest.id == request_id).first()
    if not request_obj:
        raise HTTPException(status_code=404, detail="Request not found")

    if _user_role(current_user) == UserRole.requester:
        if _requester_id(request_obj) != current_user.id or _request_status(request_obj) not in {RequestStatus.pending_hod, RequestStatus.pending_procurement}:
            raise HTTPException(status_code=403, detail="Requesters can only update requests awaiting review")
    elif _user_role(current_user) == UserRole.head_of_department:
        # HOD can update requests in their department that are pending_hod
        if _request_status(request_obj) != RequestStatus.pending_hod:
            raise HTTPException(status_code=403, detail="HOD can only update requests pending HOD review")
        department = db.query(Department).filter(Department.id == request_obj.department_id).first()
        if not department or department.head_of_department_id != current_user.id:
            raise HTTPException(status_code=403, detail="Not authorized to update this request")
    elif _user_role(current_user) not in {UserRole.procurement, UserRole.superadmin}:
        raise HTTPException(status_code=403, detail="Not authorized to update this request")
    elif _user_role(current_user) == UserRole.procurement and _request_status(request_obj) != RequestStatus.pending_procurement:
        raise HTTPException(status_code=403, detail="Procurement can only update requests under procurement review")

    if update_in.department_id is not None:
        department = db.query(Department).filter(Department.id == update_in.department_id).first()
        if not department:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Department not found")

    _apply_updates(request_obj, update_in)
    db.commit()
    db.refresh(request_obj)
    return _build_request_response(request_obj)


@router.put("/{request_id}/hod-approve", response_model=RequestResponse)
def hod_approve_request(
    request_id: int,
    approval_in: RequestHODReview,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(UserRole.head_of_department, UserRole.superadmin)),
):
    """Head of Department approval that forwards the request to procurement."""
    try:
        request_obj = _get_request_or_404(db, request_id)
        
        # Verify request is in pending_hod status
        if _request_status(request_obj) != RequestStatus.pending_hod:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Only requests awaiting HOD review can be approved"
            )
        
        # Verify HOD is assigned to this department or is SuperAdmin
        if current_user.role != UserRole.superadmin:
            department = db.query(Department).filter(Department.id == request_obj.department_id).first()
            if not department or department.head_of_department_id != current_user.id:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="You are not the Head of Department for this request's department"
                )
        
        # Apply any updates provided by HOD
        if approval_in.department_id is not None:
            department = db.query(Department).filter(Department.id == approval_in.department_id).first()
            if not department:
                raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Department not found")
        
        update_data = RequestUpdate(
            title=approval_in.title,
            description=approval_in.description,
            justification=approval_in.justification,
            category=approval_in.category,
            department_id=approval_in.department_id,
            needed_by=approval_in.needed_by,
            procurement_notes=None,  # HOD doesn't set procurement notes
        )
        _apply_updates(request_obj, update_data)
        
        # Update HOD review fields
        request_obj.hod_notes = approval_in.hod_notes
        request_obj.hod_reviewer_id = current_user.id
        request_obj.hod_reviewed_at = datetime.utcnow()
        request_obj.status = RequestStatus.pending_procurement  # Move to procurement
        request_obj.hod_rejection_reason = None
        
        db.commit()
        db.refresh(request_obj)
        
        # Send email to requester
        if request_obj.requester and getattr(request_obj.requester, "email"):
            requester_name = str(getattr(request_obj.requester, "full_name", ""))
            requester_email = str(getattr(request_obj.requester, "email"))
            approved_by_name = str(getattr(current_user, "full_name", "Head of Department"))
            
            plain_body = (
                f"Hello {requester_name},\n\n"
                f"Your purchase request '{getattr(request_obj, 'title')}' has been approved by your Head of Department "
                f"and is now with the Procurement team for review.\n\n"
                f"Approved by: {approved_by_name}\n"
            )
            if approval_in.hod_notes:
                plain_body += f"Notes: {approval_in.hod_notes}\n\n"
            plain_body += "Best regards,\nProcuraHub Team"
            
            # Send requester notification in background
            background_tasks.add_task(
                email_service.send_email,
                [requester_email],
                f"HOD Approved - {getattr(request_obj, 'title')}",
                plain_body,
                None,
            )
        
        # Notify procurement team
        procurement_users = db.query(User).filter(
            User.role.in_([UserRole.procurement.value, UserRole.superadmin.value]),
            User.is_active == True
        ).all()
        
        requester_name = str(getattr(request_obj.requester, "full_name", "")) if request_obj.requester else ""
        
        for proc_user in procurement_users:
            proc_email = str(getattr(proc_user, "email"))
            plain_body_proc = (
                f"Procurement Team,\n\n"
                f"A purchase request has been approved by the Head of Department and requires your review.\n\n"
                f"Request: {getattr(request_obj, 'title')}\n"
                f"Requested by: {requester_name}\n"
                f"Department: {request_obj.department.name if request_obj.department else 'N/A'}\n"
            )
            if approval_in.hod_notes:
                plain_body_proc += f"HOD Notes: {approval_in.hod_notes}\n"
            plain_body_proc += "\nPlease log in to review and process this request.\n\nBest regards,\nProcuraHub Team"
            
            # Send procurement notification in background
            background_tasks.add_task(
                email_service.send_email,
                [proc_email],
                f"New Request for Review - {getattr(request_obj, 'title')}",
                plain_body_proc,
                None,
            )
        
        return _build_request_response(request_obj)
    except HTTPException:
        db.rollback()
        raise
    except Exception as exc:
        db.rollback()
        logger.exception("Failed to HOD-approve request %s", request_id)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Unable to approve request at this time. Please try again later.",
        ) from exc


@router.put("/{request_id}/hod-reject", response_model=RequestResponse)
def hod_reject_request(
    request_id: int,
    rejection_in: RequestHODRejection,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(UserRole.head_of_department, UserRole.superadmin)),
):
    """Head of Department rejection of a request."""
    try:
        request_obj = _get_request_or_404(db, request_id)
        
        # Verify request is in pending_hod status
        if _request_status(request_obj) != RequestStatus.pending_hod:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Only requests awaiting HOD review can be rejected"
            )
        
        # Verify HOD is assigned to this department or is SuperAdmin
        if current_user.role != UserRole.superadmin:
            department = db.query(Department).filter(Department.id == request_obj.department_id).first()
            if not department or department.head_of_department_id != current_user.id:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="You are not the Head of Department for this request's department"
                )
        
        request_obj.status = RequestStatus.rejected_by_hod
        request_obj.hod_reviewer_id = current_user.id
        request_obj.hod_reviewed_at = datetime.utcnow()
        request_obj.hod_rejection_reason = rejection_in.reason
        request_obj.hod_notes = rejection_in.hod_notes or rejection_in.reason
        
        db.commit()
        db.refresh(request_obj)
        
        # Send email to requester
        if request_obj.requester and getattr(request_obj.requester, "email"):
            requester_name = str(getattr(request_obj.requester, "full_name", ""))
            requester_email = str(getattr(request_obj.requester, "email"))
            rejected_by_name = str(getattr(current_user, "full_name", "Head of Department"))
            reason = rejection_in.reason or "No reason provided"
            
            plain_body = (
                f"Hello {requester_name},\n\n"
                f"Your purchase request '{getattr(request_obj, 'title')}' has been reviewed by your Head of Department "
                f"and has not been approved.\n\n"
                f"Rejected by: {rejected_by_name}\n"
                f"Reason: {reason}\n\n"
                f"Please review the feedback and resubmit if necessary.\n\n"
                f"Best regards,\nProcuraHub Team"
            )
            
            email_service.send_email(
                [requester_email],
                subject=f"Request Not Approved - {getattr(request_obj, 'title')}",
                body=plain_body,
                html_body=None,
            )
        
        return _build_request_response(request_obj)
    except HTTPException:
        db.rollback()
        raise
    except Exception as exc:
        db.rollback()
        logger.exception("Failed to HOD-reject request %s", request_id)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Unable to reject request at this time. Please try again later.",
        ) from exc


@router.put("/{request_id}/approve", response_model=RequestResponse)
def approve_request(
    request_id: int,
    approval_in: RequestProcurementReview,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(UserRole.procurement, UserRole.superadmin)),
):
    """Procurement approval - sets budget and marks ready for RFQ creation."""
    try:
        request_obj = _get_request_or_404(db, request_id)
        if _request_status(request_obj) != RequestStatus.pending_procurement:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST, detail="Only requests awaiting procurement review can be approved"
            )

        if approval_in.department_id is not None:
            department = db.query(Department).filter(Department.id == approval_in.department_id).first()
            if not department:
                raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Department not found")

        update_data = RequestUpdate(
            title=approval_in.title,
            description=approval_in.description,
            justification=approval_in.justification,
            category=approval_in.category,
            department_id=approval_in.department_id,
            needed_by=approval_in.needed_by,
            procurement_notes=approval_in.procurement_notes,
        )
        _apply_updates(request_obj, update_data)

        request_obj.proposed_budget_amount = Decimal(approval_in.budget_amount)
        request_obj.proposed_budget_currency = approval_in.budget_currency
        request_obj.procurement_notes = approval_in.procurement_notes
        request_obj.procurement_reviewer_id = current_user.id
        request_obj.procurement_reviewed_at = datetime.utcnow()
        request_obj.status = RequestStatus.rfq_issued  # Ready for RFQ creation (no finance approval needed)
        request_obj.procurement_rejection_reason = None

        db.commit()
        db.refresh(request_obj)

        # Send email to requester
        if request_obj.requester and getattr(request_obj.requester, "email"):
            requester_name = str(getattr(request_obj.requester, "full_name", ""))
            requester_email = str(getattr(request_obj.requester, "email"))
            approved_by_name = str(getattr(current_user, "full_name", "Procurement Team"))
            
            plain_body = (
                f"Hello {requester_name},\n\n"
                f"Your purchase request '{getattr(request_obj, 'title')}' has been approved by procurement "
                f"and is ready for RFQ processing.\n\n"
                f"Approved by: {approved_by_name}\n\n"
                f"The procurement team will now create an RFQ and invite suppliers.\n\n"
                f"Best regards,\nProcuraHub Team"
            )
            
            email_service.send_email(
                [requester_email],
                subject=f"Request Approved - {getattr(request_obj, 'title')}",
                body=plain_body,
                html_body=None,
            )
        
        # Send email to HOD if request has a department with assigned HOD
        if request_obj.department_id:
            department = db.query(Department).filter(Department.id == request_obj.department_id).first()
            if department and department.head_of_department:
                hod = department.head_of_department
                hod_name = str(getattr(hod, "full_name", ""))
                hod_email = str(getattr(hod, "email"))
                approved_by_name = str(getattr(current_user, "full_name", "Procurement Team"))
                
                plain_body = (
                    f"Hello {hod_name},\n\n"
                    f"A purchase request from your department has been approved by procurement.\n\n"
                    f"Request: {getattr(request_obj, 'title')}\n"
                    f"Requester: {getattr(request_obj.requester, 'full_name', 'N/A')}\n"
                    f"Approved by: {approved_by_name}\n\n"
                    f"The procurement team will now create an RFQ and invite suppliers.\n\n"
                    f"Best regards,\nProcuraHub Team"
                )
                
                email_service.send_email(
                    [hod_email],
                    subject=f"Department Request Approved - {getattr(request_obj, 'title')}",
                    body=plain_body,
                    html_body=None,
                )

        return _build_request_response(request_obj)
    except HTTPException:
        db.rollback()
        raise
    except Exception as exc:  # pragma: no cover - defensive logging
        db.rollback()
        logger.exception("Failed to approve request %s", request_id)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Unable to approve request at this time. Please try again later.",
        ) from exc


@router.put("/{request_id}/deny", response_model=RequestResponse)
def deny_request(
    request_id: int,
    denial_in: RequestDenial,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(UserRole.procurement, UserRole.superadmin)),
):
    try:
        request_obj = _get_request_or_404(db, request_id)
        if _request_status(request_obj) != RequestStatus.pending_procurement:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST, detail="Only requests awaiting procurement review can be rejected"
            )

        request_obj.status = RequestStatus.rejected_by_procurement
        request_obj.procurement_reviewer_id = current_user.id
        request_obj.procurement_reviewed_at = datetime.utcnow()
        request_obj.procurement_rejection_reason = denial_in.reason
        request_obj.procurement_notes = denial_in.reason

        db.commit()
        db.refresh(request_obj)

        # Send email to requester
        if request_obj.requester and getattr(request_obj.requester, "email"):
            requester_name = str(getattr(request_obj.requester, "full_name", ""))
            requester_email = str(getattr(request_obj.requester, "email"))
            rejected_by_name = str(getattr(current_user, "full_name", "Procurement Team"))
            reason = denial_in.reason or "No reason provided"
            
            html_body = purchase_request_rejected_email(
                requester_name=requester_name,
                request_title=str(getattr(request_obj, "title")),
                rejected_by=rejected_by_name,
                rejected_by_dept="Procurement",
                reason=reason,
            )
            
            plain_body = (
                f"Hello {requester_name},\n\n"
                f"Your purchase request '{getattr(request_obj, 'title')}' has been reviewed by procurement "
                f"and has not been approved.\n\n"
                f"Rejected by: {rejected_by_name}\n"
                f"Reason: {reason}\n\n"
                f"Please review the feedback and update your request if you plan to resubmit.\n\n"
                f"Best regards,\nProcuraHub Team"
            )
            
            email_service.send_email(
                [requester_email],
                subject=f"Request Rejected by Procurement - {getattr(request_obj, 'title')}",
                body=plain_body,
                html_body=html_body,
            )
        
        # Send email to HOD if request has a department with assigned HOD
        if request_obj.department_id:
            department = db.query(Department).filter(Department.id == request_obj.department_id).first()
            if department and department.head_of_department:
                hod = department.head_of_department
                hod_name = str(getattr(hod, "full_name", ""))
                hod_email = str(getattr(hod, "email"))
                rejected_by_name = str(getattr(current_user, "full_name", "Procurement Team"))
                reason = denial_in.reason or "No reason provided"
                
                plain_body_hod = (
                    f"Hello {hod_name},\n\n"
                    f"A purchase request from your department has been rejected by procurement.\n\n"
                    f"Request: {getattr(request_obj, 'title')}\n"
                    f"Requester: {getattr(request_obj.requester, 'full_name', 'N/A')}\n"
                    f"Rejected by: {rejected_by_name}\n"
                    f"Reason: {reason}\n\n"
                    f"The requester has been notified of this decision.\n\n"
                    f"Best regards,\nProcuraHub Team"
                )
                
                email_service.send_email(
                    [hod_email],
                    subject=f"Department Request Rejected - {getattr(request_obj, 'title')}",
                    body=plain_body_hod,
                    html_body=None,
                )

        return _build_request_response(request_obj)
    except HTTPException:
        db.rollback()
        raise
    except Exception as exc:  # pragma: no cover - defensive logging
        db.rollback()
        logger.exception("Failed to deny request %s", request_id)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Unable to deny request at this time. Please try again later.",
        ) from exc


@router.put("/{request_id}/finance/approve", response_model=RequestResponse)
def finance_approve_request(
    request_id: int,
    approval_in: RequestFinanceApproval,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(UserRole.finance, UserRole.superadmin)),
):
    try:
        request_obj = _get_request_or_404(db, request_id)
        if _request_status(request_obj) != RequestStatus.pending_finance:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST, detail="Only requests awaiting finance approval can be processed"
            )
        if request_obj.proposed_budget_amount is None:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Procurement must supply a budget before finance approval",
            )

        if approval_in.budget_amount is not None:
            request_obj.finance_budget_amount = Decimal(approval_in.budget_amount)
            request_obj.finance_budget_currency = approval_in.budget_currency or request_obj.proposed_budget_currency
        else:
            request_obj.finance_budget_amount = request_obj.proposed_budget_amount
            request_obj.finance_budget_currency = request_obj.proposed_budget_currency

        request_obj.finance_notes = approval_in.finance_notes
        request_obj.finance_reviewer_id = current_user.id
        request_obj.finance_reviewed_at = datetime.utcnow()
        request_obj.status = RequestStatus.finance_approved
        request_obj.finance_rejection_reason = None

        db.commit()
        db.refresh(request_obj)

        # Send email to requester
        if request_obj.requester and getattr(request_obj.requester, "email"):
            requester_name = str(getattr(request_obj.requester, "full_name", ""))
            requester_email = str(getattr(request_obj.requester, "email"))
            approved_by_name = str(getattr(current_user, "full_name", "Finance Team"))
            
            approved_budget = (
                getattr(request_obj, "finance_budget_amount", None)
                or getattr(request_obj, "proposed_budget_amount", None)
                or Decimal("0")
            )
            currency = (
                getattr(request_obj, "finance_budget_currency", None)
                or getattr(request_obj, "proposed_budget_currency", None)
                or "ZMW"
            )
            finance_notes_val = getattr(request_obj, "finance_notes", None)
            
            html_body = purchase_request_approved_finance_email(
                requester_name=requester_name,
                request_title=str(getattr(request_obj, "title")),
                approved_by=approved_by_name,
                approved_budget=Decimal(approved_budget),
                currency=str(currency),
                finance_notes=finance_notes_val if finance_notes_val else None,
            )
            
            notes_line = f"\nNotes: {finance_notes_val}" if finance_notes_val else ""
            plain_body = (
                f"Hello {requester_name},\n\n"
                f"Your purchase request '{getattr(request_obj, 'title')}' has been fully approved by finance!\n\n"
                f"Approved by: {approved_by_name}\n"
                f"Approved Budget: {approved_budget:,.2f} {currency}{notes_line}\n\n"
                f"Procurement can now proceed with supplier invitations.\n\n"
                f"Best regards,\nProcuraHub Team"
            )
            
            email_service.send_email(
                [requester_email],
                subject=f"Finance Approved - {getattr(request_obj, 'title')}",
                body=plain_body,
                html_body=html_body,
            )
        
        # Also notify procurement reviewer
        if request_obj.procurement_reviewer and getattr(request_obj.procurement_reviewer, "email"):
            procurement_email = str(getattr(request_obj.procurement_reviewer, "email"))
            procurement_name = str(getattr(request_obj.procurement_reviewer, "full_name", "Procurement Team"))
            
            approved_budget = (
                getattr(request_obj, "finance_budget_amount", None)
                or getattr(request_obj, "proposed_budget_amount", None)
                or Decimal("0")
            )
            currency = (
                getattr(request_obj, "finance_budget_currency", None)
                or getattr(request_obj, "proposed_budget_currency", None)
                or "ZMW"
            )
            finance_notes_val = getattr(request_obj, "finance_notes", None)
            
            plain_body_procurement = (
                f"Hello {procurement_name},\n\n"
                f"The purchase request '{getattr(request_obj, 'title')}' has been approved by finance.\n\n"
                f"Approved Budget: {approved_budget:,.2f} {currency}\n"
                f"Finance Notes: {finance_notes_val if finance_notes_val else 'None'}\n\n"
                f"You can now proceed with supplier invitations.\n\n"
                f"Best regards,\nProcuraHub Team"
            )
            
            email_service.send_email(
                [procurement_email],
                subject=f"Finance Approved - {getattr(request_obj, 'title')}",
                body=plain_body_procurement,
            )

        return _build_request_response(request_obj)
    except HTTPException:
        db.rollback()
        raise
    except Exception as exc:  # pragma: no cover - defensive logging
        db.rollback()
        logger.exception("Failed to finance approve request %s", request_id)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Unable to approve request at this time. Please try again later.",
        ) from exc


@router.put("/{request_id}/finance/reject", response_model=RequestResponse)
def finance_reject_request(
    request_id: int,
    rejection_in: RequestFinanceRejection,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(UserRole.finance, UserRole.superadmin)),
):
    try:
        request_obj = _get_request_or_404(db, request_id)
        if _request_status(request_obj) != RequestStatus.pending_finance:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST, detail="Only requests awaiting finance approval can be processed"
            )

        request_obj.status = RequestStatus.rejected_by_finance
        request_obj.finance_reviewer_id = current_user.id
        request_obj.finance_reviewed_at = datetime.utcnow()
        request_obj.finance_rejection_reason = rejection_in.reason
        request_obj.finance_notes = rejection_in.finance_notes

        db.commit()
        db.refresh(request_obj)

        # Send email to requester
        if request_obj.requester and getattr(request_obj.requester, "email"):
            requester_name = str(getattr(request_obj.requester, "full_name", ""))
            requester_email = str(getattr(request_obj.requester, "email"))
            rejected_by_name = str(getattr(current_user, "full_name", "Finance Team"))
            reason = rejection_in.reason or "No reason provided"
            
            html_body = purchase_request_rejected_email(
                requester_name=requester_name,
                request_title=str(getattr(request_obj, "title")),
                rejected_by=rejected_by_name,
                rejected_by_dept="Finance",
                reason=reason,
            )
            
            finance_notes_val = getattr(request_obj, "finance_notes", None)
            notes_line = f"\nAdditional Notes: {finance_notes_val}" if finance_notes_val else ""
            
            plain_body = (
                f"Hello {requester_name},\n\n"
                f"Your purchase request '{getattr(request_obj, 'title')}' has been reviewed by finance "
                f"and has not been approved.\n\n"
                f"Rejected by: {rejected_by_name}\n"
                f"Reason: {reason}{notes_line}\n\n"
                f"Please review the feedback with Procurement before resubmitting.\n\n"
                f"Best regards,\nProcuraHub Team"
            )
            
            email_service.send_email(
                [requester_email],
                subject=f"Request Rejected by Finance - {getattr(request_obj, 'title')}",
                body=plain_body,
                html_body=html_body,
            )
        
        # Also notify procurement reviewer
        if request_obj.procurement_reviewer and getattr(request_obj.procurement_reviewer, "email"):
            procurement_email = str(getattr(request_obj.procurement_reviewer, "email"))
            procurement_name = str(getattr(request_obj.procurement_reviewer, "full_name", "Procurement Team"))
            reason = rejection_in.reason or "No reason provided"
            finance_notes_val = getattr(request_obj, "finance_notes", None)
            
            plain_body_procurement = (
                f"Hello {procurement_name},\n\n"
                f"The purchase request '{getattr(request_obj, 'title')}' has been rejected by finance.\n\n"
                f"Reason: {reason}\n"
                f"Finance Notes: {finance_notes_val if finance_notes_val else 'None'}\n\n"
                f"Please review with the requester before resubmission.\n\n"
                f"Best regards,\nProcuraHub Team"
            )
            
            email_service.send_email(
                [procurement_email],
                subject=f"Finance Rejected - {getattr(request_obj, 'title')}",
                body=plain_body_procurement,
            )

        return _build_request_response(request_obj, include_documents=False)
    except HTTPException:
        db.rollback()
        raise
    except Exception as exc:  # pragma: no cover - defensive logging
        db.rollback()
        logger.exception("Failed to finance reject request %s", request_id)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Unable to reject request at this time. Please try again later.",
        ) from exc


@router.post("/{request_id}/invite-suppliers", response_model=RequestResponse)
def invite_suppliers(
    request_id: int,
    invite_in: RequestSupplierInvite,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(UserRole.procurement, UserRole.superadmin)),
):
    request_obj = _get_request_or_404(db, request_id)
    current_status = _request_status(request_obj)
    if current_status not in {RequestStatus.finance_approved, RequestStatus.rfq_issued}:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Suppliers can only be invited once Finance has approved the request",
        )

    if not invite_in.supplier_ids:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="At least one supplier must be selected for invitations",
        )

    deadline = invite_in.rfq_deadline
    if deadline.tzinfo:
        deadline_utc = deadline.astimezone(timezone.utc)
    else:
        deadline_utc = deadline.replace(tzinfo=timezone.utc)
    if deadline_utc <= datetime.now(timezone.utc):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="RFQ deadline must be in the future",
        )

    suppliers = (
        db.query(SupplierProfile)
        .filter(SupplierProfile.id.in_(invite_in.supplier_ids))
        .all()
    )
    found_ids = {supplier.id for supplier in suppliers}
    missing = sorted(set(invite_in.supplier_ids) - found_ids)
    if missing:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Supplier(s) not found: {missing}",
        )

    rfq = None
    if request_obj.rfq_id:
        rfq = db.query(RFQ).filter(RFQ.id == request_obj.rfq_id).first()
    if rfq is None:
        # Don't include justification in RFQ description - it's only for internal use
        description = request_obj.description or ""

        rfq_budget = (
            request_obj.finance_budget_amount
            if request_obj.finance_budget_amount is not None
            else request_obj.proposed_budget_amount
            if request_obj.proposed_budget_amount is not None
            else Decimal("0")
        )
        rfq_currency = (
            request_obj.finance_budget_currency
            or request_obj.proposed_budget_currency
            or "ZMW"
        )

        rfq = RFQ(
            title=request_obj.title,
            description=description,
            category=request_obj.category,
            budget=rfq_budget,
            currency=rfq_currency,
            deadline=deadline_utc,
            status=RFQStatus.open,
            created_by_id=current_user.id,
        )
        db.add(rfq)
        db.flush()
        request_obj.rfq_id = rfq.id
    else:
        rfq.deadline = deadline_utc
        rfq.status = RFQStatus.open
        if request_obj.finance_budget_amount is not None:
            rfq.budget = request_obj.finance_budget_amount
            if request_obj.finance_budget_currency:
                rfq.currency = request_obj.finance_budget_currency
        elif request_obj.proposed_budget_amount is not None:
            rfq.budget = request_obj.proposed_budget_amount
            if request_obj.proposed_budget_currency:
                rfq.currency = request_obj.proposed_budget_currency

    if not getattr(rfq, "rfq_number", None):
        setattr(rfq, "rfq_number", generate_rfq_number(rfq.id, getattr(rfq, "created_at", None)))

    existing_invited_ids = {invitation.supplier_id for invitation in rfq.invitations}
    new_suppliers = [supplier for supplier in suppliers if supplier.id not in existing_invited_ids]
    if not new_suppliers:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="All selected suppliers have already been invited to this RFQ",
        )

    create_invitations(db, rfq, new_suppliers, invited_by=current_user)

    request_obj.rfq_invited_at = datetime.utcnow()
    request_obj.status = RequestStatus.rfq_issued
    if invite_in.notes:
        request_obj.procurement_notes = invite_in.notes

    db.commit()
    db.refresh(request_obj)
    db.refresh(rfq)

    if request_obj.requester and request_obj.requester.email:
        email_service.send_email(
            [request_obj.requester.email],
            subject=f"RFQ Invitations Sent for {request_obj.title}",
            body=(
                f"Hello {request_obj.requester.full_name or ''},\n\n"
                f"Procurement has sent RFQ invitations to selected suppliers for your request "
                f"\"{request_obj.title}\". Suppliers have been asked to respond by "
                f"{deadline_utc:%Y-%m-%d %H:%M UTC}.\n\n"
                "You'll be notified when quotations start arriving."
            ),
        )

    return _build_request_response(request_obj)


@router.post("/{request_id}/documents", response_model=RequestResponse, status_code=status.HTTP_201_CREATED)
def upload_request_documents(
    request_id: int,
    files: list[UploadFile] = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
) -> RequestResponse:
    if not files:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="At least one file must be uploaded",
        )

    request_obj = _get_request_or_404(db, request_id)
    _ensure_user_may_modify_documents(request_obj, current_user)

    saved_any = False
    for upload in files:
        if not upload.filename:
            continue
        stored_path = save_upload_file(upload, subdir=f"request_{request_id}/documents")
        try:
            relative_path = stored_path.relative_to(settings.resolved_upload_dir)
            file_path = str(relative_path).replace("\\", "/")
        except ValueError:
            file_path = str(stored_path)

        document = RequestDocument(
            request_id=request_id,
            file_path=file_path,
            original_filename=upload.filename,
            uploaded_by_id=current_user.id,
        )
        db.add(document)
        saved_any = True

    if not saved_any:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No valid files were provided for upload",
        )

    db.commit()
    db.refresh(request_obj)
    return _build_request_response(request_obj)


@router.get("/{request_id}/document")
def download_request_document(
    request_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """Download the first document attached to a request with authorization check."""
    from pathlib import Path
    from ..config import get_settings
    
    settings = get_settings()
    request_obj = _get_request_or_404(db, request_id)
    
    # Authorization check - verify user has access to this request
    user_role = _user_role(current_user)
    
    # SuperAdmin and Procurement can access all documents
    if user_role not in [UserRole.superadmin, UserRole.procurement, UserRole.procurement_officer]:
        # Requesters can only access their own request documents
        if user_role == UserRole.requester:
            if request_obj.requester_id != current_user.id:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Not authorized to access this document"
                )
        # HOD can access documents from their department
        elif user_role == UserRole.head_of_department:
            if request_obj.department_id:
                department = db.query(Department).filter(
                    Department.id == request_obj.department_id,
                    Department.head_of_department_id == current_user.id
                ).first()
                if not department:
                    raise HTTPException(
                        status_code=status.HTTP_403_FORBIDDEN,
                        detail="Not authorized to access this document"
                    )
            else:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Not authorized to access this document"
                )
        else:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Not authorized to access this document"
            )
    
    # Get the first document
    document = db.query(RequestDocument).filter(
        RequestDocument.request_id == request_id
    ).first()
    
    if not document:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No document found for this request"
        )
    
    # Build the full file path
    file_path = settings.resolved_upload_dir / document.file_path
    
    if not file_path.exists():
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Document file not found on server"
        )
    
    return FileResponse(
        path=str(file_path),
        filename=document.original_filename,
        media_type="application/octet-stream",
        headers={"Content-Disposition": f'attachment; filename="{document.original_filename}"'}
    )


def _get_request_or_404(db: Session, request_id: int) -> PurchaseRequest:
    request_obj = (
        db.query(PurchaseRequest)
        .filter(PurchaseRequest.id == request_id)
        .first()
    )
    if not request_obj:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Request not found")
    return request_obj
