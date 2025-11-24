"""Add company settings table for branding and documents."""

from sqlalchemy import Column, Integer, String, Text, DateTime, func
from sqlalchemy.sql import text

from app.database import Base, engine


def upgrade():
    """Create company_settings table."""
    connection = engine.connect()
    
    # Create company_settings table
    connection.execute(text("""
        CREATE TABLE IF NOT EXISTS company_settings (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            company_name VARCHAR(255) NOT NULL,
            address_line1 VARCHAR(255),
            address_line2 VARCHAR(255),
            city VARCHAR(100),
            state VARCHAR(100),
            postal_code VARCHAR(20),
            country VARCHAR(100),
            phone VARCHAR(50),
            email VARCHAR(255),
            website VARCHAR(255),
            logo_path VARCHAR(500),
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP
        )
    """))
    
    connection.commit()
    connection.close()
    print("✅ Company settings table created successfully")


def downgrade():
    """Drop company_settings table."""
    connection = engine.connect()
    connection.execute(text("DROP TABLE IF EXISTS company_settings"))
    connection.commit()
    connection.close()
    print("✅ Company settings table dropped")


if __name__ == "__main__":
    print("Running migration: Add company settings table")
    upgrade()
