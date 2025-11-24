"""Add Head of Department workflow columns to database."""
from app.database import SessionLocal
from sqlalchemy import text

db = SessionLocal()

try:
    print("Starting HOD workflow migration...")
    
    # Add head_of_department_id to departments table
    try:
        db.execute(text("""
            ALTER TABLE departments
            ADD COLUMN head_of_department_id INTEGER
        """))
        db.commit()
        print("✓ Added head_of_department_id column to departments table")
    except Exception as e:
        db.rollback()
        if "duplicate column name" in str(e).lower() or "already exists" in str(e).lower():
            print("✓ head_of_department_id column already exists in departments")
        else:
            print(f"Error adding head_of_department_id to departments: {e}")

    # Add hod_reviewer_id to purchase_requests table
    try:
        db.execute(text("""
            ALTER TABLE purchase_requests
            ADD COLUMN hod_reviewer_id INTEGER
        """))
        db.commit()
        print("✓ Added hod_reviewer_id column to purchase_requests table")
    except Exception as e:
        db.rollback()
        if "duplicate column name" in str(e).lower() or "already exists" in str(e).lower():
            print("✓ hod_reviewer_id column already exists in purchase_requests")
        else:
            print(f"Error adding hod_reviewer_id to purchase_requests: {e}")

    # Add hod_reviewed_at to purchase_requests table
    try:
        db.execute(text("""
            ALTER TABLE purchase_requests
            ADD COLUMN hod_reviewed_at DATETIME
        """))
        db.commit()
        print("✓ Added hod_reviewed_at column to purchase_requests table")
    except Exception as e:
        db.rollback()
        if "duplicate column name" in str(e).lower() or "already exists" in str(e).lower():
            print("✓ hod_reviewed_at column already exists in purchase_requests")
        else:
            print(f"Error adding hod_reviewed_at to purchase_requests: {e}")

    # Add hod_notes to purchase_requests table
    try:
        db.execute(text("""
            ALTER TABLE purchase_requests
            ADD COLUMN hod_notes TEXT
        """))
        db.commit()
        print("✓ Added hod_notes column to purchase_requests table")
    except Exception as e:
        db.rollback()
        if "duplicate column name" in str(e).lower() or "already exists" in str(e).lower():
            print("✓ hod_notes column already exists in purchase_requests")
        else:
            print(f"Error adding hod_notes to purchase_requests: {e}")

    # Add hod_rejection_reason to purchase_requests table
    try:
        db.execute(text("""
            ALTER TABLE purchase_requests
            ADD COLUMN hod_rejection_reason TEXT
        """))
        db.commit()
        print("✓ Added hod_rejection_reason column to purchase_requests table")
    except Exception as e:
        db.rollback()
        if "duplicate column name" in str(e).lower() or "already exists" in str(e).lower():
            print("✓ hod_rejection_reason column already exists in purchase_requests")
        else:
            print(f"Error adding hod_rejection_reason to purchase_requests: {e}")

    # Migrate existing requests from pending_procurement to pending_hod status
    try:
        result = db.execute(text("""
            UPDATE purchase_requests
            SET status = 'pending_hod'
            WHERE status = 'pending_procurement'
            AND hod_reviewed_at IS NULL
        """))
        db.commit()
        print(f"✓ Migrated {result.rowcount} existing requests to pending_hod status")
    except Exception as e:
        db.rollback()
        print(f"Error migrating request statuses: {e}")

    print("\n✅ HOD workflow migration completed successfully!")
    print("\nNext steps:")
    print("1. Assign Head of Department users to departments")
    print("2. Update user roles to 'HeadOfDepartment' for HOD users")
    print("3. Test the new workflow: Requester → HOD → Procurement")

except Exception as e:
    db.rollback()
    print(f"\n❌ Migration failed: {e}")
finally:
    db.close()
