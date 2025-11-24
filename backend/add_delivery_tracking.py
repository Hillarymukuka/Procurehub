"""Add delivery tracking columns to quotations table."""

import sys
from pathlib import Path

# Add the backend directory to the Python path
backend_dir = Path(__file__).parent
sys.path.insert(0, str(backend_dir))

from sqlalchemy import text
from app.database import engine

def add_delivery_tracking_columns():
    """Add delivery tracking columns to rfq_quotations table."""
    with engine.connect() as conn:
        # Check if columns already exist
        result = conn.execute(text("PRAGMA table_info(rfq_quotations)"))
        existing_columns = {row[1] for row in result}
        
        columns_to_add = {
            'delivery_status': 'VARCHAR(20)',
            'delivered_at': 'DATETIME',
            'delivery_note_path': 'VARCHAR(500)',
            'delivery_note_filename': 'VARCHAR(255)',
            'marked_delivered_by_id': 'INTEGER'
        }
        
        for column_name, column_type in columns_to_add.items():
            if column_name not in existing_columns:
                print(f"Adding column: {column_name}")
                conn.execute(text(f"ALTER TABLE rfq_quotations ADD COLUMN {column_name} {column_type}"))
                conn.commit()
            else:
                print(f"Column {column_name} already exists, skipping...")
        
        print("\n✅ Delivery tracking columns added successfully!")

if __name__ == "__main__":
    add_delivery_tracking_columns()
