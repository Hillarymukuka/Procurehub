"""Create test users."""

from app.database import SessionLocal
from app.models.user import User
from app.utils.security import get_password_hash

def create_test_users():
    """Create test users."""
    db = SessionLocal()
    
    try:
        # Test Admin
        admin = User(
            email="admin@test.com",
            full_name="Test Admin",
            hashed_password=get_password_hash("admin123"),
            role="superadmin",
            is_active=True
        )
        
        # Test Supplier  
        supplier_user = User(
            email="supplier@test.com", 
            full_name="Test Supplier",
            hashed_password=get_password_hash("supplier123"),
            role="supplier",
            is_active=True
        )
        
        # Check if they already exist
        existing_admin = db.query(User).filter(User.email == "admin@test.com").first()
        existing_supplier = db.query(User).filter(User.email == "supplier@test.com").first()
        
        if not existing_admin:
            db.add(admin)
            print("✅ Created admin@test.com (password: admin123)")
        else:
            print("⚠️  admin@test.com already exists")
            
        if not existing_supplier:
            db.add(supplier_user)
            print("✅ Created supplier@test.com (password: supplier123)")
        else:
            print("⚠️  supplier@test.com already exists")
        
        db.commit()
        
        # List all users
        users = db.query(User).all()
        print("\n=== ALL USERS ===")
        for user in users:
            print(f"Email: {user.email}, Role: {user.role}, Active: {user.is_active}")
        
    except Exception as e:
        print(f"❌ Error: {e}")
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    create_test_users()