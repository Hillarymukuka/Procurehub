# ProcuraHub Setup & Run Guide

## ✅ Project Analysis Summary

**ProcuraHub** is a full-stack procurement management system with:

### Technology Stack:
- **Backend**: FastAPI (Python 3.13+), SQLAlchemy, SQLite
- **Frontend**: React 18, TypeScript, Vite, TailwindCSS
- **Authentication**: JWT-based with OAuth2 password flow
- **File Storage**: Local filesystem (`uploads/` directory)

### Key Features:
- 🔐 Role-based access (SuperAdmin, Procurement, Requester, Finance, Supplier)
- 📝 Supplier self-registration with document uploads
- 📊 RFQ lifecycle management
- 💼 Quotation submission and approval workflow
- 📧 Email notifications (console logging by default)
- ⚖️ Fair supplier selection algorithm

---

## 🚀 Quick Start (Already Completed!)

### ✅ Backend Setup (DONE)
1. **Virtual environment created**: `backend/.venv`
2. **Dependencies installed**: All packages from `requirements.txt`
3. **Database**: SQLite will be auto-created at `backend/procurahub.db`

### ✅ Frontend Setup (DONE)
1. **Dependencies installed**: All npm packages from `package.json`

---

## 🏃 Running the Application

### Option 1: Using VS Code Tasks (Recommended)

You now have two VS Code tasks configured in `.vscode/tasks.json`:

1. **Start Backend Server**
   - Press `Ctrl+Shift+P` (or `Cmd+Shift+P` on Mac)
   - Type: `Tasks: Run Task`
   - Select: `Start Backend Server`
   - Backend will run on: http://localhost:8000

2. **Start Frontend Server**
   - Press `Ctrl+Shift+P` again
   - Type: `Tasks: Run Task`
   - Select: `Start Frontend Server`
   - Frontend will run on: http://localhost:5173

### Option 2: Manual Terminal Commands

**Backend:**
```powershell
cd backend
.\.venv\Scripts\python.exe -m uvicorn app.main:app --reload
```

**Frontend (in a new terminal):**
```powershell
cd frontend
npm run dev
```

---

## 🌐 Accessing the Application

Once both servers are running:

- **Frontend (User Interface)**: http://localhost:5173
- **Backend API**: http://localhost:8000
- **API Documentation**: http://localhost:8000/docs (Swagger UI)
- **Alternative API Docs**: http://localhost:8000/redoc
- **Health Check**: http://localhost:8000/health

---

## 👤 Initial User Setup

The application requires a **SuperAdmin** account to get started. You'll need to create one:

### Method 1: Using Python Script
Create a file `backend/create_superadmin.py`:

```python
from app.database import SessionLocal
from app.models.user import User
from app.utils.security import get_password_hash

db = SessionLocal()

# Check if superadmin exists
existing = db.query(User).filter(User.username == "admin").first()
if existing:
    print("SuperAdmin already exists!")
else:
    superadmin = User(
        username="admin",
        email="admin@procurahub.local",
        hashed_password=get_password_hash("admin123"),
        role="superadmin",
        is_active=True
    )
    db.add(superadmin)
    db.commit()
    print("SuperAdmin created successfully!")
    print("Username: admin")
    print("Password: admin123")
    
db.close()
```

Run it:
```powershell
cd backend
.\.venv\Scripts\python.exe create_superadmin.py
```

### Method 2: Direct Database Insert (SQLite)
```powershell
cd backend
.\.venv\Scripts\python.exe
```

Then in Python:
```python
from app.database import SessionLocal
from app.models.user import User
from app.utils.security import get_password_hash

db = SessionLocal()
admin = User(
    username="admin",
    email="admin@procurahub.local", 
    hashed_password=get_password_hash("admin123"),
    role="superadmin",
    is_active=True
)
db.add(admin)
db.commit()
db.close()
print("SuperAdmin created!")
```

---

## 🔧 Configuration

### Backend Configuration (Optional)

Create `backend/.env` file to customize settings:

```env
# Database
DATABASE_URL=sqlite:///./backend/procurahub.db
# For PostgreSQL: postgresql+psycopg2://user:password@localhost:5432/procurahub

# Security
SECRET_KEY=your-secret-key-change-in-production
ACCESS_TOKEN_EXPIRE_MINUTES=60
JWT_ALGORITHM=HS256

# Email
EMAIL_SENDER=noreply@procurahub.local
EMAIL_CONSOLE_FALLBACK=True

# File Upload
UPLOAD_DIR=./uploads

# RFQ Settings
INVITATION_BATCH_SIZE=25
```

### Frontend Configuration (Optional)

Create `frontend/.env` file if backend runs on different port:

```env
VITE_API_BASE_URL=http://localhost:8000
```

---

## 📁 Project Structure

```
ProcuraHub/
├── backend/
│   ├── .venv/              # Python virtual environment ✅
│   ├── app/
│   │   ├── main.py         # FastAPI application entry point
│   │   ├── config.py       # Configuration management
│   │   ├── database.py     # Database setup
│   │   ├── models/         # SQLAlchemy models
│   │   ├── routers/        # API endpoints
│   │   ├── schemas/        # Pydantic schemas
│   │   ├── services/       # Business logic
│   │   └── utils/          # Utilities (security, etc.)
│   ├── requirements.txt    # Python dependencies
│   └── procurahub.db       # SQLite database (auto-created)
├── frontend/
│   ├── src/
│   │   ├── main.tsx        # React entry point
│   │   ├── App.tsx         # Main app component
│   │   ├── components/     # Reusable components
│   │   ├── pages/          # Page components
│   │   ├── context/        # React contexts
│   │   └── utils/          # Frontend utilities
│   ├── package.json        # Node dependencies
│   └── vite.config.ts      # Vite configuration
├── uploads/                # File storage (auto-created)
└── .vscode/
    └── tasks.json          # VS Code tasks ✅
```

---

## 🔍 Testing the Application

### 1. Health Check
```powershell
curl http://localhost:8000/health
# Should return: {"status":"ok"}
```

### 2. API Documentation
Visit: http://localhost:8000/docs

### 3. Login Flow
1. Go to http://localhost:5173
2. Login with SuperAdmin credentials (after creating them)
3. Create internal users (Procurement, Finance, etc.)
4. Test supplier registration (doesn't require login)

---

## 🐛 Troubleshooting

### Backend won't start?
- Ensure you're in the `backend` directory
- Check Python version: `python --version` (should be 3.11+)
- Verify dependencies: `.venv\Scripts\pip.exe list`
- Check logs in terminal for specific errors

### Frontend won't start?
- Ensure you're in the `frontend` directory
- Check Node version: `node --version` (should be 18+)
- Clear node_modules and reinstall: `rm -r node_modules; npm install`
- Check for port conflicts on 5173

### Database errors?
- Delete `backend/procurahub.db` and restart (will recreate)
- Check `backend/.env` for DATABASE_URL

### CORS errors?
- Ensure backend CORS allows `http://localhost:5173`
- Check `backend/app/main.py` for CORS configuration

---

## 📚 Next Steps

1. ✅ **Setup Complete** - Backend and frontend are configured
2. 🔜 **Create SuperAdmin** - Run the script above
3. 🔜 **Access Frontend** - http://localhost:5173
4. 🔜 **Explore API** - http://localhost:8000/docs
5. 🔜 **Create Test Data** - Add suppliers, RFQs, etc.

---

## 🔐 Security Notes

⚠️ **Before Production:**
- Change `SECRET_KEY` in `.env`
- Use PostgreSQL instead of SQLite
- Enable proper SMTP for emails
- Add rate limiting
- Implement audit logging
- Configure proper CORS origins
- Use HTTPS
- Set up proper file upload validation

---

## 📞 Support

- Check logs in terminal windows
- Review API documentation at `/docs`
- Examine browser console for frontend errors
- Check Network tab in browser DevTools

---

**You're all set! 🎉**

Run the VS Code tasks or manual commands above to start both servers.
