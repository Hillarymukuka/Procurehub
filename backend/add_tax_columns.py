#!/usr/bin/env python3
"""
Migration script to add tax_type and tax_amount columns to quotations table.
Run this script to update the existing database schema.
"""
import sqlite3
from pathlib import Path

def add_tax_columns():
    """Add tax_type and tax_amount columns to rfq_quotations table."""
    
    # Database path - try both possible locations
    db_path = Path(__file__).parent / "backend" / "procurahub.db"
    if not db_path.exists():
        db_path = Path(__file__).parent / "procurahub.db"
    
    if not db_path.exists():
        print(f"❌ Database not found at: {db_path}")
        return False
    
    print(f"📂 Connecting to database: {db_path}")
    
    try:
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()
        
        # Check if columns already exist
        cursor.execute("PRAGMA table_info(rfq_quotations)")
        columns = [column[1] for column in cursor.fetchall()]
        
        changes_made = False
        
        # Add tax_type column if it doesn't exist
        if 'tax_type' not in columns:
            print("➕ Adding 'tax_type' column...")
            cursor.execute("""
                ALTER TABLE rfq_quotations 
                ADD COLUMN tax_type VARCHAR(10)
            """)
            changes_made = True
            print("✅ 'tax_type' column added successfully")
        else:
            print("ℹ️  'tax_type' column already exists")
        
        # Add tax_amount column if it doesn't exist
        if 'tax_amount' not in columns:
            print("➕ Adding 'tax_amount' column...")
            cursor.execute("""
                ALTER TABLE rfq_quotations 
                ADD COLUMN tax_amount NUMERIC(14, 2) DEFAULT 0
            """)
            changes_made = True
            print("✅ 'tax_amount' column added successfully")
        else:
            print("ℹ️  'tax_amount' column already exists")
        
        if changes_made:
            conn.commit()
            print("\n✅ Database migration completed successfully!")
        else:
            print("\n✅ Database already up to date - no changes needed")
        
        # Verify the changes
        cursor.execute("PRAGMA table_info(rfq_quotations)")
        columns = cursor.fetchall()
        print("\n📊 Current rfq_quotations table schema:")
        for col in columns:
            print(f"   - {col[1]} ({col[2]})")
        
        conn.close()
        return True
        
    except sqlite3.Error as e:
        print(f"❌ Database error: {e}")
        return False
    except Exception as e:
        print(f"❌ Unexpected error: {e}")
        return False

if __name__ == "__main__":
    print("=" * 60)
    print("  Tax Columns Migration Script")
    print("  Adding tax_type and tax_amount to quotations table")
    print("=" * 60)
    print()
    
    success = add_tax_columns()
    
    if success:
        print("\n" + "=" * 60)
        print("  Migration completed successfully!")
        print("  You can now restart your backend server.")
        print("=" * 60)
    else:
        print("\n" + "=" * 60)
        print("  Migration failed. Please check the errors above.")
        print("=" * 60)
