"""Admin endpoints for managing users, suppliers, and categories."""

from typing import List, Optional

from fastapi import APIRouter, Body, Depends, File, Form, HTTPException, UploadFile, status
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session, joinedload

from ..config import get_settings
from ..database import get_db
from ..dependencies import require_roles
from ..models import (
    CompanySettings,
    ProcurementCategory,
    PurchaseRequest,
    Quotation,
    QuotationStatus,
    RequestStatus,
    RFQ,
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
    CategoryCreate,
    CategoryRead,
    CategoryUpdate,
    CompanySettingsCreate,
    CompanySettingsRead,
    CompanySettingsUpdate,
    UserCreate,
    UserRead,
)
from ..schemas.supplier import SupplierCreate
from ..services.auth import create_user, get_user_by_email
from ..services.file_storage import save_upload_file

router = APIRouter()
settings = get_settings()


def _serialize_supplier_categories(categories: List[SupplierCategory]) -> List[dict]:
    """Return supplier categories ordered as primary then secondary."""
    if not categories:
        return []

    ordered: list[tuple[int, SupplierCategoryType, SupplierCategory]] = []
    fallback_order = 0
    for category in categories:
        if category is None:
            continue
        category_type = category.category_type
        if isinstance(category_type, str):
            try:
                category_type = SupplierCategoryType(category_type)
            except ValueError:
                category_type = None
        if category_type is None:
            category_type = SupplierCategoryType.primary if fallback_order == 0 else SupplierCategoryType.secondary
        order_value = 0 if category_type == SupplierCategoryType.primary else 1
        ordered.append((order_value, category_type, category))
        fallback_order += 1

    ordered.sort(key=lambda item: item[0])
    serializable: List[dict] = []
    seen_types: set[SupplierCategoryType] = set()
    for order_value, category_type, category in ordered:
        if category_type in seen_types:
            continue
        serializable.append(
            {
                "id": category.id,
                "name": category.name,
                "category_type": category_type.value,
            }
        )
        seen_types.add(category_type)
        if len(serializable) == 2:
            break
    return serializable


# ==================== User Management ====================
@router.get("/users", response_model=List[UserRead])
def list_users(
    db: Session = Depends(get_db),
    _: User = Depends(require_roles(UserRole.superadmin)),
):
    """List all users in the system."""
    users = db.query(User).order_by(User.created_at.desc()).all()
    return users


@router.post("/users", response_model=UserRead, status_code=status.HTTP_201_CREATED)
def create_new_user(
    user_in: UserCreate,
    db: Session = Depends(get_db),
    _: User = Depends(require_roles(UserRole.superadmin)),
):
    """Create a new user (SuperAdmin only)."""
    if get_user_by_email(db, user_in.email):
        raise HTTPException(status_code=400, detail="Email already registered")
    
    # Validate department_id for HeadOfDepartment role
    if user_in.role == "HeadOfDepartment":
        if not user_in.department_id:
            raise HTTPException(
                status_code=400,
                detail="Department must be assigned for Head of Department role"
            )
        # Verify department exists
        from ..models import Department
        department = db.query(Department).filter(Department.id == user_in.department_id).first()
        if not department:
            raise HTTPException(status_code=404, detail="Department not found")
    
    user = create_user(db, user_in)
    
    # Assign department to HOD
    if user_in.role == "HeadOfDepartment" and user_in.department_id:
        from ..models import Department
        department = db.query(Department).filter(Department.id == user_in.department_id).first()
        if department:
            department.head_of_department_id = user.id
            db.commit()
            db.refresh(department)
    
    return user


@router.delete("/users/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_user(
    user_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(UserRole.superadmin)),
):
    """Delete a user (SuperAdmin only, cannot delete self)."""
    if user_id == current_user.id:
        raise HTTPException(status_code=400, detail="Cannot delete your own account")
    
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    db.delete(user)
    db.commit()
    return None


# ==================== Department Management ====================
@router.get("/departments", response_model=List[dict])
def list_departments(
    db: Session = Depends(get_db),
    _: User = Depends(require_roles(UserRole.superadmin)),
):
    """List all departments (SuperAdmin only)."""
    from ..models import Department
    
    departments = db.query(Department).order_by(Department.name).all()
    return [
        {
            "id": dept.id,
            "name": dept.name,
            "description": dept.description,
            "budget": float(dept.budget) if dept.budget else None,
            "head_count": db.query(User).filter(
                User.role == UserRole.head_of_department
            ).count(),
        }
        for dept in departments
    ]


@router.post("/departments", response_model=dict, status_code=status.HTTP_201_CREATED)
def create_department(
    name: str = Form(...),
    description: Optional[str] = Form(None),
    budget: Optional[float] = Form(None),
    db: Session = Depends(get_db),
    _: User = Depends(require_roles(UserRole.superadmin)),
):
    """Create a new department (SuperAdmin only)."""
    from ..models import Department
    
    # Check if department already exists
    existing = db.query(Department).filter(Department.name == name).first()
    if existing:
        raise HTTPException(
            status_code=400,
            detail=f"Department '{name}' already exists"
        )
    
    department = Department(
        name=name,
        description=description,
        budget=budget
    )
    
    db.add(department)
    db.commit()
    db.refresh(department)
    
    return {
        "id": department.id,
        "name": department.name,
        "description": department.description,
        "budget": float(department.budget) if department.budget else None,
    }


@router.delete("/departments/{department_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_department(
    department_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(require_roles(UserRole.superadmin)),
):
    """Delete a department (SuperAdmin only)."""
    from ..models import Department
    
    department = db.query(Department).filter(Department.id == department_id).first()
    if not department:
        raise HTTPException(status_code=404, detail="Department not found")
    
    # Check if department has HODs assigned
    hod_count = db.query(User).filter(
        User.role == UserRole.head_of_department
    ).count()
    
    if hod_count > 0:
        raise HTTPException(
            status_code=400,
            detail="Cannot delete department with assigned Heads of Department"
        )
    
    db.delete(department)
    db.commit()
    return None


# ==================== Supplier Management ====================
@router.get("/suppliers", response_model=List[dict])
def list_suppliers(
    db: Session = Depends(get_db),
    _: User = Depends(require_roles(UserRole.superadmin, UserRole.procurement, UserRole.procurement_officer)),
):
    """List all registered suppliers (SuperAdmin, Procurement, and Procurement Officers)."""
    suppliers = (
        db.query(SupplierProfile, User)
        .options(
            joinedload(SupplierProfile.categories),
            joinedload(SupplierProfile.documents),
        )
        .join(User, SupplierProfile.user_id == User.id)
        .order_by(SupplierProfile.created_at.desc())
        .all()
    )
    
    return [
        {
            "id": profile.id,
            "supplier_number": profile.supplier_number,
            "company_name": profile.company_name,
            "contact_email": profile.contact_email,
            "contact_phone": profile.contact_phone,
            "address": profile.address,
            "preferred_currency": profile.preferred_currency,
            "invitations_sent": profile.invitations_sent,
            "total_awarded_value": float(profile.total_awarded_value or 0),
            "created_at": profile.created_at,
            "user_email": user.email,
            "user_active": user.is_active,
            "categories": _serialize_supplier_categories(profile.categories),
            "documents": [
                {
                    "id": document.id,
                    "document_type": document.document_type.value,
                    "original_filename": document.original_filename,
                    "file_path": document.file_path,
                    "uploaded_at": document.uploaded_at,
                }
                for document in profile.documents
            ],
        }
        for profile, user in suppliers
    ]


@router.post("/suppliers", response_model=dict, status_code=status.HTTP_201_CREATED)
async def create_supplier_by_procurement(
    company_name: str = Form(...),
    contact_email: str = Form(...),
    full_name: str = Form(...),
    password: str = Form(...),
    contact_phone: Optional[str] = Form(None),
    address: Optional[str] = Form(None),
    preferred_currency: Optional[str] = Form("USD"),
    category_ids: Optional[List[int]] = Form(default=None),
    tax_clearance: Optional[UploadFile] = File(None),
    certificate_of_incorporation: Optional[UploadFile] = File(None),
    other_documents: List[UploadFile] = File([]),
    db: Session = Depends(get_db),
    _: User = Depends(require_roles(UserRole.superadmin, UserRole.procurement)),
):
    """Create a supplier account with optional document uploads (SuperAdmin and Procurement)."""
    from ..services.auth import create_user, get_user_by_email
    from ..utils.supplier_utils import generate_supplier_number

    if get_user_by_email(db, contact_email):
        raise HTTPException(status_code=400, detail="Email already registered")

    # Create user account
    user = create_user(
        db,
        user_in=UserCreate(
            email=contact_email,
            full_name=full_name,
            password=password,
            role=UserRole.supplier.value,
        ),
    )

    # Generate supplier number
    supplier_number = generate_supplier_number(db)

    # Create supplier profile
    profile = SupplierProfile(
        user_id=user.id,
        company_name=company_name,
        contact_email=contact_email.lower(),
        contact_phone=contact_phone,
        address=address,
        preferred_currency=preferred_currency,
        supplier_number=supplier_number,
    )
    db.add(profile)
    db.flush()
    db.refresh(profile)

    # Attach categories if provided
    raw_category_ids = category_ids or []
    ordered_category_ids: List[int] = []
    seen_ids: set[int] = set()
    for category_id in raw_category_ids:
        if category_id is None:
            continue
        if category_id in seen_ids:
            continue
        seen_ids.add(category_id)
        ordered_category_ids.append(category_id)
    if len(ordered_category_ids) > 2:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Suppliers can only have a primary and secondary category.",
        )
    if ordered_category_ids:
        categories = (
            db.query(ProcurementCategory)
            .filter(ProcurementCategory.id.in_(ordered_category_ids))
            .all()
        )
        category_map = {category.id: category for category in categories}
        missing = [category_id for category_id in ordered_category_ids if category_id not in category_map]
        if missing:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid category ids: {missing}",
            )
        category_types = [SupplierCategoryType.primary, SupplierCategoryType.secondary]
        for index, category_id in enumerate(ordered_category_ids):
            procurement_category = category_map[category_id]
            supplier_category = SupplierCategory(
                supplier_id=profile.id,
                name=procurement_category.name,
                category_type=category_types[index],
            )
            profile.categories.append(supplier_category)

    # Handle file uploads
    uploaded_files = []
    
    if tax_clearance:
        file_path = save_upload_file(tax_clearance, subdir="supplier_documents")
        doc = SupplierDocument(
            supplier_id=profile.id,
            document_type=SupplierDocumentType.tax_clearance,
            file_path=str(file_path),
            original_filename=tax_clearance.filename,
        )
        db.add(doc)
        uploaded_files.append({"type": "tax_clearance", "filename": tax_clearance.filename})
    
    if certificate_of_incorporation:
        file_path = save_upload_file(certificate_of_incorporation, subdir="supplier_documents")
        doc = SupplierDocument(
            supplier_id=profile.id,
            document_type=SupplierDocumentType.incorporation,
            file_path=str(file_path),
            original_filename=certificate_of_incorporation.filename,
        )
        db.add(doc)
        uploaded_files.append({"type": "incorporation", "filename": certificate_of_incorporation.filename})
    
    for other_doc in other_documents:
        if other_doc.filename:
            file_path = save_upload_file(other_doc, subdir="supplier_documents")
            doc = SupplierDocument(
                supplier_id=profile.id,
                document_type=SupplierDocumentType.other,
                file_path=str(file_path),
                original_filename=other_doc.filename,
            )
            db.add(doc)
            uploaded_files.append({"type": "other", "filename": other_doc.filename})
    
    db.commit()
    db.refresh(profile)

    # Send welcome email
    from ..services.email import email_service
    email_service.send_email(
        [contact_email],
        subject="Welcome to ProcuraHub",
        body=(
            f"Hello {company_name},\n\n"
            "Your supplier account has been created. You can now login and "
            "receive invitations for relevant RFQs.\n\n"
            f"Email: {contact_email}\n"
            "Visit: http://localhost:5173\n\n"
            "Best regards,\nProcuraHub Team"
        ),
    )

    return {
        "user_id": user.id,
        "supplier_id": profile.id,
        "supplier_number": profile.supplier_number,
        "company_name": profile.company_name,
        "contact_email": profile.contact_email,
        "categories": _serialize_supplier_categories(profile.categories),
        "uploaded_files": uploaded_files,
    }


@router.get("/suppliers/{supplier_id}", response_model=dict)
def get_supplier(
    supplier_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(require_roles(UserRole.superadmin, UserRole.procurement, UserRole.procurement_officer)),
):
    """Get a single supplier by ID (SuperAdmin, Procurement, and Procurement Officers)."""
    result = (
        db.query(SupplierProfile, User)
        .options(joinedload(SupplierProfile.categories))
        .join(User, SupplierProfile.user_id == User.id)
        .filter(SupplierProfile.id == supplier_id)
        .first()
    )
    
    if not result:
        raise HTTPException(status_code=404, detail="Supplier not found")
    
    profile, user = result
    
    # Get supplier documents
    documents = db.query(SupplierDocument).filter(SupplierDocument.supplier_id == supplier_id).all()
    
    return {
        "id": profile.id,
        "supplier_number": profile.supplier_number,
        "company_name": profile.company_name,
        "contact_email": profile.contact_email,
        "contact_phone": profile.contact_phone,
        "address": profile.address,
        "preferred_currency": profile.preferred_currency,
        "invitations_sent": profile.invitations_sent,
        "total_awarded_value": float(profile.total_awarded_value or 0),
        "created_at": profile.created_at,
        "user_email": user.email,
        "user_active": user.is_active,
        "categories": _serialize_supplier_categories(profile.categories),
        "documents": [
            {
                "id": doc.id,
                "document_type": doc.document_type.value,
                "original_filename": doc.original_filename,
                "uploaded_at": doc.uploaded_at,
            }
            for doc in documents
        ],
    }


@router.get("/suppliers/{supplier_id}/user", response_model=dict)
def get_supplier_user(
    supplier_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(require_roles(UserRole.superadmin, UserRole.procurement, UserRole.procurement_officer)),
):
    """Get user information for a supplier (SuperAdmin, Procurement, and Procurement Officers)."""
    profile = db.query(SupplierProfile).filter(SupplierProfile.id == supplier_id).first()
    if not profile:
        raise HTTPException(status_code=404, detail="Supplier not found")
    
    user = db.query(User).filter(User.id == profile.user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found for supplier")
    
    return {
        "user_id": user.id,
        "user_email": user.email,
        "user_active": user.is_active,
        "supplier_id": profile.id,
        "company_name": profile.company_name,
    }


@router.get("/suppliers/{supplier_id}/documents/{document_id}")
def download_supplier_document(
    supplier_id: int,
    document_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(require_roles(UserRole.superadmin, UserRole.procurement, UserRole.procurement_officer)),
):
    """Download a supplier document (SuperAdmin, Procurement, and Procurement Officers)."""
    from fastapi.responses import FileResponse
    from pathlib import Path
    
    document = (
        db.query(SupplierDocument)
        .filter(
            SupplierDocument.id == document_id,
            SupplierDocument.supplier_id == supplier_id,
        )
        .first()
    )
    
    if not document:
        raise HTTPException(status_code=404, detail="Document not found")
    
    file_path = Path(str(document.file_path))
    if not file_path.exists():
        raise HTTPException(status_code=404, detail="File not found on server")
    
    return FileResponse(
        path=str(file_path),
        filename=str(document.original_filename or "document"),
        media_type="application/octet-stream",
    )


# ==================== Category Management ====================
@router.get("/categories", response_model=List[CategoryRead])
def list_categories(
    db: Session = Depends(get_db),
    _: User = Depends(require_roles(UserRole.superadmin, UserRole.procurement, UserRole.procurement_officer)),
):
    """List all procurement categories."""
    categories = db.query(ProcurementCategory).order_by(ProcurementCategory.name).all()
    return categories


@router.get("/categories/{category_id}/details")
def get_category_details(
    category_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(require_roles(UserRole.superadmin, UserRole.procurement)),
):
    """Get category details with associated RFQs."""
    print(f"DEBUG: Getting category details for category_id={category_id}")
    category = db.query(ProcurementCategory).filter(
        ProcurementCategory.id == category_id
    ).first()
    if not category:
        print(f"DEBUG: Category {category_id} not found")
        raise HTTPException(status_code=404, detail="Category not found")
    
    print(f"DEBUG: Found category: {category.name}")
    # Get all RFQs in this category
    rfqs = db.query(RFQ).filter(RFQ.category == category.name).all()
    print(f"DEBUG: Found {len(rfqs)} RFQs in category")
    
    # Calculate statistics
    total_rfqs = len(rfqs)
    open_rfqs = len([r for r in rfqs if r.status.value == "open"])
    awarded_rfqs = len([r for r in rfqs if r.status.value == "awarded"])
    total_budget = sum(float(r.budget) for r in rfqs)  # type: ignore
    
    print(f"DEBUG: Returning category details")
    return {
        "id": category.id,
        "name": category.name,
        "description": category.description,
        "created_at": category.created_at,
        "updated_at": category.updated_at,
        "total_rfqs": total_rfqs,
        "open_rfqs": open_rfqs,
        "awarded_rfqs": awarded_rfqs,
        "total_budget": total_budget,
        "rfqs": [
            {
                "id": r.id,
                "title": r.title,
                "budget": float(r.budget),  # type: ignore
                "currency": r.currency,
                "deadline": r.deadline,
                "status": r.status.value,
                "created_at": r.created_at,
            }
            for r in rfqs
        ],
    }


@router.post("/categories", response_model=CategoryRead, status_code=status.HTTP_201_CREATED)
def create_category(
    category_in: CategoryCreate,
    db: Session = Depends(get_db),
    _: User = Depends(require_roles(UserRole.superadmin, UserRole.procurement)),
):
    """Create a new procurement category (SuperAdmin and Procurement)."""
    existing = db.query(ProcurementCategory).filter(
        ProcurementCategory.name == category_in.name
    ).first()
    if existing:
        raise HTTPException(status_code=400, detail="Category already exists")
    
    category = ProcurementCategory(**category_in.model_dump())
    db.add(category)
    db.commit()
    db.refresh(category)
    return category


@router.put("/categories/{category_id}", response_model=CategoryRead)
def update_category(
    category_id: int,
    category_in: CategoryUpdate,
    db: Session = Depends(get_db),
    _: User = Depends(require_roles(UserRole.superadmin, UserRole.procurement)),
):
    """Update a procurement category (SuperAdmin and Procurement)."""
    category = db.query(ProcurementCategory).filter(
        ProcurementCategory.id == category_id
    ).first()
    if not category:
        raise HTTPException(status_code=404, detail="Category not found")
    
    update_data = category_in.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(category, field, value)
    
    db.commit()
    db.refresh(category)
    return category


@router.delete("/categories/{category_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_category(
    category_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(require_roles(UserRole.superadmin, UserRole.procurement)),
):
    """Delete a procurement category (SuperAdmin and Procurement)."""
    category = db.query(ProcurementCategory).filter(
        ProcurementCategory.id == category_id
    ).first()
    if not category:
        raise HTTPException(status_code=404, detail="Category not found")
    
    db.delete(category)
    db.commit()
    return None


# ==================== Analytics & Reports ====================
@router.get("/analytics/summary")
def get_procurement_analytics(
    db: Session = Depends(get_db),
    _: User = Depends(require_roles(UserRole.superadmin, UserRole.procurement, UserRole.finance)),
):
    """Get comprehensive procurement analytics and summary."""
    from sqlalchemy import func, case
    from decimal import Decimal
    
    # Request Statistics
    total_requests = db.query(func.count(PurchaseRequest.id)).scalar() or 0
    pending_requests = db.query(func.count(PurchaseRequest.id)).filter(
        PurchaseRequest.status.in_([RequestStatus.pending_procurement, RequestStatus.pending_finance])
    ).scalar() or 0
    approved_requests = db.query(func.count(PurchaseRequest.id)).filter(
        PurchaseRequest.status == RequestStatus.finance_approved
    ).scalar() or 0
    rejected_requests = db.query(func.count(PurchaseRequest.id)).filter(
        PurchaseRequest.status.in_([RequestStatus.rejected_by_procurement, RequestStatus.rejected_by_finance])
    ).scalar() or 0
    completed_requests = db.query(func.count(PurchaseRequest.id)).filter(
        PurchaseRequest.status == RequestStatus.completed
    ).scalar() or 0
    
    # RFQ Statistics
    total_rfqs = db.query(func.count(RFQ.id)).scalar() or 0
    open_rfqs = db.query(func.count(RFQ.id)).filter(RFQ.status == RFQStatus.open).scalar() or 0
    closed_rfqs = db.query(func.count(RFQ.id)).filter(RFQ.status == RFQStatus.closed).scalar() or 0
    awarded_rfqs = db.query(func.count(RFQ.id)).filter(RFQ.status == RFQStatus.awarded).scalar() or 0
    
    # Quotation Statistics
    total_quotations = db.query(func.count(Quotation.id)).scalar() or 0
    pending_quotations = db.query(func.count(Quotation.id)).filter(
        Quotation.status == QuotationStatus.submitted
    ).scalar() or 0
    approved_quotations = db.query(func.count(Quotation.id)).filter(
        Quotation.status == QuotationStatus.approved
    ).scalar() or 0
    rejected_quotations = db.query(func.count(Quotation.id)).filter(
        Quotation.status == QuotationStatus.rejected
    ).scalar() or 0
    
    # Supplier Statistics
    total_suppliers = db.query(func.count(SupplierProfile.id)).scalar() or 0
    active_suppliers = db.query(func.count(SupplierProfile.id)).join(
        User, SupplierProfile.user_id == User.id
    ).filter(User.is_active == True).scalar() or 0
    
    # Budget Statistics
    total_request_budget = db.query(
        func.coalesce(func.sum(PurchaseRequest.proposed_budget_amount), Decimal(0))
    ).filter(
        PurchaseRequest.proposed_budget_amount.isnot(None)
    ).scalar() or Decimal(0)
    
    approved_budget = db.query(
        func.coalesce(func.sum(PurchaseRequest.finance_budget_amount), Decimal(0))
    ).filter(
        PurchaseRequest.status == RequestStatus.finance_approved,
        PurchaseRequest.finance_budget_amount.isnot(None)
    ).scalar() or Decimal(0)
    
    total_quotation_value = db.query(
        func.coalesce(func.sum(Quotation.amount), Decimal(0))
    ).filter(
        Quotation.status == QuotationStatus.approved
    ).scalar() or Decimal(0)
    
    # Category Breakdown
    category_stats = db.query(
        ProcurementCategory.name,
        func.count(RFQ.id).label('rfq_count')
    ).outerjoin(
        RFQ, RFQ.category == ProcurementCategory.name
    ).group_by(ProcurementCategory.name).all()
    
    # Top Suppliers by Quotations
    top_suppliers = db.query(
        SupplierProfile.company_name,
        func.count(Quotation.id).label('quotation_count'),
        func.count(func.distinct(Quotation.rfq_id)).label('rfq_count'),
        func.sum(
            case((Quotation.status == QuotationStatus.approved, 1), else_=0)
        ).label('approved_count')
    ).join(
        Quotation, Quotation.supplier_id == SupplierProfile.id
    ).group_by(
        SupplierProfile.id, SupplierProfile.company_name
    ).order_by(
        func.count(Quotation.id).desc()
    ).limit(10).all()
    
    # Recent Activity - Last 30 days
    from datetime import datetime, timedelta
    thirty_days_ago = datetime.utcnow() - timedelta(days=30)
    
    recent_requests = db.query(func.count(PurchaseRequest.id)).filter(
        PurchaseRequest.created_at >= thirty_days_ago
    ).scalar() or 0
    
    recent_rfqs = db.query(func.count(RFQ.id)).filter(
        RFQ.created_at >= thirty_days_ago
    ).scalar() or 0
    
    recent_quotations = db.query(func.count(Quotation.id)).filter(
        Quotation.submitted_at >= thirty_days_ago
    ).scalar() or 0
    
    # User Activity
    total_users = db.query(func.count(User.id)).scalar() or 0
    active_users = db.query(func.count(User.id)).filter(User.is_active == True).scalar() or 0
    
    users_by_role = db.query(
        User.role,
        func.count(User.id).label('count')
    ).group_by(User.role).all()
    
    return {
        "requests": {
            "total": total_requests,
            "pending": pending_requests,
            "approved": approved_requests,
            "rejected": rejected_requests,
            "completed": completed_requests,
            "recent_30_days": recent_requests
        },
        "rfqs": {
            "total": total_rfqs,
            "open": open_rfqs,
            "closed": closed_rfqs,
            "awarded": awarded_rfqs,
            "recent_30_days": recent_rfqs
        },
        "quotations": {
            "total": total_quotations,
            "pending": pending_quotations,
            "approved": approved_quotations,
            "rejected": rejected_quotations,
            "recent_30_days": recent_quotations
        },
        "suppliers": {
            "total": total_suppliers,
            "active": active_suppliers,
            "top_performers": [
                {
                    "company_name": name,
                    "quotation_count": int(q_count),
                    "rfq_count": int(rfq_count),
                    "approved_count": int(approved)
                }
                for name, q_count, rfq_count, approved in top_suppliers
            ]
        },
        "budget": {
            "total_requested": float(total_request_budget),
            "total_approved": float(approved_budget),
            "total_awarded": float(total_quotation_value),
            "currency": "ZMW"  # Default currency, could be made configurable
        },
        "categories": [
            {
                "name": name,
                "rfq_count": int(count)
            }
            for name, count in category_stats
        ],
        "users": {
            "total": total_users,
            "active": active_users,
            "by_role": [
                {
                    "role": role,
                    "count": int(count)
                }
                for role, count in users_by_role
            ]
        }
    }


# ==================== Company Settings Management ====================
@router.get("/company-settings", response_model=CompanySettingsRead)
def get_company_settings(
    db: Session = Depends(get_db),
    _: User = Depends(require_roles(UserRole.superadmin, UserRole.procurement, UserRole.finance)),
):
    """Get company settings (creates default if not exists)."""
    company_settings = db.query(CompanySettings).first()
    
    if not company_settings:
        # Create default settings
        company_settings = CompanySettings(
            company_name="ProcuraHub",
            email="info@procurahub.com"
        )
        db.add(company_settings)
        db.commit()
        db.refresh(company_settings)
    
    # Build logo URL if logo exists
    result = CompanySettingsRead.model_validate(company_settings)
    logo_path = getattr(company_settings, "logo_path", None)
    if logo_path:
        result.logo_url = f"/api/admin/company-settings/logo"
    
    return result


@router.post("/company-settings", response_model=CompanySettingsRead, status_code=status.HTTP_201_CREATED)
def create_company_settings(
    settings_in: CompanySettingsCreate,
    db: Session = Depends(get_db),
    _: User = Depends(require_roles(UserRole.superadmin)),
):
    """Create company settings (only if none exist)."""
    existing = db.query(CompanySettings).first()
    if existing:
        raise HTTPException(
            status_code=400,
            detail="Company settings already exist. Use PUT to update."
        )
    
    company_settings = CompanySettings(**settings_in.model_dump())
    db.add(company_settings)
    db.commit()
    db.refresh(company_settings)
    
    result = CompanySettingsRead.model_validate(company_settings)
    logo_path = getattr(company_settings, "logo_path", None)
    if logo_path:
        result.logo_url = f"/api/admin/company-settings/logo"
    
    return result


@router.put("/company-settings", response_model=CompanySettingsRead)
def update_company_settings(
    settings_in: CompanySettingsUpdate,
    db: Session = Depends(get_db),
    _: User = Depends(require_roles(UserRole.superadmin)),
):
    """Update company settings."""
    company_settings = db.query(CompanySettings).first()
    
    if not company_settings:
        raise HTTPException(status_code=404, detail="Company settings not found")
    
    # Update only provided fields
    update_data = settings_in.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(company_settings, field, value)
    
    db.commit()
    db.refresh(company_settings)
    
    result = CompanySettingsRead.model_validate(company_settings)
    logo_path = getattr(company_settings, "logo_path", None)
    if logo_path:
        result.logo_url = f"/api/admin/company-settings/logo"
    
    return result


@router.post("/company-settings/logo")
async def upload_company_logo(
    logo: UploadFile = File(...),
    db: Session = Depends(get_db),
    _: User = Depends(require_roles(UserRole.superadmin)),
):
    """Upload company logo."""
    company_settings = db.query(CompanySettings).first()
    
    if not company_settings:
        raise HTTPException(status_code=404, detail="Company settings not found. Create settings first.")
    
    # Validate file type
    if not logo.content_type or not logo.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="File must be an image")
    
    # Save logo
    stored_path = save_upload_file(logo, subdir="company")
    upload_dir = settings.resolved_upload_dir
    
    try:
        relative_path = stored_path.relative_to(upload_dir)
        logo_path = str(relative_path).replace('\\', '/')
    except ValueError:
        logo_path = str(stored_path)
    
    # Update company settings
    setattr(company_settings, "logo_path", logo_path)
    db.commit()
    
    return {
        "message": "Logo uploaded successfully",
        "logo_url": f"/api/admin/company-settings/logo"
    }


@router.get("/company-settings/logo")
def get_company_logo(
    db: Session = Depends(get_db),
):
    """Get company logo (public access for documents)."""
    company_settings = db.query(CompanySettings).first()
    
    logo_path = getattr(company_settings, "logo_path", None) if company_settings else None
    if not company_settings or not logo_path:
        raise HTTPException(status_code=404, detail="Company logo not found")
    
    upload_dir = settings.resolved_upload_dir
    logo_full_path = upload_dir / logo_path
    
    if not logo_full_path.exists():
        raise HTTPException(status_code=404, detail="Logo file not found")
    
    return FileResponse(logo_full_path)


@router.delete("/company-settings/logo", status_code=status.HTTP_204_NO_CONTENT)
def delete_company_logo(
    db: Session = Depends(get_db),
    _: User = Depends(require_roles(UserRole.superadmin)),
):
    """Delete company logo."""
    company_settings = db.query(CompanySettings).first()
    
    if not company_settings:
        raise HTTPException(status_code=404, detail="Company settings not found")
    
    logo_path = getattr(company_settings, "logo_path", None)
    if logo_path:
        setattr(company_settings, "logo_path", None)
        db.commit()
    
    return None

