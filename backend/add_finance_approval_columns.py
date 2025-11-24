"""Add finance approval columns to quotations table."""

import sqlite3
from pathlib import Path

# Path to the database - it's in backend/backend/procurahub.db
db_path = Path(__file__).parent / "backend" / "procurahub.db"

print(f"Database path: {db_path}")
print(f"Exists: {db_path.exists()}")

conn = sqlite3.connect(db_path)
cursor = conn.cursor()

try:
    # Add finance_approval_requested_at column
    try:
        cursor.execute("""
            ALTER TABLE rfq_quotations 
            ADD COLUMN finance_approval_requested_at DATETIME
        """)
        print("✓ Added finance_approval_requested_at column")
    except sqlite3.OperationalError as e:
        if "duplicate column name" in str(e).lower():
            print("✓ finance_approval_requested_at column already exists")
        else:
            raise

    # Add finance_approval_requested_by_id column
    try:
        cursor.execute("""
            ALTER TABLE rfq_quotations 
            ADD COLUMN finance_approval_requested_by_id INTEGER
        """)
        print("✓ Added finance_approval_requested_by_id column")
    except sqlite3.OperationalError as e:
        if "duplicate column name" in str(e).lower():
            print("✓ finance_approval_requested_by_id column already exists")
        else:
            raise

    conn.commit()
    print("\n✅ Migration completed successfully!")

except Exception as e:
    conn.rollback()
    print(f"\n❌ Migration failed: {e}")
    raise

finally:
    conn.close()
