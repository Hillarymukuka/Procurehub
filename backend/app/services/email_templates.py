"""Modern HTML email templates for procurement notifications."""

from datetime import datetime
from decimal import Decimal
from typing import Optional

from ..config import get_settings


def _get_app_url() -> str:
    """Get the application URL based on environment."""
    settings = get_settings()
    return "https://procurehub.pages.dev" if settings.environment == "production" else "http://localhost:5173"


def get_base_template(content: str, title: str = "ProcuraHub Notification") -> str:
    """Base HTML email template with modern styling."""
    return f"""
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>{title}</title>
    <style>
        body {{
            margin: 0;
            padding: 0;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
            background-color: #F6F6F6;
            color: #0F0F0F;
        }}
        .container {{
            max-width: 600px;
            margin: 40px auto;
            background-color: #ffffff;
            border-radius: 12px;
            overflow: hidden;
            box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
        }}
        .header {{
            background: linear-gradient(135deg, #107DAC 0%, #0a5a7d 100%);
            padding: 30px;
            text-align: center;
            color: #ffffff;
        }}
        .header h1 {{
            margin: 0;
            font-size: 28px;
            font-weight: 700;
        }}
        .header p {{
            margin: 8px 0 0 0;
            font-size: 14px;
            opacity: 0.9;
        }}
        .content {{
            padding: 40px 30px;
        }}
        .content h2 {{
            margin: 0 0 20px 0;
            font-size: 20px;
            color: #0F0F0F;
        }}
        .content p {{
            margin: 0 0 16px 0;
            line-height: 1.6;
            color: #64748b;
        }}
        .info-box {{
            background-color: #f8fafc;
            border-left: 4px solid #107DAC;
            padding: 16px;
            margin: 24px 0;
            border-radius: 8px;
        }}
        .info-box .label {{
            font-size: 12px;
            font-weight: 600;
            text-transform: uppercase;
            color: #64748b;
            margin-bottom: 4px;
        }}
        .info-box .value {{
            font-size: 16px;
            font-weight: 600;
            color: #0F0F0F;
        }}
        .info-row {{
            display: flex;
            justify-content: space-between;
            padding: 12px 0;
            border-bottom: 1px solid #e2e8f0;
        }}
        .info-row:last-child {{
            border-bottom: none;
        }}
        .info-row .label {{
            font-weight: 600;
            color: #64748b;
        }}
        .info-row .value {{
            color: #0F0F0F;
            text-align: right;
        }}
        .button {{
            display: inline-block;
            padding: 14px 28px;
            background: linear-gradient(135deg, #107DAC 0%, #0a5a7d 100%);
            color: #ffffff;
            text-decoration: none;
            border-radius: 8px;
            font-weight: 600;
            margin: 20px 0;
            text-align: center;
        }}
        .button:hover {{
            opacity: 0.9;
        }}
        .status-badge {{
            display: inline-block;
            padding: 6px 12px;
            border-radius: 20px;
            font-size: 12px;
            font-weight: 600;
            text-transform: uppercase;
        }}
        .status-success {{
            background-color: #d1fae5;
            color: #065f46;
        }}
        .status-warning {{
            background-color: #fef3c7;
            color: #92400e;
        }}
        .status-info {{
            background-color: #dbeafe;
            color: #107DAC;
        }}
        .footer {{
            background-color: #f8fafc;
            padding: 24px 30px;
            text-align: center;
            color: #64748b;
            font-size: 14px;
        }}
        .footer p {{
            margin: 8px 0;
        }}
        .divider {{
            height: 1px;
            background-color: #e2e8f0;
            margin: 24px 0;
        }}
    </style>
</head>
<body>
    <div class="container">
        {content}
    </div>
</body>
</html>
"""


def rfq_invitation_email(
    supplier_name: str,
    rfq_title: str,
    rfq_description: str,
    category: str,
    deadline: datetime,
    invited_by: str,
    app_url: str = "http://localhost:5173"
) -> str:
    """Email template for RFQ invitation to suppliers."""
    deadline_str = deadline.strftime("%B %d, %Y at %I:%M %p")
    
    content = f"""
        <div class="header">
            <h1>RFQ Invitation</h1>
            <p>You've been invited to submit a quotation</p>
        </div>
        <div class="content">
            <h2>Hello {supplier_name},</h2>
            <p>You have been invited to participate in a new Request for Quotation (RFQ). We believe your company would be a great fit for this opportunity.</p>
            
            <div class="info-box">
                <div class="label">RFQ Title</div>
                <div class="value">{rfq_title}</div>
            </div>
            
            <div class="info-row">
                <span class="label">Category:</span>
                <span class="value">{category}</span>
            </div>
            <div class="info-row">
                <span class="label">Deadline:</span>
                <span class="value">{deadline_str}</span>
            </div>
            <div class="info-row">
                <span class="label">Invited By:</span>
                <span class="value">{invited_by}</span>
            </div>
            
            <div class="divider"></div>
            
            <p><strong>Description:</strong></p>
            <p>{rfq_description}</p>
            
            <div style="text-align: center;">
                <a href="{app_url}/login" class="button">View RFQ & Submit Quotation</a>
            </div>
            
            <p style="font-size: 14px; color: #6b7280; margin-top: 24px;">
                Please log in to your ProcuraHub account to view full details and submit your quotation before the deadline.
            </p>
        </div>
        <div class="footer">
            <p><strong>ProcuraHub</strong> - Procurement Management System</p>
            <p>This is an automated notification. Please do not reply to this email.</p>
        </div>
    """
    
    return get_base_template(content, "RFQ Invitation - ProcuraHub")


def quotation_approved_email(
    supplier_name: str,
    rfq_title: str,
    awarded_amount: Decimal,
    currency: str,
    tax_type: str | None = None,
    tax_amount: Decimal | None = None,
    app_url: str = "http://localhost:5173"
) -> str:
    """Email template for quotation approval notification."""
    
    # Calculate total if tax is present
    base_amount = awarded_amount
    total_amount = awarded_amount
    
    tax_breakdown = ""
    if tax_type and tax_amount and tax_amount > 0:
        total_amount = awarded_amount + tax_amount
        tax_rate = "16%" if tax_type == "VAT" else "5%" if tax_type == "TOT" else ""
        tax_breakdown = f"""
            <div class="divider"></div>
            <div style="background-color: #f8fafc; padding: 16px; border-radius: 8px;">
                <h3 style="margin: 0 0 12px 0; font-size: 14px; color: #64748b; text-transform: uppercase;">Amount Breakdown</h3>
                <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
                    <span style="color: #64748b;">Base Amount:</span>
                    <span style="font-weight: 600; color: #0F0F0F;">{base_amount:,.2f} {currency}</span>
                </div>
                <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
                    <span style="color: #64748b;">{tax_type} ({tax_rate}):</span>
                    <span style="font-weight: 600; color: #0F0F0F;">{tax_amount:,.2f} {currency}</span>
                </div>
                <div style="border-top: 2px solid #e2e8f0; padding-top: 8px; margin-top: 8px;">
                    <div style="display: flex; justify-content: space-between;">
                        <span style="font-weight: 700; color: #0F0F0F;">Total Amount:</span>
                        <span style="font-weight: 700; font-size: 18px; color: #065f46;">{total_amount:,.2f} {currency}</span>
                    </div>
                </div>
            </div>
        """
    
    content = f"""
        <div class="header">
            <h1>Congratulations!</h1>
            <p>Your quotation has been approved</p>
        </div>
        <div class="content">
            <h2>Hello {supplier_name},</h2>
            <p>We are pleased to inform you that your quotation has been <strong>approved</strong>!</p>
            
            <div class="info-box">
                <div class="label">RFQ Title</div>
                <div class="value">{rfq_title}</div>
            </div>
            
            <div class="info-box" style="background-color: #d1fae5; border-left-color: #10b981;">
                <div class="label">Awarded Amount</div>
                <div class="value" style="font-size: 24px; color: #065f46;">{total_amount:,.2f} {currency}</div>
            </div>
            
            {tax_breakdown}
            
            <p>Our procurement team will be in touch with you shortly to discuss the next steps and finalize the contract details.</p>
            
            <div style="text-align: center;">
                <a href="{app_url}/login" class="button">View Contract Details</a>
            </div>
            
            <p style="font-size: 14px; color: #6b7280; margin-top: 24px;">
                Thank you for your participation and we look forward to working with you!
            </p>
        </div>
        <div class="footer">
            <p><strong>ProcuraHub</strong> - Procurement Management System</p>
            <p>This is an automated notification. Please do not reply to this email.</p>
        </div>
    """
    
    return get_base_template(content, "Quotation Approved - ProcuraHub")


def quotation_rejected_email(
    supplier_name: str,
    rfq_title: str,
    app_url: str = "http://localhost:5173"
) -> str:
    """Email template for quotation rejection notification."""
    
    content = f"""
        <div class="header">
            <h1>RFQ Update</h1>
            <p>Status update on your quotation</p>
        </div>
        <div class="content">
            <h2>Hello {supplier_name},</h2>
            <p>Thank you for submitting your quotation for the following RFQ:</p>
            
            <div class="info-box">
                <div class="label">RFQ Title</div>
                <div class="value">{rfq_title}</div>
            </div>
            
            <p>We regret to inform you that another quotation has been selected for this RFQ. We appreciate the time and effort you invested in preparing your submission.</p>
            
            <p>We encourage you to continue participating in future RFQs. Your company remains a valued supplier in our network.</p>
            
            <div style="text-align: center;">
                <a href="{app_url}/login" class="button">View Available RFQs</a>
            </div>
            
            <p style="font-size: 14px; color: #6b7280; margin-top: 24px;">
                We look forward to future opportunities to work together.
            </p>
        </div>
        <div class="footer">
            <p><strong>ProcuraHub</strong> - Procurement Management System</p>
            <p>This is an automated notification. Please do not reply to this email.</p>
        </div>
    """
    
    return get_base_template(content, "RFQ Update - ProcuraHub")


def purchase_request_submitted_email(
    requester_name: str,
    request_title: str,
    category: str,
    estimated_value: Optional[Decimal],
    currency: str,
    justification: str,
    app_url: str = "http://localhost:5173"
) -> str:
    """Email template for purchase request submission confirmation."""
    
    value_display = f"{estimated_value:,.2f} {currency}" if estimated_value else "Not specified"
    
    content = f"""
        <div class="header">
            <h1>Request Submitted</h1>
            <p>Your purchase request has been received</p>
        </div>
        <div class="content">
            <h2>Hello {requester_name},</h2>
            <p>Your purchase request has been successfully submitted and is now under review by the procurement team.</p>
            
            <div class="info-box">
                <div class="label">Request Title</div>
                <div class="value">{request_title}</div>
            </div>
            
            <div class="info-row">
                <span class="label">Category:</span>
                <span class="value">{category}</span>
            </div>
            <div class="info-row">
                <span class="label">Estimated Value:</span>
                <span class="value">{value_display}</span>
            </div>
            
            <div class="divider"></div>
            
            <p><strong>Justification:</strong></p>
            <p>{justification}</p>
            
            <div style="text-align: center;">
                <span class="status-badge status-info">Pending Review</span>
            </div>
            
            <div style="text-align: center;">
                <a href="{app_url}/login" class="button">Track Request Status</a>
            </div>
            
            <p style="font-size: 14px; color: #6b7280; margin-top: 24px;">
                You will receive updates as your request moves through the approval process.
            </p>
        </div>
        <div class="footer">
            <p><strong>ProcuraHub</strong> - Procurement Management System</p>
            <p>This is an automated notification. Please do not reply to this email.</p>
        </div>
    """
    
    return get_base_template(content, "Request Submitted - ProcuraHub")


def purchase_request_approved_procurement_email(
    requester_name: str,
    request_title: str,
    approved_by: str,
    proposed_budget: Decimal,
    currency: str,
    procurement_notes: Optional[str],
    app_url: str = "http://localhost:5173"
) -> str:
    """Email template for procurement approval notification."""
    
    notes_section = ""
    if procurement_notes:
        notes_section = f"""
            <div class="divider"></div>
            <p><strong>Procurement Notes:</strong></p>
            <p>{procurement_notes}</p>
        """
    
    content = f"""
        <div class="header">
            <h1>Procurement Approved</h1>
            <p>Your request has been approved by procurement</p>
        </div>
        <div class="content">
            <h2>Hello {requester_name},</h2>
            <p>Great news! Your purchase request has been approved by the procurement department and is now awaiting finance approval.</p>
            
            <div class="info-box">
                <div class="label">Request Title</div>
                <div class="value">{request_title}</div>
            </div>
            
            <div class="info-row">
                <span class="label">Approved By:</span>
                <span class="value">{approved_by}</span>
            </div>
            
            {notes_section}
            
            <div style="text-align: center;">
                <span class="status-badge status-warning">Pending Finance Approval</span>
            </div>
            
            <div style="text-align: center;">
                <a href="{app_url}/login" class="button">View Request Details</a>
            </div>
        </div>
        <div class="footer">
            <p><strong>ProcuraHub</strong> - Procurement Management System</p>
            <p>This is an automated notification. Please do not reply to this email.</p>
        </div>
    """
    
    return get_base_template(content, "Procurement Approved - ProcuraHub")


def purchase_request_approved_finance_email(
    requester_name: str,
    request_title: str,
    approved_by: str,
    approved_budget: Decimal,
    currency: str,
    finance_notes: Optional[str],
    app_url: str = "http://localhost:5173"
) -> str:
    """Email template for finance approval notification."""
    
    notes_section = ""
    if finance_notes:
        notes_section = f"""
            <div class="divider"></div>
            <p><strong>Finance Notes:</strong></p>
            <p>{finance_notes}</p>
        """
    
    content = f"""
        <div class="header">
            <h1>Fully Approved!</h1>
            <p>Your request has received final approval</p>
        </div>
        <div class="content">
            <h2>Hello {requester_name},</h2>
            <p>Excellent news! Your purchase request has received <strong>final approval</strong> from the finance department. The procurement team will now proceed with issuing the RFQ.</p>
            
            <div class="info-box">
                <div class="label">Request Title</div>
                <div class="value">{request_title}</div>
            </div>
            
            <div class="info-row">
                <span class="label">Approved By:</span>
                <span class="value">{approved_by}</span>
            </div>
            
            {notes_section}
            
            <div style="text-align: center;">
                <span class="status-badge status-success">Approved</span>
            </div>
            
            <div style="text-align: center;">
                <a href="{app_url}/login" class="button">View Request Details</a>
            </div>
        </div>
        <div class="footer">
            <p><strong>ProcuraHub</strong> - Procurement Management System</p>
            <p>This is an automated notification. Please do not reply to this email.</p>
        </div>
    """
    
    return get_base_template(content, "Finance Approved - ProcuraHub")


def purchase_request_rejected_email(
    requester_name: str,
    request_title: str,
    rejected_by: str,
    rejection_reason: str,
    rejected_by_dept: str,
    app_url: str = "http://localhost:5173"
) -> str:
    """Email template for request rejection notification."""
    
    content = f"""
        <div class="header">
            <h1>Request Update</h1>
            <p>Status update on your purchase request</p>
        </div>
        <div class="content">
            <h2>Hello {requester_name},</h2>
            <p>Your purchase request has been reviewed by the {rejected_by_dept} department.</p>
            
            <div class="info-box">
                <div class="label">Request Title</div>
                <div class="value">{request_title}</div>
            </div>
            
            <div class="info-row">
                <span class="label">Reviewed By:</span>
                <span class="value">{rejected_by}</span>
            </div>
            
            <div class="divider"></div>
            
            <p><strong>Feedback:</strong></p>
            <p>{rejection_reason}</p>
            
            <p>You may revise and resubmit your request addressing the concerns mentioned above.</p>
            
            <div style="text-align: center;">
                <a href="{app_url}/login" class="button">View Request Details</a>
            </div>
        </div>
        <div class="footer">
            <p><strong>ProcuraHub</strong> - Procurement Management System</p>
            <p>This is an automated notification. Please do not reply to this email.</p>
        </div>
    """
    
    return get_base_template(content, "Request Update - ProcuraHub")


def new_request_for_procurement_email(
    requester_name: str,
    request_title: str,
    category: str,
    estimated_value: Optional[Decimal],
    currency: str,
    app_url: str = "http://localhost:5173"
) -> str:
    """Email template for notifying procurement of new request."""
    
    value_display = f"{estimated_value:,.2f} {currency}" if estimated_value else "Not specified"
    
    content = f"""
        <div class="header">
            <h1>New Purchase Request</h1>
            <p>A new request requires your review</p>
        </div>
        <div class="content">
            <h2>Procurement Team,</h2>
            <p>A new purchase request has been submitted and is awaiting your review and approval.</p>
            
            <div class="info-box">
                <div class="label">Request Title</div>
                <div class="value">{request_title}</div>
            </div>
            
            <div class="info-row">
                <span class="label">Submitted By:</span>
                <span class="value">{requester_name}</span>
            </div>
            <div class="info-row">
                <span class="label">Category:</span>
                <span class="value">{category}</span>
            </div>
            <div class="info-row">
                <span class="label">Estimated Value:</span>
                <span class="value">{value_display}</span>
            </div>
            
            <div style="text-align: center;">
                <span class="status-badge status-warning">Pending Review</span>
            </div>
            
            <div style="text-align: center;">
                <a href="{app_url}/login" class="button">Review Request</a>
            </div>
        </div>
        <div class="footer">
            <p><strong>ProcuraHub</strong> - Procurement Management System</p>
            <p>This is an automated notification. Please do not reply to this email.</p>
        </div>
    """
    
    return get_base_template(content, "New Purchase Request - ProcuraHub")


def new_request_for_finance_email(
    requester_name: str,
    request_title: str,
    proposed_budget: Decimal,
    currency: str,
    procurement_notes: Optional[str],
    app_url: str = "http://localhost:5173"
) -> str:
    """Email template for notifying finance of approved request."""
    
    notes_section = ""
    if procurement_notes:
        notes_section = f"""
            <div class="divider"></div>
            <p><strong>Procurement Notes:</strong></p>
            <p style="font-size: 14px;">{procurement_notes}</p>
        """
    
    content = f"""
        <div class="header">
            <h1>Finance Approval Required</h1>
            <p>A request needs budget approval</p>
        </div>
        <div class="content">
            <h2>Finance Team,</h2>
            <p>A purchase request has been approved by procurement and now requires your financial review and budget allocation.</p>
            
            <div class="info-box">
                <div class="label">Request Title</div>
                <div class="value">{request_title}</div>
            </div>
            
            <div class="info-row">
                <span class="label">Requested By:</span>
                <span class="value">{requester_name}</span>
            </div>
            <div class="info-row">
                <span class="label">Proposed Budget:</span>
                <span class="value">{proposed_budget:,.2f} {currency}</span>
            </div>
            
            {notes_section}
            
            <div style="text-align: center;">
                <span class="status-badge status-warning">Pending Finance Approval</span>
            </div>
            
            <div style="text-align: center;">
                <a href="{app_url}/login" class="button">Review & Approve Budget</a>
            </div>
        </div>
        <div class="footer">
            <p><strong>ProcuraHub</strong> - Procurement Management System</p>
            <p>This is an automated notification. Please do not reply to this email.</p>
        </div>
    """
    
    return get_base_template(content, "Finance Approval Required - ProcuraHub")


def quotation_submitted_email(
    procurement_staff: str,
    supplier_name: str,
    rfq_title: str,
    app_url: str = "http://localhost:5173"
) -> str:
    """Email template for notifying procurement of new quotation."""
    
    content = f"""
        <div class="header">
            <h1>New Quotation Received</h1>
            <p>A supplier has submitted a quotation</p>
        </div>
        <div class="content">
            <h2>Hello {procurement_staff},</h2>
            <p>A new quotation has been submitted for your review.</p>
            
            <div class="info-box">
                <div class="label">RFQ Title</div>
                <div class="value">{rfq_title}</div>
            </div>
            
            <div class="info-row">
                <span class="label">Supplier:</span>
                <span class="value">{supplier_name}</span>
            </div>
            
            <div style="text-align: center;">
                <span class="status-badge status-info">New Quotation</span>
            </div>
            
            <div style="text-align: center;">
                <a href="{app_url}/login" class="button">Review Quotation</a>
            </div>
        </div>
        <div class="footer">
            <p><strong>ProcuraHub</strong> - Procurement Management System</p>
            <p>This is an automated notification. Please do not reply to this email.</p>
        </div>
    """
    
    return get_base_template(content, "New Quotation Received - ProcuraHub")


def new_message_email(
    recipient_name: str,
    sender_name: str,
    subject: str,
    message_content: str,
    supplier_name: str,
    app_url: str = "http://localhost:5173"
) -> str:
    """Email template for new message notification to suppliers."""
    
    content = f"""
        <div class="content">
            <h2>New Message Received</h2>
            
            <p>Hello {recipient_name},</p>
            
            <p>You have received a new message from <strong>{sender_name}</strong> regarding <strong>{supplier_name}</strong>.</p>
            
            <div class="info-box">
                <div class="label">Subject</div>
                <div class="value">{subject}</div>
            </div>
            
            <div class="info-box">
                <div class="label">Message</div>
                <div class="value" style="white-space: pre-wrap;">{message_content}</div>
            </div>
            
            <div style="text-align: center; margin-top: 24px;">
                <a href="{app_url}/login" class="button">View Message in ProcuraHub</a>
            </div>
        </div>
        <div class="footer">
            <p><strong>ProcuraHub</strong> - Procurement Management System</p>
            <p>This is an automated notification. Please do not reply to this email.</p>
        </div>
    """
    
    return get_base_template(content, "New Message - ProcuraHub")
