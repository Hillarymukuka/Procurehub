"""Add timezone column to users table."""

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
    # Add timezone column to users table (default to Africa/Cairo for existing users)
    cursor.execute("""
        ALTER TABLE users 
        ADD COLUMN timezone VARCHAR(50) DEFAULT 'Africa/Cairo'
    """)
    
    conn.commit()
    print("✓ Successfully added timezone column to users table")
    print("  Default timezone set to: Africa/Cairo")
    
except sqlite3.OperationalError as e:
    if "duplicate column name" in str(e).lower():
        print("✓ Column timezone already exists")
    else:
        print(f"Error: {e}")
        conn.rollback()
finally:
    conn.close()

print("Migration complete!")
