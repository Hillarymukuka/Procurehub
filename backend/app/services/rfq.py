"""RFQ domain services."""

from datetime import datetime, timezone
from zoneinfo import ZoneInfo
from typing import Iterable, List
from sqlalchemy.orm import Session

from ..config import get_settings
from ..models import (
    RFQ,
    RFQInvitation,
    RFQStatus,
    SupplierCategory,
    SupplierProfile,
    User,
)
from .email import email_service
from .email_templates import rfq_invitation_email


settings = get_settings()



def generate_rfq_number(rfq_id: int, reference_date: datetime | None = None) -> str:
    """Format a consistent RFQ number (RFQ###_MMYYYY)."""
    moment = reference_date or datetime.utcnow()
    return f"RFQ{rfq_id:03d}_{moment.strftime('%m%Y')}"


def close_expired_rfqs(db: Session) -> int:
    """Close RFQs whose deadlines (date and time) have passed and unlock responses."""
    # Use Africa/Lusaka timezone consistently
    lusaka_tz = ZoneInfo("Africa/Lusaka")
    now_lusaka = datetime.now(lusaka_tz)
    
    open_rfqs: list[RFQ] = (
        db.query(RFQ)
        .filter(RFQ.status == RFQStatus.open)
        .all()
    )

    closed_count = 0
    for rfq in open_rfqs:
        deadline = getattr(rfq, "deadline", None)
        if deadline is None:
            continue
        
        # Ensure deadline is timezone-aware for proper comparison
        if deadline.tzinfo is None:
            # If deadline has no timezone info, it's UTC (from DB)
            deadline_utc = deadline.replace(tzinfo=timezone.utc)
            deadline_lusaka = deadline_utc.astimezone(lusaka_tz)
        else:
            # Convert to Africa/Lusaka for comparison
            deadline_lusaka = deadline.astimezone(lusaka_tz)
            
        if deadline_lusaka <= now_lusaka:
            rfq.status = RFQStatus.closed
            # Unlock responses when deadline passes so procurement can see quotations
            if getattr(rfq, "response_locked", False):
                setattr(rfq, "response_locked", False)
            closed_count += 1

    if closed_count:
        db.flush()
    return closed_count


def select_suppliers_for_rfq(
    db: Session, category: str, limit: int | None = None
) -> List[SupplierProfile]:
    """Select suppliers in a category using fairness heuristics."""
    query = (
        db.query(SupplierProfile)
        .join(SupplierCategory)
        .filter(SupplierCategory.name == category)
        .order_by(SupplierProfile.invitations_sent.asc(), SupplierProfile.last_invited_at.asc())
    )
    if limit:
        query = query.limit(limit)
    return list(query.all())


def create_invitations(
    db: Session, rfq: RFQ, suppliers: Iterable[SupplierProfile], invited_by: User = None, send_emails: bool = True
) -> List[RFQInvitation]:
    """Create invitation records and update supplier fairness counters.
    
    Args:
        db: Database session
        rfq: The RFQ to create invitations for
        suppliers: Suppliers to invite
        invited_by: User who created the invitation
        send_emails: Whether to send email notifications (default True). 
                     Set to False for draft RFQs to defer sending until approval.
    """
    invitations: List[RFQInvitation] = []
    
    # Get RFQ details for email
    rfq_title = str(getattr(rfq, "title"))
    rfq_description = str(getattr(rfq, "description", ""))
    rfq_category = str(getattr(rfq, "category"))
    rfq_deadline = getattr(rfq, "deadline")
    invited_by_name = getattr(invited_by, "full_name", "Procurement Team") if invited_by else "Procurement Team"
    
    for supplier in suppliers:
        invitation = RFQInvitation(rfq_id=getattr(rfq, "id"), supplier_id=getattr(supplier, "id"))
        db.add(invitation)
        current_invites = getattr(supplier, "invitations_sent") or 0
        setattr(supplier, "invitations_sent", int(current_invites) + 1)
        setattr(supplier, "last_invited_at", datetime.now(timezone.utc))
        invitations.append(invitation)

        # Send HTML email notification only if send_emails is True
        if send_emails:
            supplier_name = str(getattr(supplier, "company_name"))
            supplier_email = str(getattr(supplier, "contact_email"))
            
            html_body = rfq_invitation_email(
                supplier_name=supplier_name,
                rfq_title=rfq_title,
                rfq_description=rfq_description,
                category=rfq_category,
                deadline=rfq_deadline,
                invited_by=invited_by_name,
            )
            
            # Convert deadline to Lusaka time for email display
            lusaka_tz = ZoneInfo("Africa/Lusaka")
            if rfq_deadline.tzinfo is None:
                # Naive from DB = UTC
                deadline_utc = rfq_deadline.replace(tzinfo=timezone.utc)
                deadline_display = deadline_utc.astimezone(lusaka_tz)
            else:
                deadline_display = rfq_deadline.astimezone(lusaka_tz)

            # Plain text fallback
            plain_body = (
                f"Dear {supplier_name},\n\n"
                f"You have been invited to submit a quotation for RFQ '{rfq_title}' "
                f"in category '{rfq_category}'.\n\n"
                f"Description: {rfq_description}\n\n"
                f"Deadline: {deadline_display:%B %d, %Y} (CAT)\n\n"
                f"Please log in to ProcuraHub to view full details and submit your quotation.\n\n"
                f"Best regards,\nProcuraHub Team"
            )
            
            email_service.send_email(
                [supplier_email],
                subject=f"🔔 New RFQ Invitation: {rfq_title}",
                body=plain_body,
                html_body=html_body,
            )
    return invitations
