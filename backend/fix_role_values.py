"""Fix HOD role values in database.

This script updates role values from 'UserRole.head_of_department' to 'HeadOfDepartment'
to match the enum value format.
"""
import sqlite3
from pathlib import Path

# Database path - actual location
DB_PATH = Path(__file__).parent / "backend" / "procurahub.db"

def fix_role_values():
    """Update role values to use enum values instead of enum names."""
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    
    try:
        # Get all users with old enum format
        cursor.execute("SELECT id, email, role FROM users")
        users = cursor.fetchall()
        
        role_mapping = {
            "superadmin": "SuperAdmin",
            "procurement": "Procurement",
            "procurement_officer": "ProcurementOfficer",
            "head_of_department": "HeadOfDepartment",
            "requester": "Requester",
            "finance": "Finance",
            "supplier": "Supplier",
            # Also handle old format just in case
            "UserRole.superadmin": "SuperAdmin",
            "UserRole.procurement": "Procurement",
            "UserRole.procurement_officer": "ProcurementOfficer",
            "UserRole.head_of_department": "HeadOfDepartment",
            "UserRole.requester": "Requester",
            "UserRole.finance": "Finance",
            "UserRole.supplier": "Supplier",
        }
        
        updated_count = 0
        for user_id, email, role in users:
            if role in role_mapping:
                new_role = role_mapping[role]
                cursor.execute(
                    "UPDATE users SET role = ? WHERE id = ?",
                    (new_role, user_id)
                )
                print(f"Updated user {email}: {role} -> {new_role}")
                updated_count += 1
            else:
                # Check if it already has the correct format
                if role in ["SuperAdmin", "Procurement", "ProcurementOfficer", "HeadOfDepartment", "Requester", "Finance", "Supplier"]:
                    print(f"✓ User {email} already has correct role format: {role}")
                else:
                    print(f"⚠️  Unknown role format for {email}: {role}")
        
        conn.commit()
        print(f"\n✅ Updated {updated_count} users")
        
    except Exception as e:
        print(f"❌ Error: {e}")
        conn.rollback()
    finally:
        conn.close()

if __name__ == "__main__":
    print("Fixing role values in database...\n")
    fix_role_values()
