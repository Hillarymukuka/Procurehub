"""
Demo Data Setup Script
Creates sample users, categories, and data for testing the new features.
"""

import requests
import json
from datetime import datetime, timedelta

BASE_URL = "http://localhost:8000"

def get_admin_token():
    """Login as SuperAdmin and get token."""
    response = requests.post(
        f"{BASE_URL}/api/auth/token",
        data={
            "username": "admin@procurahub.local",
            "password": "admin123"
        }
    )
    return response.json()["access_token"]


def create_sample_categories(headers):
    """Create sample procurement categories."""
    categories = [
        {
            "name": "IT Equipment",
            "description": "Computers, servers, networking equipment, software licenses"
        },
        {
            "name": "Office Supplies",
            "description": "Stationery, paper, pens, furniture, office accessories"
        },
        {
            "name": "Consulting Services",
            "description": "Professional services, advisory, training, auditing"
        },
        {
            "name": "Construction Materials",
            "description": "Building materials, cement, steel, tools"
        },
        {
            "name": "Maintenance Services",
            "description": "Facility maintenance, repairs, cleaning services"
        },
        {
            "name": "Marketing & Advertising",
            "description": "Branding, digital marketing, printing, promotional materials"
        }
    ]
    
    print("\n📁 Creating Sample Categories...")
    print("=" * 60)
    
    for cat in categories:
        try:
            response = requests.post(
                f"{BASE_URL}/api/admin/categories",
                headers=headers,
                json=cat
            )
            if response.status_code == 201:
                print(f"✅ Created: {cat['name']}")
            elif response.status_code == 400:
                print(f"⚠️  Already exists: {cat['name']}")
        except Exception as e:
            print(f"❌ Error creating {cat['name']}: {e}")


def create_sample_users(headers):
    """Create sample users with different roles."""
    users = [
        {
            "email": "jane.procurement@procurahub.local",
            "full_name": "Jane Smith",
            "password": "password123",
            "role": "Procurement"
        },
        {
            "email": "john.procurement@procurahub.local",
            "full_name": "John Doe",
            "password": "password123",
            "role": "Procurement"
        },
        {
            "email": "sarah.finance@procurahub.local",
            "full_name": "Sarah Johnson",
            "password": "password123",
            "role": "Finance"
        },
        {
            "email": "mike.finance@procurahub.local",
            "full_name": "Mike Williams",
            "password": "password123",
            "role": "Finance"
        },
        {
            "email": "lisa.requester@procurahub.local",
            "full_name": "Lisa Brown",
            "password": "password123",
            "role": "Requester"
        },
        {
            "email": "david.requester@procurahub.local",
            "full_name": "David Miller",
            "password": "password123",
            "role": "Requester"
        }
    ]
    
    print("\n👥 Creating Sample Users...")
    print("=" * 60)
    
    for user in users:
        try:
            response = requests.post(
                f"{BASE_URL}/api/admin/users",
                headers=headers,
                json=user
            )
            if response.status_code == 201:
                print(f"✅ Created: {user['full_name']} ({user['role']})")
            elif response.status_code == 400:
                print(f"⚠️  Already exists: {user['full_name']}")
        except Exception as e:
            print(f"❌ Error creating {user['full_name']}: {e}")


def create_sample_rfqs(headers):
    """Create sample RFQs."""
    # Use datetime string format that the API expects
    deadline = (datetime.now() + timedelta(days=30)).strftime("%Y-%m-%dT%H:%M:%S")
    
    rfqs = [
        {
            "title": "Office Laptops Procurement",
            "description": "Need 20 laptops for new employees. Specs: i5/16GB/512GB SSD",
            "category": "IT Equipment",
            "budget": 25000,
            "currency": "USD",
            "deadline": deadline
        },
        {
            "title": "Annual Office Stationery Supply",
            "description": "Bulk order for office supplies for the entire year",
            "category": "Office Supplies",
            "budget": 5000,
            "currency": "USD",
            "deadline": deadline
        },
        {
            "title": "IT Consulting Services",
            "description": "Need consultant for digital transformation project",
            "category": "Consulting Services",
            "budget": 15000,
            "currency": "USD",
            "deadline": deadline
        }
    ]
    
    print("\n📝 Creating Sample RFQs...")
    print("=" * 60)
    
    for rfq in rfqs:
        try:
            response = requests.post(
                f"{BASE_URL}/api/rfqs/",  # Added trailing slash
                headers=headers,
                json=rfq
            )
            if response.status_code == 201:
                print(f"✅ Created: {rfq['title']}")
            elif response.status_code == 401:
                print(f"⚠️  Authentication issue for: {rfq['title']}")
                print(f"    Response: {response.json()}")
            else:
                print(f"⚠️  Issue: {rfq['title']} - Status {response.status_code}")
                try:
                    print(f"    Response: {response.json()}")
                except:
                    print(f"    Response: {response.text}")
        except Exception as e:
            print(f"❌ Error creating {rfq['title']}: {e}")


def show_summary(headers):
    """Show summary of created data."""
    print("\n" + "=" * 60)
    print("📊 SETUP SUMMARY")
    print("=" * 60)
    
    # Count users
    users_response = requests.get(f"{BASE_URL}/api/admin/users", headers=headers)
    users_count = len(users_response.json()) if users_response.status_code == 200 else 0
    
    # Count categories
    cats_response = requests.get(f"{BASE_URL}/api/admin/categories", headers=headers)
    cats_count = len(cats_response.json()) if cats_response.status_code == 200 else 0
    
    # Count RFQs
    rfqs_response = requests.get(f"{BASE_URL}/api/rfqs", headers=headers)
    rfqs_count = len(rfqs_response.json()) if rfqs_response.status_code == 200 else 0
    
    print(f"\n👥 Total Users: {users_count}")
    print(f"📁 Total Categories: {cats_count}")
    print(f"📝 Total RFQs: {rfqs_count}")
    
    print("\n🎉 Demo data setup complete!")
    print("\n💡 Next Steps:")
    print("   1. Visit http://localhost:5173")
    print("   2. Login as admin@procurahub.local / admin123")
    print("   3. Explore the Users, Suppliers, and Categories tabs")
    print("   4. Try the currency toggle (USD $ | ZMW K)")
    print("   5. View the sample RFQs")
    print("\n📚 Test Accounts:")
    print("   - jane.procurement@procurahub.local / password123 (Procurement)")
    print("   - sarah.finance@procurahub.local / password123 (Finance)")
    print("   - lisa.requester@procurahub.local / password123 (Requester)")
    print("\n" + "=" * 60)


def main():
    """Main setup function."""
    print("\n" + "=" * 60)
    print("🚀 ProcuraHub Demo Data Setup")
    print("=" * 60)
    
    try:
        # Get admin token
        print("\n🔐 Logging in as SuperAdmin...")
        token = get_admin_token()
        headers = {"Authorization": f"Bearer {token}"}
        print("✅ Login successful!")
        
        # Create sample data
        create_sample_categories(headers)
        create_sample_users(headers)
        create_sample_rfqs(headers)
        
        # Show summary
        show_summary(headers)
        
    except requests.exceptions.ConnectionError:
        print("\n❌ ERROR: Cannot connect to backend server!")
        print("   Make sure the backend is running on http://localhost:8000")
        print(r"   Run: cd backend && .\.venv\Scripts\python.exe -m uvicorn app.main:app --reload")
    except Exception as e:
        print(f"\n❌ ERROR: {e}")
        import traceback
        traceback.print_exc()


if __name__ == "__main__":
    main()
