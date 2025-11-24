"""
Migration script to add supplier_number field to supplier_profiles table
and populate existing suppliers with generated numbers.
"""
from datetime import datetime
from sqlalchemy import create_engine, Column, String, text
from sqlalchemy.orm import sessionmaker
import os
import sys

# Add parent directory to path to import app modules
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from app.config import get_settings
from app.models.supplier import SupplierProfile


def generate_supplier_number(existing_numbers: set, created_at: datetime) -> str:
    """Generate a supplier number in format SUP-YYYYMMDD-XXXX"""
    date_str = created_at.strftime("%Y%m%d")
    
    # Find the next sequence number for this date
    sequence = 1
    while True:
        supplier_number = f"SUP-{date_str}-{sequence:04d}"
        if supplier_number not in existing_numbers:
            existing_numbers.add(supplier_number)
            return supplier_number
        sequence += 1


def migrate():
    """Run the migration"""
    # Get settings
    settings = get_settings()
    
    # Create database engine
    engine = create_engine(settings.database_url)
    SessionLocal = sessionmaker(bind=engine)
    db = SessionLocal()
    
    try:
        print("Starting migration...")
        
        # Check if column already exists
        result = db.execute(text("PRAGMA table_info(supplier_profiles)"))
        columns = [row[1] for row in result]
        
        if 'supplier_number' in columns:
            print("Column 'supplier_number' already exists. Skipping migration.")
            return
        
        # Add the supplier_number column
        print("Adding supplier_number column...")
        db.execute(text(
            "ALTER TABLE supplier_profiles ADD COLUMN supplier_number VARCHAR(20)"
        ))
        db.commit()
        
        # Fetch all existing suppliers
        suppliers = db.query(SupplierProfile).order_by(SupplierProfile.id).all()
        
        if not suppliers:
            print("No existing suppliers found. Migration complete.")
            return
        
        print(f"Found {len(suppliers)} suppliers. Generating supplier numbers...")
        
        # Generate and assign supplier numbers
        existing_numbers = set()
        for supplier in suppliers:
            # Use created_at if available, otherwise use current date
            created_at = getattr(supplier, 'created_at', datetime.utcnow())
            supplier_number = generate_supplier_number(existing_numbers, created_at)
            
            supplier.supplier_number = supplier_number
            print(f"  Assigned {supplier_number} to supplier ID {supplier.id} ({supplier.company_name})")
        
        db.commit()
        
        # Add unique constraint and index
        print("Adding unique constraint and index...")
        db.execute(text(
            "CREATE UNIQUE INDEX ix_supplier_profiles_supplier_number ON supplier_profiles (supplier_number)"
        ))
        db.commit()
        
        print("Migration completed successfully!")
        
    except Exception as e:
        print(f"Error during migration: {e}")
        db.rollback()
        raise
    finally:
        db.close()


if __name__ == "__main__":
    migrate()
