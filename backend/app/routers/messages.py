from datetime import datetime
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from ..database import get_db
from ..dependencies import get_current_user
from ..models import Message, MessageStatus, User, SupplierProfile
from ..schemas.message import MessageCreate, MessageResponse, MessageListResponse
from ..services.email import email_service
from ..services.email_templates import new_message_email

router = APIRouter(tags=["messages"])


def _get_user_full_name(user: Optional[User]) -> str:
    """Return a safe full name for the supplied user."""
    if not user:
        return "Unknown"
    return user.full_name


@router.post("/", response_model=MessageResponse)
def send_message(
    message_data: MessageCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Send a message from current user (Procurement) to a supplier user."""
    
    # Verify recipient exists
    recipient = db.query(User).filter(User.id == message_data.recipient_id).first()
    if not recipient:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Recipient not found"
        )
    
    # Verify supplier exists
    supplier = db.query(SupplierProfile).filter(SupplierProfile.id == message_data.supplier_id).first()
    if not supplier:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Supplier not found"
        )
    
    # Create the message
    message = Message(
        sender_id=current_user.id,
        recipient_id=message_data.recipient_id,
        supplier_id=message_data.supplier_id,
        subject=message_data.subject,
        content=message_data.content,
        status=MessageStatus.sent,
        created_at=datetime.utcnow()
    )
    
    db.add(message)
    db.commit()
    db.refresh(message)
    
    # Send email notification to recipient
    try:
        recipient_email = str(getattr(recipient, 'email', ''))
        if recipient_email:
            recipient_name = str(getattr(recipient, 'full_name', '')) or recipient_email
            sender_name = str(getattr(current_user, 'full_name', '')) or str(getattr(current_user, 'email', ''))
            supplier_name_str = str(getattr(supplier, 'company_name', '')) or f"Supplier #{supplier.id}"
            
            html_body = new_message_email(
                recipient_name=recipient_name,
                sender_name=sender_name,
                subject=message_data.subject,
                message_content=message_data.content,
                supplier_name=supplier_name_str,
                app_url="http://localhost:5173"
            )
            
            plain_body = (
                f"Hello {recipient_name},\n\n"
                f"You have received a new message from {sender_name} "
                f"regarding {supplier_name_str}.\n\n"
                f"Subject: {message_data.subject}\n\n"
                f"Message:\n{message_data.content}\n\n"
                f"Please log in to ProcuraHub to view and respond to this message.\n\n"
                f"Best regards,\nProcuraHub Team"
            )
            
            email_service.send_email(
                recipients=[recipient_email],
                subject=f"New Message: {message_data.subject}",
                body=plain_body,
                html_body=html_body
            )
    except Exception as e:
        # Log the error but don't fail the message creation
        print(f"Failed to send email notification: {e}")
    
    # Return formatted response
    return MessageResponse(
        id=message.id,  # type: ignore
        sender_id=message.sender_id,  # type: ignore
        sender_name=_get_user_full_name(current_user),
        recipient_id=message.recipient_id,  # type: ignore
        recipient_name=_get_user_full_name(recipient),
        supplier_id=message.supplier_id,  # type: ignore
        supplier_name=supplier.company_name,  # type: ignore
        subject=message.subject,  # type: ignore
        content=message.content,  # type: ignore
        status=message.status.value,  # type: ignore
        created_at=message.created_at,  # type: ignore
        read_at=message.read_at  # type: ignore
    )


@router.post("/reply", response_model=MessageResponse)
def reply_to_message(
    message_data: MessageCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Reply to a message - allows suppliers to respond to procurement."""
    
    # Verify recipient exists
    recipient = db.query(User).filter(User.id == message_data.recipient_id).first()
    if not recipient:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Recipient not found"
        )
    
    # Verify supplier exists
    supplier = db.query(SupplierProfile).filter(SupplierProfile.id == message_data.supplier_id).first()
    if not supplier:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Supplier not found"
        )
    
    # Create the reply message
    message = Message(
        sender_id=current_user.id,
        recipient_id=message_data.recipient_id,
        supplier_id=message_data.supplier_id,
        subject=message_data.subject,
        content=message_data.content,
        status=MessageStatus.sent,
        created_at=datetime.utcnow()
    )
    
    db.add(message)
    db.commit()
    db.refresh(message)
    
    # Send email notification to procurement recipient
    try:
        recipient_email = str(getattr(recipient, 'email', ''))
        if recipient_email:
            recipient_name = str(getattr(recipient, 'full_name', '')) or recipient_email
            sender_name = str(getattr(current_user, 'full_name', '')) or str(getattr(current_user, 'email', ''))
            supplier_name_str = str(getattr(supplier, 'company_name', '')) or f"Supplier #{supplier.id}"
            
            html_body = new_message_email(
                recipient_name=recipient_name,
                sender_name=sender_name,
                subject=message_data.subject,
                message_content=message_data.content,
                supplier_name=supplier_name_str,
                app_url="http://localhost:5173"
            )
            
            plain_body = (
                f"Hello {recipient_name},\n\n"
                f"You have received a reply from {sender_name} ({supplier_name_str}).\n\n"
                f"Subject: {message_data.subject}\n\n"
                f"Message:\n{message_data.content}\n\n"
                f"Please log in to ProcuraHub to view and respond to this message.\n\n"
                f"Best regards,\nProcuraHub Team"
            )
            
            email_service.send_email(
                recipients=[recipient_email],
                subject=f"Reply: {message_data.subject}",
                body=plain_body,
                html_body=html_body
            )
    except Exception as e:
        # Log the error but don't fail the message creation
        print(f"Failed to send email notification: {e}")
    
    # Return formatted response
    return MessageResponse(
        id=message.id,  # type: ignore
        sender_id=message.sender_id,  # type: ignore
        sender_name=_get_user_full_name(current_user),
        recipient_id=message.recipient_id,  # type: ignore
        recipient_name=_get_user_full_name(recipient),
        supplier_id=message.supplier_id,  # type: ignore
        supplier_name=supplier.company_name,  # type: ignore
        subject=message.subject,  # type: ignore
        content=message.content,  # type: ignore
        status=message.status.value,  # type: ignore
        created_at=message.created_at,  # type: ignore
        read_at=message.read_at  # type: ignore
    )


@router.get("/received", response_model=MessageListResponse)
def get_received_messages(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get all messages received by the current user."""
    
    messages_query = db.query(Message).filter(Message.recipient_id == current_user.id)
    messages = messages_query.all()
    
    # Count unread messages
    unread_count = messages_query.filter(Message.status == MessageStatus.sent).count()
    
    # Format messages
    formatted_messages = []
    for message in messages:
        sender = db.query(User).filter(User.id == message.sender_id).first()
        supplier = db.query(SupplierProfile).filter(SupplierProfile.id == message.supplier_id).first()

        formatted_messages.append(MessageResponse(
            id=message.id,  # type: ignore
            sender_id=message.sender_id,  # type: ignore
            sender_name=_get_user_full_name(sender),
            recipient_id=message.recipient_id,  # type: ignore
            recipient_name=_get_user_full_name(current_user),
            supplier_id=message.supplier_id,  # type: ignore
            supplier_name=supplier.company_name if supplier else "Unknown",  # type: ignore
            subject=message.subject,  # type: ignore
            content=message.content,  # type: ignore
            status=message.status.value,  # type: ignore
            created_at=message.created_at,  # type: ignore
            read_at=message.read_at  # type: ignore
        ))
    
    return MessageListResponse(
        messages=formatted_messages,
        total_count=len(formatted_messages),
        unread_count=unread_count
    )


@router.get("/sent", response_model=MessageListResponse)
def get_sent_messages(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get all messages sent by the current user."""
    
    messages = db.query(Message).filter(Message.sender_id == current_user.id).all()
    
    # Format messages
    formatted_messages = []
    for message in messages:
        recipient = db.query(User).filter(User.id == message.recipient_id).first()
        supplier = db.query(SupplierProfile).filter(SupplierProfile.id == message.supplier_id).first()

        formatted_messages.append(MessageResponse(
            id=message.id,  # type: ignore
            sender_id=message.sender_id,  # type: ignore
            sender_name=_get_user_full_name(current_user),
            recipient_id=message.recipient_id,  # type: ignore
            recipient_name=_get_user_full_name(recipient),
            supplier_id=message.supplier_id,  # type: ignore
            supplier_name=supplier.company_name if supplier else "Unknown",  # type: ignore
            subject=message.subject,  # type: ignore
            content=message.content,  # type: ignore
            status=message.status.value,  # type: ignore
            created_at=message.created_at,  # type: ignore
            read_at=message.read_at  # type: ignore
        ))
    
    return MessageListResponse(
        messages=formatted_messages,
        total_count=len(formatted_messages),
        unread_count=0  # Sent messages don't have unread count
    )


@router.put("/{message_id}/read", response_model=MessageResponse)
def mark_message_as_read(
    message_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Mark a message as read by the current user."""
    
    message = db.query(Message).filter(
        Message.id == message_id,
        Message.recipient_id == current_user.id
    ).first()
    
    if not message:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Message not found"
        )
    
    # Update message status and read timestamp
    message.status = MessageStatus.read
    message.read_at = datetime.utcnow()
    
    db.commit()
    db.refresh(message)
    
    # Get sender and supplier info
    sender = db.query(User).filter(User.id == message.sender_id).first()
    supplier = db.query(SupplierProfile).filter(SupplierProfile.id == message.supplier_id).first()

    return MessageResponse(
        id=message.id,  # type: ignore
        sender_id=message.sender_id,  # type: ignore
        sender_name=_get_user_full_name(sender),
        recipient_id=message.recipient_id,  # type: ignore
        recipient_name=_get_user_full_name(current_user),
        supplier_id=message.supplier_id,  # type: ignore
        supplier_name=supplier.company_name if supplier else "Unknown",  # type: ignore
        subject=message.subject,  # type: ignore
        content=message.content,  # type: ignore
        status=message.status.value,  # type: ignore
        created_at=message.created_at,  # type: ignore
        read_at=message.read_at  # type: ignore
    )


@router.get("/conversation/{supplier_id}", response_model=MessageListResponse)
def get_conversation_with_supplier(
    supplier_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get all messages in a conversation with a specific supplier."""
    
    # Verify supplier exists
    supplier = db.query(SupplierProfile).filter(SupplierProfile.id == supplier_id).first()
    if not supplier:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Supplier not found"
        )
    
    # Get all messages related to this supplier involving current user
    messages = db.query(Message).filter(
        Message.supplier_id == supplier_id,
        ((Message.sender_id == current_user.id) | (Message.recipient_id == current_user.id))
    ).order_by(Message.created_at.asc()).all()
    
    # Count unread messages (only received ones)
    unread_count = db.query(Message).filter(
        Message.supplier_id == supplier_id,
        Message.recipient_id == current_user.id,
        Message.status == MessageStatus.sent
    ).count()
    
    # Format messages
    formatted_messages = []
    for message in messages:
        sender = db.query(User).filter(User.id == message.sender_id).first()
        recipient = db.query(User).filter(User.id == message.recipient_id).first()

        formatted_messages.append(MessageResponse(
            id=message.id,  # type: ignore
            sender_id=message.sender_id,  # type: ignore
            sender_name=_get_user_full_name(sender),
            recipient_id=message.recipient_id,  # type: ignore
            recipient_name=_get_user_full_name(recipient),
            supplier_id=message.supplier_id,  # type: ignore
            supplier_name=supplier.company_name,  # type: ignore
            subject=message.subject,  # type: ignore
            content=message.content,  # type: ignore
            status=message.status.value,  # type: ignore
            created_at=message.created_at,  # type: ignore
            read_at=message.read_at  # type: ignore
        ))
    
    return MessageListResponse(
        messages=formatted_messages,
        total_count=len(formatted_messages),
        unread_count=unread_count
    )
