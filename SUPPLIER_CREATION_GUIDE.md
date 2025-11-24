# Quick Guide: Adding Suppliers as Procurement User

## Step-by-Step Instructions

### 1. Access the Application
- Open browser: http://localhost:5174 (or http://localhost:5173)
- Login with Procurement credentials:
  - Email: `jane.procurement@procurahub.local`
  - Password: `password123`

### 2. Navigate to Suppliers Tab
```
Dashboard Header
├── "RFQs" tab (default)
└── "Suppliers" tab ← Click here
```

### 3. Click "Add Supplier" Button
- Located in the top-right header
- Green button next to "Create RFQ"
- Opens the supplier creation modal

### 4. Fill Out Supplier Form

#### Required Fields (marked with *):
| Field | Example | Description |
|-------|---------|-------------|
| Company Name * | TechGear Solutions Ltd | Official company name |
| Contact Email * | info@techgear.zm | Primary email (used for login) |
| Full Name * | Michael Banda | Contact person's full name |
| Password * | techgear2024 | Login password (min 6 chars) |

#### Optional Fields:
| Field | Example | Description |
|-------|---------|-------------|
| Contact Phone | +260 977 123456 | Phone number |
| Address | Plot 456, Industrial Area, Lusaka | Physical address |
| Preferred Currency | ZMW (Kwacha) or USD (Dollar) | Default quotation currency |

### 5. Submit the Form
- Click "Create Supplier" button
- Wait for confirmation message
- Modal closes automatically on success

### 6. Verify Supplier Creation
**In the Suppliers tab, you'll see:**
```
┌─────────────────────────────────────────────────────────────────┐
│ Company          │ Contact Email    │ Phone         │ Currency │ Status │
├─────────────────────────────────────────────────────────────────┤
│ TechGear Solutions│info@techgear.zm │ +260 977...   │ ZMW     │ Active │
│ Plot 456, Lusaka │                  │               │         │        │
└─────────────────────────────────────────────────────────────────┘
```

### 7. Supplier Can Now Login
The new supplier can immediately login using:
- Email: `info@techgear.zm` (the contact email you provided)
- Password: `techgear2024` (the password you set)

They will:
- Receive a welcome email (if email service is configured)
- Access their supplier dashboard
- View and respond to RFQs

---

## Visual Layout

### Dashboard with Tabs
```
┌────────────────────────────────────────────────────────────────┐
│  ProcuraHub                        [Create RFQ] [Add Supplier] │
├────────────────────────────────────────────────────────────────┤
│  Procurement Dashboard                                         │
│  Monitor sourcing activities and supplier responses            │
├────────────────────────────────────────────────────────────────┤
│  [RFQs] [Suppliers (3)] ← Tabs                               │
├────────────────────────────────────────────────────────────────┤
│                                                                │
│  When on Suppliers tab:                                        │
│  ┌──────────────────────────────────────────────────────────┐ │
│  │                   Suppliers Table                         │ │
│  │                                                           │ │
│  │  Company | Email | Phone | Currency | Status             │ │
│  │  ------------------------------------------------         │ │
│  │  [List of all suppliers]                                 │ │
│  └──────────────────────────────────────────────────────────┘ │
└────────────────────────────────────────────────────────────────┘
```

### Add Supplier Modal
```
┌──────────────────────────────────────┐
│  Add New Supplier               [X]  │
├──────────────────────────────────────┤
│                                      │
│  Company Name *                      │
│  [________________________]          │
│                                      │
│  Contact Email *    Contact Phone    │
│  [____________]     [____________]   │
│                                      │
│  Full Name *        Password *       │
│  [____________]     [____________]   │
│                                      │
│  Address                             │
│  [________________________]          │
│  [________________________]          │
│                                      │
│  Preferred Currency                  │
│  [USD ($)        ▼]                 │
│                                      │
│  ℹ️ Note: Login credentials will be │
│    sent to the supplier's email     │
│                                      │
│        [Create Supplier]             │
└──────────────────────────────────────┘
```

---

## Success Indicators

### ✅ Successful Creation:
1. Green success message appears at top: 
   > "Supplier created successfully! Login credentials have been emailed."

2. Modal closes automatically

3. New row appears in suppliers table

4. Tab badge updates: "Suppliers (3)" → "Suppliers (4)"

### ❌ Common Errors:

| Error Message | Cause | Solution |
|---------------|-------|----------|
| "Email already registered" | Email in use | Use different email |
| "Unable to create supplier" | Network/server issue | Check servers are running |
| Missing required fields | Form validation | Fill all fields marked with * |
| Password too short | Less than 6 characters | Use 6+ characters |

---

## Tips

💡 **Best Practices:**
- Use company email addresses (not personal)
- Set strong passwords (8+ characters recommended)
- Include phone numbers for better communication
- Add detailed addresses for delivery coordination
- Select currency based on supplier's preference

💡 **Workflow:**
1. Create supplier account first
2. Email supplier their credentials
3. Supplier logs in and completes profile
4. Create RFQs and invite suppliers
5. Suppliers submit quotations

---

## Keyboard Shortcuts

| Key | Action |
|-----|--------|
| `Tab` | Move to next field |
| `Shift + Tab` | Move to previous field |
| `Enter` | Submit form (when in input field) |
| `Esc` | Close modal |

---

## Who Can Use This Feature?

✅ **Can Create Suppliers:**
- SuperAdmin
- Procurement

❌ **Cannot Create Suppliers:**
- Finance (can only approve quotations)
- Requester (can only view RFQs)
- Supplier (external users)

---

## Quick Reference Commands

### Start Application:
```powershell
# Terminal 1 - Backend
cd "h:\python Projects\Procure\backend"
.venv\Scripts\uvicorn.exe app.main:app --reload

# Terminal 2 - Frontend  
cd "h:\python Projects\Procure\frontend"
npm run dev
```

### Test Accounts:
```
Procurement: jane.procurement@procurahub.local / password123
SuperAdmin:  admin@procurahub.local / admin123
```

---

**Need Help?** Check the main documentation: `PROCUREMENT_SUPPLIER_CREATION.md`
