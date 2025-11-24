"""Manually unlock a specific RFQ's responses regardless of deadline."""

import sqlite3
import os
import sys

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

# Get RFQ number from command line or use default
rfq_number = sys.argv[1] if len(sys.argv) > 1 else "RFQ004_102025"

conn = sqlite3.connect(db_path)
cursor = conn.cursor()

try:
    # Find the RFQ
    cursor.execute("""
        SELECT id, rfq_number, status, response_locked, deadline
        FROM rfqs
        WHERE rfq_number = ?
    """, (rfq_number,))
    
    rfq = cursor.fetchone()
    
    if not rfq:
        print(f"RFQ '{rfq_number}' not found in database")
        exit(1)
    
    rfq_id, rfq_number, status, response_locked, deadline = rfq
    print(f"\nRFQ Status BEFORE:")
    print(f"  RFQ Number: {rfq_number}")
    print(f"  Status: {status}")
    print(f"  Response Locked: {bool(response_locked)}")
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
        total = 0
        for count, q_status in quotations:
            print(f"  {q_status}: {count}")
            total += count
        print(f"  TOTAL: {total}")
    else:
        print("  No quotations found")
    
    # Unlock the responses
    if response_locked:
        print(f"\n→ Unlocking responses for {rfq_number}...")
        cursor.execute("""
            UPDATE rfqs
            SET response_locked = 0
            WHERE id = ?
        """, (rfq_id,))
        
        conn.commit()
        
        print("\n✓ Successfully unlocked!")
        print(f"\nRFQ Status AFTER:")
        print(f"  Response Locked: False")
        print(f"\nProcurement can now see the {total if quotations else 0} quotation(s).")
    else:
        print(f"\n→ RFQ is already unlocked. No changes needed.")
        
except sqlite3.Error as e:
    print(f"Database error: {e}")
    conn.rollback()
except Exception as e:
    print(f"Error: {e}")
    import traceback
    traceback.print_exc()
    conn.rollback()
finally:
    conn.close()

print("\nDone!")
