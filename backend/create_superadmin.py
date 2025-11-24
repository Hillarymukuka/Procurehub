"""Create a SuperAdmin user for ProcuraHub."""

from app.database import SessionLocal
from app.models.user import User
from app.utils.security import get_password_hash

def create_superadmin():
    """Create a SuperAdmin user if one doesn't exist."""
    db = SessionLocal()
    
    try:
        # Check if superadmin already exists
        existing = db.query(User).filter(User.email == "admin@procurahub.local").first()
        
        if existing:
            print("⚠️  SuperAdmin already exists!")
            print(f"   Email: {existing.email}")
            print(f"   Full Name: {existing.full_name}")
            print(f"   Role: {existing.role}")
            return
        
        # Create new superadmin
        superadmin = User(
            email="admin@procurahub.local",
            full_name="System Administrator",
            hashed_password=get_password_hash("admin123"),
            role="superadmin",
            is_active=True
        )
        
        db.add(superadmin)
        db.commit()
        
        print("✅ SuperAdmin created successfully!")
        print("=" * 50)
        print("   Email: admin@procurahub.local")
        print("   Password: admin123")
        print("   Full Name: System Administrator")
        print("=" * 50)
        print("\n⚠️  IMPORTANT: Change this password in production!")
        print("\n🌐 You can now login at: http://localhost:5173")
        
    except Exception as e:
        print(f"❌ Error creating SuperAdmin: {e}")
        db.rollback()
    finally:
        db.close()


if __name__ == "__main__":
    create_superadmin()
