"""Add finance approval columns to quotations table."""

from app.database import engine, SessionLocal
from sqlalchemy import text

db = SessionLocal()

try:
    # Add finance_approval_requested_at column
    try:
        db.execute(text("""
            ALTER TABLE rfq_quotations 
            ADD COLUMN finance_approval_requested_at DATETIME
        """))
        db.commit()
        print("✓ Added finance_approval_requested_at column")
    except Exception as e:
        db.rollback()
        if "duplicate column name" in str(e).lower():
            print("✓ finance_approval_requested_at column already exists")
        else:
            print(f"Error adding finance_approval_requested_at: {e}")

    # Add finance_approval_requested_by_id column
    try:
        db.execute(text("""
            ALTER TABLE rfq_quotations 
            ADD COLUMN finance_approval_requested_by_id INTEGER
        """))
        db.commit()
        print("✓ Added finance_approval_requested_by_id column")
    except Exception as e:
        db.rollback()
        if "duplicate column name" in str(e).lower():
            print("✓ finance_approval_requested_by_id column already exists")
        else:
            print(f"Error adding finance_approval_requested_by_id: {e}")

    print("\n✅ Migration completed!")

except Exception as e:
    print(f"\n❌ Migration failed: {e}")
    raise

finally:
    db.close()
