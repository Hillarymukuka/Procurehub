# Procurement Supplier Creation Feature

## Overview
Added the ability for **Procurement role** users to create supplier accounts directly, empowering them to onboard suppliers without requiring SuperAdmin intervention.

## Changes Made

### Backend (FastAPI)

#### 1. Updated `backend/app/routers/admin.py`

**Modified GET /api/admin/suppliers endpoint:**
- Changed permissions from `SuperAdmin only` to `SuperAdmin + Procurement`
- Allows Procurement staff to view the supplier list

```python
@router.get("/suppliers", dependencies=[Depends(require_roles(UserRole.superadmin, UserRole.procurement))])
```

**Added POST /api/admin/suppliers endpoint:**
- New endpoint for creating supplier accounts
- Available to both SuperAdmin and Procurement roles
- Creates both User account (with Supplier role) and SupplierProfile
- Sends welcome email with login credentials
- Accepts the following parameters:
  - `company_name` (required)
  - `contact_email` (required)
  - `full_name` (required)
  - `password` (required)
  - `contact_phone` (optional)
  - `address` (optional)
  - `preferred_currency` (optional, default: "USD")

**Response format:**
```json
{
  "user_id": 123,
  "supplier_id": 456,
  "company_name": "ABC Corporation",
  "contact_email": "contact@abc.com"
}
```

### Frontend (React + TypeScript)

#### 1. Updated `frontend/src/pages/StaffDashboard.tsx`

**Added Tab Navigation:**
- Two tabs: "RFQs" and "Suppliers"
- Tabs only visible for Procurement and SuperAdmin users
- Suppliers tab shows count of registered suppliers

**Added Supplier Table View:**
- Displays all suppliers with columns:
  - Company name and address
  - Contact email
  - Phone number
  - Preferred currency (USD/ZMW)
  - Active status badge (green for active, red for inactive)
- Empty state message when no suppliers exist

**Added "Add Supplier" Button:**
- Green button in header alongside "Create RFQ"
- Opens supplier creation modal
- Only visible to Procurement and SuperAdmin users

**Added Supplier Creation Modal:**
- Form fields:
  - Company Name * (required)
  - Contact Email * (required)
  - Contact Phone (optional)
  - Full Name * (required)
  - Password * (required, min 6 characters)
  - Address (optional, textarea)
  - Preferred Currency (dropdown: USD/ZMW)
- Info note about credentials being emailed
- Success/error notifications
- Form validation and submission handling

**Added State Management:**
- `suppliers` state for storing supplier list
- `supplierForm` state for form data
- `activeTab` state for tab switching ("rfqs" | "suppliers")
- `success` state for success messages
- `isCreateSupplierOpen` state for modal visibility

**Added Data Fetching:**
- `loadSuppliers()` function fetches supplier list from `/api/admin/suppliers`
- Called on component mount via useEffect
- Only executes for Procurement/SuperAdmin users

**Added Form Handler:**
- `handleCreateSupplier()` submits form to `/api/admin/suppliers`
- Handles success/error states
- Shows success message for 5 seconds
- Refreshes supplier list after creation
- Resets form and closes modal on success

## User Experience

### For Procurement Users:
1. Log in to ProcuraHub
2. Navigate to dashboard
3. See two tabs: "RFQs" and "Suppliers"
4. Click "Add Supplier" button in header
5. Fill out supplier information form
6. Submit to create supplier account
7. Success message confirms creation
8. Supplier receives welcome email with credentials
9. New supplier appears in Suppliers tab

### For Suppliers:
1. Receive welcome email with login credentials
2. Can log in immediately using provided email and password
3. Access supplier dashboard to view RFQs and submit quotations

## Testing

### Manual Testing Steps:

1. **Start servers:**
   ```bash
   # Backend (Terminal 1)
   cd backend
   .venv\Scripts\uvicorn.exe app.main:app --reload
   
   # Frontend (Terminal 2)
   cd frontend
   npm run dev
   ```

2. **Login as Procurement user:**
   - URL: http://localhost:5174
   - Email: jane.procurement@procurahub.local
   - Password: password123

3. **Create a supplier:**
   - Click "Suppliers" tab
   - Click "Add Supplier" button
   - Fill in required fields:
     - Company Name: "Test Supplier Ltd"
     - Contact Email: "test@supplier.com"
     - Full Name: "John Doe"
     - Password: "test123"
   - Optional fields:
     - Phone: "+260 xxx xxx xxx"
     - Address: "123 Main St, Lusaka"
     - Currency: "ZMW"
   - Click "Create Supplier"

4. **Verify creation:**
   - Check for success message
   - See new supplier in table
   - Test supplier login with created credentials

### Automated Test Script:
Run `test_procurement_supplier_creation.py` to test backend API:
```bash
cd "h:\python Projects\Procure"
backend\.venv\Scripts\python.exe test_procurement_supplier_creation.py
```

## API Endpoints

### GET /api/admin/suppliers
- **Auth Required**: Yes (Bearer token)
- **Roles**: SuperAdmin, Procurement
- **Response**: Array of supplier objects with user details

### POST /api/admin/suppliers
- **Auth Required**: Yes (Bearer token)
- **Roles**: SuperAdmin, Procurement
- **Request Body**:
  ```json
  {
    "company_name": "string",
    "contact_email": "string",
    "full_name": "string",
    "password": "string",
    "contact_phone": "string (optional)",
    "address": "string (optional)",
    "preferred_currency": "USD | ZMW (optional)"
  }
  ```
- **Response**:
  ```json
  {
    "user_id": 123,
    "supplier_id": 456,
    "company_name": "string",
    "contact_email": "string"
  }
  ```

## Security Considerations

1. **Role-based Access Control**: Only SuperAdmin and Procurement can create suppliers
2. **Password Requirements**: Minimum 6 characters enforced
3. **Email Validation**: Email format validated on both frontend and backend
4. **JWT Authentication**: All requests require valid authentication token
5. **Input Sanitization**: FastAPI Pydantic models validate all inputs

## Benefits

1. **Self-Service**: Procurement staff can onboard suppliers independently
2. **Efficiency**: Reduces dependency on SuperAdmin for routine tasks
3. **Speed**: Faster supplier onboarding process
4. **Tracking**: All suppliers visible in centralized table
5. **Automation**: Welcome emails sent automatically with credentials

## Future Enhancements

- [ ] Supplier editing/updating capability
- [ ] Supplier deactivation/deletion
- [ ] Bulk supplier import (CSV)
- [ ] Supplier categories/specializations
- [ ] Supplier performance ratings
- [ ] Supplier document management
- [ ] Email customization templates
- [ ] Supplier onboarding workflow

## Files Modified

### Backend:
- `backend/app/routers/admin.py` - Added supplier creation endpoint and updated permissions

### Frontend:
- `frontend/src/pages/StaffDashboard.tsx` - Added tabs, supplier table, and creation modal
- `frontend/src/utils/types.ts` - Already had SupplierWithUser interface

### Test Files:
- `test_procurement_supplier_creation.py` - New test script for validation

## Demo Credentials

### Procurement User:
- Email: jane.procurement@procurahub.local
- Password: password123

### SuperAdmin User:
- Email: admin@procurahub.local
- Password: admin123

---

**Status**: ✅ **COMPLETE AND TESTED**

**Date Implemented**: October 12, 2025

**Implemented By**: GitHub Copilot
