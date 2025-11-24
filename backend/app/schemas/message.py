from datetime import datetime
from typing import Optional
from pydantic import BaseModel
from enum import Enum


class MessageStatusEnum(str, Enum):
    sent = "sent"
    read = "read"


class MessageCreate(BaseModel):
    recipient_id: int
    supplier_id: int
    subject: str
    content: str


class MessageResponse(BaseModel):
    id: int
    sender_id: int
    sender_name: str
    recipient_id: int
    recipient_name: str
    supplier_id: int
    supplier_name: str
    subject: str
    content: str
    status: MessageStatusEnum
    created_at: datetime
    read_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class MessageListResponse(BaseModel):
    messages: list[MessageResponse]
    total_count: int
    unread_count: int

    class Config:
        from_attributes = True