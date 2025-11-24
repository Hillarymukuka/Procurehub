"""Add budget_override_justification column to rfq_quotations table."""

import sqlite3
import os

# Try both possible database paths
db_paths = [
    os.path.join(os.path.dirname(__file__), "procurahub.db"),
    os.path.join(os.path.dirname(__file__), "backend", "procurahub.db")
]

db_path = None
for path in db_paths:
    if os.path.exists(path):
        db_path = path
        break

if not db_path:
    print("Error: Database file not found in expected locations")
    print(f"Searched: {db_paths}")
    exit(1)

print(f"Using database: {db_path}")

conn = sqlite3.connect(db_path)
cursor = conn.cursor()

try:
    # Add budget_override_justification column to rfq_quotations
    cursor.execute("""
        ALTER TABLE rfq_quotations 
        ADD COLUMN budget_override_justification TEXT
    """)
    
    conn.commit()
    print("✓ Successfully added budget_override_justification column to rfq_quotations table")
    
except sqlite3.OperationalError as e:
    if "duplicate column name" in str(e).lower():
        print("✓ Column budget_override_justification already exists")
    else:
        print(f"Error: {e}")
        conn.rollback()
finally:
    conn.close()

print("Migration complete!")
