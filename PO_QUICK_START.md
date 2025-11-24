# 🚀 Purchase Order System - Quick Start Guide

## ✅ What's Been Implemented

### Backend (Complete & Ready)
- ✅ Company settings database table
- ✅ Admin API for company management
- ✅ Professional PDF generation with logo
- ✅ Supplier PO download endpoint
- ✅ Security & access control
- ✅ ReportLab & Pillow installed

### Frontend (Template Provided)
- ✅ Company Settings page component
- ⚠️ Needs integration into app routing
- ⚠️ Needs "Download PO" button in supplier dashboard

---

## 🎯 Quick Integration Steps

### Step 1: Test Backend (2 minutes)
```bash
# Start backend
cd backend
.\.venv\Scripts\python -m uvicorn app.main:app --reload

# Visit: http://localhost:8000/docs
# Test endpoint: GET /api/admin/company-settings
```

### Step 2: Add Company Settings Page (5 minutes)
```tsx
// In your router (App.tsx or routes config)
import CompanySettingsPage from './pages/CompanySettingsPage';

// Add route:
{
  path: '/admin/company-settings',
  element: <CompanySettingsPage />,
}

// Add to admin navigation menu:
<Link to="/admin/company-settings">Company Settings</Link>
```

### Step 3: Add PO Download Button (5 minutes)
```tsx
// In SupplierDashboard.tsx, add this function:
const downloadPO = async (rfqId: number, quotationId: number) => {
  const response = await apiClient.get(
    `/rfqs/${rfqId}/quotations/${quotationId}/purchase-order`,
    { responseType: 'blob' }
  );
  
  const url = window.URL.createObjectURL(new Blob([response.data]));
  const link = document.createElement('a');
  link.href = url;
  link.download = `PO_${rfqId}_${quotationId}.pdf`;
  link.click();
};

// Add button where quotations are displayed:
{quotation.status === 'approved' && (
  <button onClick={() => downloadPO(rfq.id, quotation.id)}>
    Download Purchase Order
  </button>
)}
```

### Step 4: Configure Company Details (3 minutes)
1. Login as SuperAdmin
2. Go to Company Settings page
3. Fill in your company details
4. Upload company logo
5. Click Save

### Step 5: Test Complete Flow (5 minutes)
1. Create an RFQ as procurement
2. Invite suppliers
3. Supplier submits quotation
4. Approve quotation
5. Supplier downloads PO
6. Verify logo and details appear in PDF

---

## 📋 API Endpoints Reference

### Company Settings
```
GET    /api/admin/company-settings       # Get settings
POST   /api/admin/company-settings       # Create settings
PUT    /api/admin/company-settings       # Update settings
POST   /api/admin/company-settings/logo  # Upload logo
GET    /api/admin/company-settings/logo  # Get logo
DELETE /api/admin/company-settings/logo  # Delete logo
```

### Purchase Order
```
GET /api/rfqs/{rfq_id}/quotations/{quotation_id}/purchase-order
```

---

## 🎨 Component Code Snippets

### Download PO Function (Copy & Paste)
```typescript
const downloadPurchaseOrder = async (rfqId: number, quotationId: number) => {
  try {
    const response = await apiClient.get(
      `/rfqs/${rfqId}/quotations/${quotationId}/purchase-order`,
      { responseType: 'blob' }
    );
    
    const blob = new Blob([response.data], { type: 'application/pdf' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `PurchaseOrder_${rfqId}_${quotationId}.pdf`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
  } catch (error) {
    console.error('Failed to download PO:', error);
    alert('Failed to download Purchase Order. Please try again.');
  }
};
```

### Download Button UI (Copy & Paste)
```tsx
{quotation.status === 'approved' && (
  <button
    onClick={() => downloadPurchaseOrder(rfq.id, quotation.id)}
    className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-primary hover:bg-primary-dark focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary"
  >
    <svg className="mr-2 h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
    </svg>
    Download Purchase Order
  </button>
)}
```

---

## 🔧 Troubleshooting

### Issue: "Company logo not found"
**Solution**: Upload logo first via Company Settings page

### Issue: "Failed to generate PDF"
**Solution**: Check backend logs, verify reportlab is installed

### Issue: "403 Forbidden on PO download"
**Solution**: Ensure supplier owns the quotation and it's approved

### Issue: "Logo doesn't appear in PDF"
**Solution**: 
1. Check logo file format (PNG/JPG)
2. Verify logo path in database
3. Check file exists in uploads/company/ folder

---

## 📁 File Locations

### Backend:
```
backend/
├── app/
│   ├── models/company_settings.py        ← Database model
│   ├── schemas/company_settings.py       ← API schemas
│   ├── routers/admin.py                  ← Company endpoints
│   ├── routers/rfqs.py                   ← PO download
│   └── services/pdf_generator.py         ← PDF logic
├── add_company_settings.py               ← Migration script
└── requirements.txt                       ← Dependencies
```

### Frontend:
```
frontend/src/
└── pages/CompanySettingsPage.tsx         ← Admin page
```

---

## 📖 Documentation

- **Complete Guide**: `PURCHASE_ORDER_SYSTEM.md`
- **Implementation Summary**: `PO_SYSTEM_COMPLETE.md`
- **This File**: Quick reference

---

## ✨ Features at a Glance

| Feature | Status | Description |
|---------|--------|-------------|
| Company Settings DB | ✅ Complete | Store company info |
| Logo Upload | ✅ Complete | PNG/JPG support |
| PDF Generation | ✅ Complete | Professional layout |
| Blue Theme | ✅ Complete | Matches app colors |
| Supplier Download | ✅ Complete | Secure access |
| Admin UI Template | ✅ Complete | Ready to integrate |
| Security | ✅ Complete | Role-based access |

---

## 🎯 Success Checklist

- [ ] Backend running successfully
- [ ] Company Settings page added to navigation
- [ ] Company details configured
- [ ] Logo uploaded
- [ ] Download PO button added to supplier dashboard
- [ ] Test PO generated successfully
- [ ] Logo appears in PDF
- [ ] All company details in PDF
- [ ] Supplier can download their PO
- [ ] PDF looks professional

---

## 🌟 You're All Set!

Your Purchase Order system is ready to use. The backend is complete, and you just need to integrate the frontend components.

**Estimated Integration Time**: 15-20 minutes

**Next Action**: Add Company Settings page to your app navigation and test it out!

---

**Questions?** Check the full documentation in `PURCHASE_ORDER_SYSTEM.md`
