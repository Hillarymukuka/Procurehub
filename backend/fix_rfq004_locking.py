"""Fix the response locking issue for RFQ004_102025."""

import sqlite3
import os
from datetime import datetime, timezone

# Database paths
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
    print("Error: Database file not found")
    exit(1)

print(f"Using database: {db_path}")

conn = sqlite3.connect(db_path)
cursor = conn.cursor()

try:
    # Find RFQ004_102025
    cursor.execute("""
        SELECT id, rfq_number, status, response_locked, deadline
        FROM rfqs
        WHERE rfq_number = 'RFQ004_102025'
    """)
    
    rfq = cursor.fetchone()
    
    if not rfq:
        print("RFQ004_102025 not found in database")
    else:
        rfq_id, rfq_number, status, response_locked, deadline = rfq
        print(f"\nCurrent RFQ Status:")
        print(f"  RFQ Number: {rfq_number}")
        print(f"  Status: {status}")
        print(f"  Response Locked: {response_locked}")
        print(f"  Deadline: {deadline}")
        
        # Check quotations
        cursor.execute("""
            SELECT COUNT(*), status
            FROM rfq_quotations
            WHERE rfq_id = ?
            GROUP BY status
        """, (rfq_id,))
        
        quotations = cursor.fetchall()
        print(f"\nQuotations:")
        if quotations:
            for count, q_status in quotations:
                print(f"  {q_status}: {count}")
        else:
            print("  No quotations found")
        
        # Fix: Unlock the response if deadline has passed
        deadline_str = deadline.replace('Z', '+00:00') if deadline.endswith('Z') else deadline
        try:
            deadline_dt = datetime.fromisoformat(deadline_str)
        except:
            # If no timezone info, assume UTC
            deadline_dt = datetime.fromisoformat(deadline_str.split('.')[0])
            deadline_dt = deadline_dt.replace(tzinfo=timezone.utc)
        
        # Make sure deadline_dt is timezone aware
        if deadline_dt.tzinfo is None:
            deadline_dt = deadline_dt.replace(tzinfo=timezone.utc)
            
        now_utc = datetime.now(timezone.utc)
        
        print(f"\nComparison:")
        print(f"  Deadline (UTC): {deadline_dt}")
        print(f"  Current Time (UTC): {now_utc}")
        print(f"  Deadline passed: {deadline_dt < now_utc}")
        
        if deadline_dt < now_utc:
            print(f"\nDeadline has passed. Unlocking responses...")
            cursor.execute("""
                UPDATE rfqs
                SET response_locked = 0
                WHERE id = ?
            """, (rfq_id,))
            
            conn.commit()
            print("✓ Response unlocked successfully!")
            print("\nUpdated RFQ Status:")
            print(f"  Response Locked: False")
        else:
            print(f"\nDeadline has not passed yet. No changes made.")
            
except sqlite3.Error as e:
    print(f"Database error: {e}")
    conn.rollback()
except Exception as e:
    print(f"Error: {e}")
    conn.rollback()
finally:
    conn.close()

print("\nDone!")
