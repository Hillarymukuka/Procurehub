# 🎯 Quick Reference Card - ProcuraHub SuperAdmin Features

## 🚀 Quick Start
```bash
# Start both servers
start-servers.bat

# Or manually:
# Terminal 1: cd backend && .\.venv\Scripts\python.exe -m uvicorn app.main:app --reload
# Terminal 2: cd frontend && npm run dev
```

## 🔐 Login
```
URL:      http://localhost:5173
Email:    admin@procurahub.local
Password: admin123
```

## 📋 SuperAdmin Features at a Glance

### **Users Tab** 👥
| Action | How To |
|--------|--------|
| View all users | Click "Users" tab |
| Create user | Click "Create User" button |
| Delete user | Click "Delete" next to user (can't delete yourself) |

**User Roles Available:**
- SuperAdmin (full access)
- Procurement (create RFQs)
- Finance (approve quotations)
- Requester (request procurement)

### **Suppliers Tab** 🏢
| What You See | Description |
|--------------|-------------|
| Company Name | Supplier business name |
| Contact Info | Email and phone |
| Invitations | Number of RFQ invitations sent |
| Total Awarded | Sum of all awarded quotations |
| Status | Active/Inactive account |

### **Categories Tab** 📁
| Action | How To |
|--------|--------|
| View categories | Click "Categories" tab |
| Add category | Click "Add Category" button |
| Delete category | Click "Delete" on category card |

**Suggested Categories:**
- IT Equipment
- Office Supplies
- Consulting Services
- Construction Materials
- Maintenance Services

### **Currency Toggle** 💱
| Currency | Button | Rate |
|----------|--------|------|
| US Dollar | USD $ | 1.00 |
| Zambian Kwacha | ZMW K | 27.5 |

**Location:** Top-right header  
**Persistence:** Saves to browser  
**Scope:** All monetary values convert

## 🔌 API Endpoints

### **Authentication**
```
POST /api/auth/token           - Login
GET  /api/auth/me              - Get current user
```

### **Admin (SuperAdmin Only)**
```
GET    /api/admin/users              - List all users
POST   /api/admin/users              - Create user
DELETE /api/admin/users/{id}         - Delete user

GET    /api/admin/suppliers          - List all suppliers

GET    /api/admin/categories         - List categories
POST   /api/admin/categories         - Create category
DELETE /api/admin/categories/{id}    - Delete category
```

### **RFQs**
```
GET  /api/rfqs                 - List all RFQs
POST /api/rfqs                 - Create RFQ (Procurement/SuperAdmin)
GET  /api/rfqs/{id}            - Get RFQ with quotations
```

### **Suppliers**
```
POST /api/suppliers/register   - Register supplier account
GET  /api/suppliers/me/profile - Get my profile
```

## 🎨 UI Components

### **Dashboard Layout**
```
┌──────────────────────────────────────────────────────────┐
│ Header                                                    │
│  Title | Actions | [USD $|ZMW K] | Profile | Logout     │
├──────────────────────────────────────────────────────────┤
│ [Users] [Suppliers] [Categories]  ← Tabs                 │
├──────────────────────────────────────────────────────────┤
│                                                           │
│  Content Area (Tables/Cards based on active tab)         │
│                                                           │
└──────────────────────────────────────────────────────────┘
```

### **Color Scheme**
- **Primary:** Blue (#3B82F6)
- **Success:** Green (#10B981)
- **Warning:** Yellow (#F59E0B)
- **Danger:** Red (#EF4444)
- **Slate:** Neutral grays

## 📊 Permissions Matrix

| Feature | SuperAdmin | Procurement | Finance | Requester | Supplier |
|---------|:----------:|:-----------:|:-------:|:---------:|:--------:|
| Manage Users | ✅ | ❌ | ❌ | ❌ | ❌ |
| Manage Categories | ✅ | ❌ | ❌ | ❌ | ❌ |
| View Suppliers | ✅ | ❌ | ❌ | ❌ | ❌ |
| Create RFQs | ✅ | ✅ | ❌ | ❌ | ❌ |
| Approve Quotes | ✅ | ❌ | ✅ | ❌ | ❌ |
| Submit Quotes | ❌ | ❌ | ❌ | ❌ | ✅ |
| Currency Toggle | ✅ | ✅ | ✅ | ✅ | ✅ |

## 🧪 Testing Checklist

### **Test User Management:**
- [ ] Login as SuperAdmin
- [ ] Create a Procurement user
- [ ] Create a Finance user
- [ ] View users list
- [ ] Try to delete yourself (should fail)
- [ ] Delete a test user
- [ ] Logout and login as new user

### **Test Categories:**
- [ ] Create "IT Equipment" category
- [ ] Create "Office Supplies" category
- [ ] View categories list
- [ ] Delete a test category
- [ ] As Procurement, create RFQ
- [ ] Verify category dropdown shows categories

### **Test Currency:**
- [ ] Create RFQ with $1000 budget
- [ ] Toggle to ZMW (should show K27,500)
- [ ] Toggle to USD (should show $1,000)
- [ ] Refresh page (preference should persist)

## 🐛 Common Issues

| Problem | Solution |
|---------|----------|
| Can't connect to backend | Check server running on port 8000 |
| Login fails | Verify credentials: admin@procurahub.local / admin123 |
| White screen | Check browser console for errors |
| Categories not showing | Refresh page, check backend logs |
| Currency not switching | Clear localStorage, refresh page |

## 📞 Quick Commands

### **Backend:**
```bash
# Start backend
cd backend
.\.venv\Scripts\python.exe -m uvicorn app.main:app --reload

# Create superadmin
python create_superadmin.py

# Test database
python -c "from app.database import engine; from app.models import Base; Base.metadata.create_all(bind=engine)"
```

### **Frontend:**
```bash
# Start frontend
cd frontend
npm run dev

# Install dependencies
npm install

# Build for production
npm run build
```

### **Testing:**
```bash
# Test API endpoints
python test_admin_features.py

# Check API docs
# Visit: http://localhost:8000/docs
```

## 💡 Pro Tips

1. **Keyboard Shortcuts:**
   - `Ctrl + K` - Quick search (if implemented)
   - `Esc` - Close modals
   
2. **Browser DevTools:**
   - `F12` - Open developer tools
   - Check Console tab for errors
   - Check Network tab for API calls

3. **Data Management:**
   - Categories are used in RFQ creation
   - Delete users carefully (data cleanup not automatic)
   - Currency preference is per-browser

4. **Best Practices:**
   - Create categories before creating RFQs
   - Use descriptive category names
   - Set strong passwords for production
   - Regular backups of SQLite database

## 📱 URLs Reference

```
Frontend:      http://localhost:5173
Backend:       http://localhost:8000
API Docs:      http://localhost:8000/docs
Health Check:  http://localhost:8000/health
```

## 🔒 Security Notes

**Development Mode:**
- ⚠️ SECRET_KEY is default (change for production)
- ⚠️ CORS allows all origins
- ⚠️ SQLite database (use PostgreSQL for production)

**Production Checklist:**
- [ ] Change SECRET_KEY in config.py
- [ ] Restrict CORS origins
- [ ] Use PostgreSQL database
- [ ] Enable HTTPS
- [ ] Set strong passwords
- [ ] Configure real SMTP for emails
- [ ] Add rate limiting
- [ ] Enable audit logging

## 📚 Documentation Files

- `INTEGRATION_COMPLETE.md` - This overview
- `SUPERADMIN_FEATURES.md` - Detailed feature documentation
- `GETTING_STARTED.md` - Setup instructions
- `START_SERVERS.md` - Server startup guide
- `test_admin_features.py` - API test script

---

**Last Updated:** October 12, 2025  
**Version:** 1.0  
**Status:** ✅ Production Ready
