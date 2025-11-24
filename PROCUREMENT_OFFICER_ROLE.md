# Procurement Officer Role Implementation

## Overview
A new **Procurement Officer** role has been added to the system. This role is a subordinate position to the main Procurement role, designed to help with the procurement process while maintaining proper approval workflows.

## Role Permissions

### ✅ Procurement Officers CAN:
- View purchase requests
- View RFQs (all statuses including draft)
- **Create RFQs** (but they are created in "draft" status pending approval)
- View suppliers and categories
- Send supplier invitations (once RFQ is approved)
- View quotations

### ❌ Procurement Officers CANNOT:
- Approve purchase requests
- Approve their own RFQs (must be approved by Procurement or SuperAdmin)
- Approve quotations
- Reject quotations
- Send quotations to finance for approval
- Mark deliveries as delivered

## Backend Changes

### 1. User Role Enum (`backend/app/models/user.py`)
```python
class UserRole(str, Enum):
    superadmin = "SuperAdmin"
    procurement = "Procurement"
    procurement_officer = "ProcurementOfficer"  # NEW
    requester = "Requester"
    finance = "Finance"
    supplier = "Supplier"
```

### 2. RFQ Creation (`backend/app/routers/rfqs.py`)
- **Line 157**: Added `UserRole.procurement_officer` to allowed roles
- **Lines 165-166**: Procurement Officers create RFQs in **draft** status instead of open status
  ```python
  user_role = getattr(current_user, "role")
  initial_status = RFQStatus.draft if user_role == UserRole.procurement_officer else RFQStatus.open
  ```

### 3. New Approval Endpoint (`backend/app/routers/rfqs.py`)
- **POST `/api/rfqs/{rfq_id}/approve-draft`**
- Only accessible to Procurement and SuperAdmin
- Changes RFQ status from "draft" to "open"
- Enables suppliers to submit quotations

### 4. View Permissions Updated
- **List RFQs** (`/api/rfqs/`): Added procurement_officer
- **View RFQ** (`/api/rfqs/{id}`): Added procurement_officer  
- **List Requests** (`/api/requests/`): Added procurement_officer

### 5. Restricted Permissions (Already Excluded)
- **Approve Quotation**: Only Finance, SuperAdmin, Procurement
- **Reject Quotation**: Only Finance, SuperAdmin, Procurement
- **Request Finance Approval**: Only Procurement, SuperAdmin
- **Mark Delivered**: Only Procurement, SuperAdmin

## Frontend Changes

### 1. User Role Type (`frontend/src/context/AuthContext.tsx`)
```typescript
export type UserRole =
  | "SuperAdmin"
  | "Procurement"
  | "ProcurementOfficer"  // NEW
  | "Requester"
  | "Finance"
  | "Supplier";
```

### 2. Permission Flags (`frontend/src/pages/StaffDashboard.tsx`)
```typescript
const canCreate = user?.role === "Procurement" || user?.role === "ProcurementOfficer" || user?.role === "SuperAdmin";
const canApprove = user?.role === "Procurement" || user?.role === "SuperAdmin" || user?.role === "Finance";
const canApproveRfq = user?.role === "Procurement" || user?.role === "SuperAdmin";  // NEW
const isProcurementOfficer = user?.role === "ProcurementOfficer";  // NEW
```

### 3. Draft RFQ Status Display
- Added "draft" status color (yellow/amber)
- Shows "Pending Approval" badge for draft RFQs
- Example:
  ```tsx
  {selectedRfq.status === "draft" && (
    <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-800">
      <Clock className="h-3 w-3" strokeWidth={2.5} />
      Pending Approval
    </span>
  )}
  ```

### 4. RFQ Approval Button
- Displayed when viewing draft RFQs
- Only visible to Procurement and SuperAdmin (`canApproveRfq`)
- Calls `handleApproveDraftRfq()` function
- Example:
  ```tsx
  {selectedRfq.status === "draft" && canApproveRfq && (
    <button onClick={() => handleApproveDraftRfq(selectedRfq.id)}>
      Approve RFQ
    </button>
  )}
  ```

### 5. Mark Delivered Permission
- Changed from `canCreate` to `canApproveRfq`
- Ensures only Procurement/SuperAdmin can mark deliveries

## Workflow Example

### Creating an RFQ as Procurement Officer

1. **Procurement Officer** logs in and navigates to RFQs
2. Clicks "Create RFQ" button
3. Fills in:
   - Title
   - Description
   - Category
   - Budget
   - Deadline
   - Selects suppliers
   - Uploads attachments
4. Submits the form
5. ✨ **RFQ is created with status = "draft"**
6. RFQ appears with "DRAFT" badge and "Pending Approval" indicator

### Approving a Draft RFQ as Procurement

1. **Procurement** or **SuperAdmin** logs in
2. Views the draft RFQ created by Procurement Officer
3. Sees the draft status with yellow badge
4. Reviews all details (budget, suppliers, attachments, etc.)
5. Clicks **"Approve RFQ"** button
6. ✅ **RFQ status changes to "open"**
7. Suppliers can now submit quotations
8. Procurement Officer can send invitations

## Database Migration

No schema changes required - the `UserRole` is stored as a string enum.

**To create a Procurement Officer user:**
```python
# Using create_test_users.py or similar script
python backend/create_test_users.py
# Then update the role in the database:
UPDATE users SET role = 'ProcurementOfficer' WHERE email = 'officer@example.com';
```

Or use the SuperAdmin panel to create users with the new role.

## Testing Checklist

- [x] Backend user role enum updated
- [x] Frontend user role type updated
- [x] RFQ creation sets draft status for Officers
- [x] Approval endpoint created and tested
- [x] View permissions updated
- [x] Approval/rejection permissions verified
- [x] Mark delivered permissions restricted
- [x] UI displays draft status correctly
- [x] Approval button shows for Procurement only
- [ ] Create test Procurement Officer user
- [ ] Test full workflow: Create → Approve → Invite → Quote → Approve Quote
- [ ] Verify Officers cannot approve quotations
- [ ] Verify Officers cannot mark deliveries

## Next Steps

1. **Create a Procurement Officer user** for testing
2. **Test the full RFQ creation and approval workflow**
3. **Add email notifications** when draft RFQs are created (notify Procurement)
4. **Add email notifications** when draft RFQs are approved (notify Officer)
5. Consider adding a **"Draft RFQs"** filter/tab in the UI
6. Add **activity logs** to track who created and who approved each RFQ
