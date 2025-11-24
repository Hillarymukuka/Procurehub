"""Message models for communication between procurement and suppliers."""

import enum
from sqlalchemy import (
    Column,
    DateTime,
    Enum,
    ForeignKey,
    Integer,
    String,
    Text,
    func,
)
from sqlalchemy.orm import relationship

from ..database import Base


class MessageStatus(str, enum.Enum):
    sent = "sent"
    read = "read"


class Message(Base):
    __tablename__ = "messages"

    id = Column(Integer, primary_key=True, index=True)
    sender_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    recipient_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    supplier_id = Column(Integer, ForeignKey("supplier_profiles.id"), nullable=True)
    subject = Column(String(255), nullable=False)
    content = Column(Text, nullable=False)
    status = Column(Enum(MessageStatus), default=MessageStatus.sent)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    read_at = Column(DateTime(timezone=True), nullable=True)

    sender = relationship("User", foreign_keys=[sender_id], back_populates="sent_messages")
    recipient = relationship("User", foreign_keys=[recipient_id], back_populates="received_messages")
    supplier = relationship("SupplierProfile", back_populates="messages")