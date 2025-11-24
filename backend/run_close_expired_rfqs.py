"""Run the close_expired_rfqs function to close and unlock RFQs past their deadline."""

import sys
import os

# Add parent directory to path to import from app
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.database import SessionLocal
from app.services.rfq import close_expired_rfqs

def main():
    db = SessionLocal()
    try:
        print("Running close_expired_rfqs...")
        print(f"Checking for RFQs past their deadline...\n")
        
        closed_count = close_expired_rfqs(db)
        db.commit()
        
        if closed_count > 0:
            print(f"✓ Closed and unlocked {closed_count} expired RFQ(s)")
        else:
            print("No expired RFQs found")
            
    except Exception as e:
        print(f"Error: {e}")
        import traceback
        traceback.print_exc()
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    main()
