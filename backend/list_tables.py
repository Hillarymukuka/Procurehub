"""List all tables in the database."""

import sqlite3
from pathlib import Path

db_path = Path(__file__).parent / "procurahub.db"
conn = sqlite3.connect(db_path)
cursor = conn.cursor()

cursor.execute("SELECT name FROM sqlite_master WHERE type='table'")
tables = cursor.fetchall()

print("Tables in database:")
for table in tables:
    print(f"  - {table[0]}")

conn.close()
