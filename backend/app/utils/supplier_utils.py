"""Utility functions for supplier management."""

from datetime import datetime
from sqlalchemy.orm import Session
from ..models import SupplierProfile


def generate_supplier_number(db: Session) -> str:
    """
    Generate a unique supplier number in the format: SUP-YYYYMMDD-XXXX
    Where:
    - SUP is the prefix
    - YYYYMMDD is the current date
    - XXXX is a sequential number for that day
    
    Example: SUP-20251017-0001
    """
    today = datetime.now().strftime("%Y%m%d")
    prefix = f"SUP-{today}"
    
    # Find the highest number for today
    latest = (
        db.query(SupplierProfile)
        .filter(SupplierProfile.supplier_number.like(f"{prefix}%"))
        .order_by(SupplierProfile.supplier_number.desc())
        .first()
    )
    
    if latest:
        # Extract the sequence number from the last supplier number
        try:
            last_sequence = int(latest.supplier_number.split("-")[-1])
            next_sequence = last_sequence + 1
        except (ValueError, IndexError):
            next_sequence = 1
    else:
        next_sequence = 1
    
    # Format with leading zeros (4 digits)
    return f"{prefix}-{next_sequence:04d}"


def get_next_supplier_number(db: Session) -> str:
    """
    Get the next available supplier number.
    This is an alias for generate_supplier_number for clarity.
    """
    return generate_supplier_number(db)
