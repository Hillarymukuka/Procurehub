# Quick Start - Head of Department Workflow

## Immediate Steps to Get Started

### 1. Run the Database Migration

```bash
cd backend
python migrate_add_hod_workflow.py
```

Expected output:
```
Starting HOD workflow migration...
✓ Added head_of_department_id column to departments table
✓ Added hod_reviewer_id column to purchase_requests table
✓ Added hod_reviewed_at column to purchase_requests table
✓ Added hod_notes column to purchase_requests table
✓ Added hod_rejection_reason column to purchase_requests table
✓ Migrated X existing requests to pending_hod status
✅ HOD workflow migration completed successfully!
```

### 2. Create or Update HOD Users

#### Option A: Using SuperAdmin Dashboard (Recommended)
1. Login as SuperAdmin
2. Go to Admin panel → Users
3. Create new user with role "HeadOfDepartment"
4. Or update existing user's role to "HeadOfDepartment"

#### Option B: Using Database Directly
```sql
-- Example: Make John Smith the Head of IT Department
UPDATE users 
SET role = 'HeadOfDepartment' 
WHERE email = 'john.smith@company.com';

-- Assign John to IT Department
UPDATE departments 
SET head_of_department_id = (
    SELECT id FROM users WHERE email = 'john.smith@company.com'
) 
WHERE name = 'Information Technology';
```

#### Option C: Create Test HOD User via Script
```python
# Create a test HOD user
from app.database import SessionLocal
from app.models import User, Department, UserRole
from app.services.auth import get_password_hash

db = SessionLocal()

# Create HOD user
hod_user = User(
    email="hod.it@company.com",
    full_name="IT Department Head",
    hashed_password=get_password_hash("ChangeMe123!"),
    role=UserRole.head_of_department,
    is_active=True
)
db.add(hod_user)
db.commit()
db.refresh(hod_user)

# Assign to IT department
it_dept = db.query(Department).filter(Department.name == "Information Technology").first()
if it_dept:
    it_dept.head_of_department_id = hod_user.id
    db.commit()

print(f"✓ Created HOD user: {hod_user.email}")
print(f"✓ Assigned to department: {it_dept.name}")

db.close()
```

### 3. Test the New Workflow

#### Test 1: Requester Creates Request
```bash
# Login as requester
# Create a purchase request
# Expected: Status = "pending_hod"
```

#### Test 2: HOD Reviews Request
```bash
# Login with HOD credentials (created in step 2)
# You should see:
# - Dashboard showing requests from your department
# - Requests with status "Pending HOD Review"
# - Options to Approve or Reject

# Test Approve:
PUT /api/requests/{id}/hod-approve
{
  "hod_notes": "Approved for procurement review"
}
# Expected: Status changes to "pending_procurement"

# Test Reject:
PUT /api/requests/{id}/hod-reject
{
  "reason": "Budget not justified",
  "hod_notes": "Please provide more details"
}
# Expected: Status changes to "rejected_by_hod"
```

#### Test 3: Procurement Processes Request
```bash
# Login as procurement
# You should see requests with status "pending_procurement"
# (These are requests approved by HOD)

# Approve request:
PUT /api/requests/{id}/approve
{
  "budget_amount": 50000,
  "budget_currency": "ZMW",
  "procurement_notes": "Budget approved, proceeding with RFQ"
}
# Expected: Status changes to "rfq_issued"
```

### 4. Update Frontend (Required)

The frontend needs to be updated to support the new workflow. Here's what you need:

#### Create HOD Dashboard Component

**File**: `frontend/src/pages/HODDashboard.tsx`

```tsx
import React, { useEffect, useState } from 'react';
import { apiClient } from '../utils/client';
import { PurchaseRequest } from '../utils/types';

const HODDashboard: React.FC = () => {
  const [requests, setRequests] = useState<PurchaseRequest[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadRequests();
  }, []);

  const loadRequests = async () => {
    try {
      const { data } = await apiClient.get<PurchaseRequest[]>('/api/requests/');
      setRequests(data);
    } catch (error) {
      console.error('Failed to load requests:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (requestId: number) => {
    try {
      await apiClient.put(`/api/requests/${requestId}/hod-approve`, {
        hod_notes: 'Approved by HOD'
      });
      await loadRequests();
    } catch (error) {
      console.error('Failed to approve request:', error);
    }
  };

  const handleReject = async (requestId: number, reason: string) => {
    try {
      await apiClient.put(`/api/requests/${requestId}/hod-reject`, {
        reason: reason,
        hod_notes: reason
      });
      await loadRequests();
    } catch (error) {
      console.error('Failed to reject request:', error);
    }
  };

  const pendingRequests = requests.filter(r => r.status === 'pending_hod');

  if (loading) return <div>Loading...</div>;

  return (
    <div className="container mx-auto p-6">
      <h1 className="text-2xl font-bold mb-6">Head of Department Dashboard</h1>
      
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-xl font-semibold mb-4">
          Pending Requests ({pendingRequests.length})
        </h2>
        
        {pendingRequests.length === 0 ? (
          <p className="text-gray-500">No pending requests</p>
        ) : (
          <div className="space-y-4">
            {pendingRequests.map(request => (
              <div key={request.id} className="border rounded p-4">
                <h3 className="font-semibold">{request.title}</h3>
                <p className="text-sm text-gray-600">{request.description}</p>
                <p className="text-sm mt-2">
                  <span className="font-medium">Requester:</span> {request.requester_name}
                </p>
                <p className="text-sm">
                  <span className="font-medium">Category:</span> {request.category}
                </p>
                <div className="mt-4 flex gap-2">
                  <button
                    onClick={() => handleApprove(request.id)}
                    className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700"
                  >
                    Approve
                  </button>
                  <button
                    onClick={() => {
                      const reason = prompt('Rejection reason:');
                      if (reason) handleReject(request.id, reason);
                    }}
                    className="bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700"
                  >
                    Reject
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default HODDashboard;
```

#### Update App Routing

**File**: `frontend/src/App.tsx`

Add this route:
```tsx
import HODDashboard from './pages/HODDashboard';

// Inside your Routes:
{user?.role === "HeadOfDepartment" && (
  <Route path="/hod-dashboard" element={<HODDashboard />} />
)}
```

#### Update Navigation

**File**: `frontend/src/components/Navigation.tsx` (or wherever navigation is)

Add HOD link:
```tsx
{user?.role === "HeadOfDepartment" && (
  <Link to="/hod-dashboard">HOD Dashboard</Link>
)}
```

### 5. Restart Services

```bash
# Stop current services
# Ctrl+C in both terminal windows

# Restart backend
cd backend
.venv\Scripts\python.exe -m uvicorn app.main:app --reload

# Restart frontend
cd frontend
npm run dev
```

## Quick Verification

### ✅ Backend is Working
```bash
# Check migration completed
cd backend
python -c "from app.database import SessionLocal; from app.models import Department; db = SessionLocal(); dept = db.query(Department).first(); print(f'Has HOD column: {hasattr(dept, \"head_of_department_id\")}')"
```

### ✅ New Endpoints are Available
```bash
# Test HOD endpoints exist (will return 401 without auth)
curl -X PUT http://localhost:8000/api/requests/1/hod-approve
# Expected: 401 Unauthorized (good - endpoint exists)
```

### ✅ New User Role Works
```bash
# Check if HeadOfDepartment role is recognized
cd backend
python -c "from app.models import UserRole; print('HeadOfDepartment' in [r.value for r in UserRole])"
# Expected: True
```

## Common Issues & Solutions

### Issue 1: Migration fails with "column already exists"
**Solution**: This is OK - it means the migration was already run. Columns are safely added.

### Issue 2: Can't login as HOD user
**Solution**: 
1. Verify user role is exactly "HeadOfDepartment" (case-sensitive)
2. Check user is assigned to at least one department
3. Verify user is active

### Issue 3: HOD sees no requests
**Solution**:
1. Verify HOD is assigned to department: `SELECT * FROM departments WHERE head_of_department_id = ?`
2. Verify there are requests for that department with status 'pending_hod'
3. Check HOD user ID matches the department's `head_of_department_id`

### Issue 4: Finance dashboard still appears
**Solution**: The Finance role is deprecated but not removed. You can:
1. Hide Finance navigation in frontend
2. Remove Finance users from the system
3. Change Finance users to other roles

## What Changed Summary

| Old Flow | New Flow |
|----------|----------|
| Requester → Procurement → Finance → RFQ | Requester → **HOD** → Procurement → RFQ |
| 3 approval steps | 2 approval steps |
| Finance sets budget | Procurement sets budget |
| Status: `pending_procurement` → `pending_finance` → `finance_approved` → `rfq_issued` | Status: `pending_hod` → `pending_procurement` → `rfq_issued` |

## Next Steps

1. ✅ Complete migration
2. ✅ Create HOD users
3. ✅ Assign HODs to departments
4. ✅ Test request approval flow
5. 🔲 Update frontend dashboard
6. 🔲 Update navigation
7. 🔲 Update status labels and colors
8. 🔲 Remove Finance references from UI
9. 🔲 Test end-to-end workflow
10. 🔲 Train users on new process

## Need Help?

- Check `HOD_WORKFLOW_IMPLEMENTATION.md` for detailed documentation
- Review backend changes in `backend/app/routers/requests.py`
- Check model changes in `backend/app/models/`
- Test API endpoints using the Swagger docs at `http://localhost:8000/docs`

---

**Quick Test Command**:
```bash
# After migration, test that you can create an HOD user
cd backend
python -c "
from app.models import UserRole
from app.database import SessionLocal
from app.models import User
from app.services.auth import get_password_hash

db = SessionLocal()
test_hod = User(
    email='test.hod@test.com',
    full_name='Test HOD',
    hashed_password=get_password_hash('Test123!'),
    role=UserRole.head_of_department
)
db.add(test_hod)
db.commit()
print(f'✓ Created test HOD: {test_hod.email}')
db.close()
"
```

This creates a test HOD user you can use immediately!
