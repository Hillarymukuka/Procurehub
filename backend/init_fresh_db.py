"""Initialize fresh database with superadmin user."""

from app.database import SessionLocal, Base, engine
from app.models.user import User
from app.utils.security import get_password_hash
from app.utils.migrations import run_startup_migrations

def init_fresh_db():
    """Initialize a fresh database with superadmin user."""
    print("🔄 Creating fresh database...")
    
    # Create all tables
    Base.metadata.create_all(bind=engine)
    
    # Run any startup migrations
    run_startup_migrations(engine)
    
    # Create database session
    db = SessionLocal()
    
    try:
        # Create superadmin user
        superadmin = User(
            email="admin@procurahub.local",
            full_name="System Administrator", 
            hashed_password=get_password_hash("admin123"),
            role="superadmin",
            is_active=True
        )
        
        db.add(superadmin)
        db.commit()
        
        print("✅ Fresh database created successfully!")
        print("=" * 50)
        print("   Superadmin Email: admin@procurahub.local")
        print("   Superadmin Password: admin123")
        print("=" * 50)
        print("\n🌐 You can now login at: http://localhost:5173")
        
        # Verify user was created
        user_count = db.query(User).count()
        print(f"\n📊 Total users in database: {user_count}")
        
    except Exception as e:
        print(f"❌ Error initializing database: {e}")
        db.rollback()
        raise
    finally:
        db.close()

if __name__ == "__main__":
    init_fresh_db()