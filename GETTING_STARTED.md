# 🚀 ProcuraHub - Quick Start Guide

## 📋 One-Click Start

### Windows Users (Easiest Method)

**Just double-click:** `start-servers.bat`

This will:
- ✅ Start the backend server (Port 8000)
- ✅ Start the frontend server (Port 5173)
- ✅ Open the application in your browser
- ✅ Keep everything running in separate windows

---

## 🎯 Available Startup Scripts

| File | Description | Best For |
|------|-------------|----------|
| **`start-servers.bat`** | Full version with status messages | First-time users |
| **`start.bat`** | Minimal version | Quick daily use |
| **`start-servers.ps1`** | PowerShell with colored output | PowerShell users |

---

## 🔐 Login Credentials

After the browser opens, use these credentials:

```
Email:    admin@procurahub.local
Password: admin123
```

**Role:** SuperAdmin (full access)

---

## 📊 Application URLs

Once started, access these URLs:

| Service | URL | Purpose |
|---------|-----|---------|
| **Frontend** | http://localhost:5173 | Main application interface |
| **Backend API** | http://localhost:8000 | API endpoints |
| **API Documentation** | http://localhost:8000/docs | Interactive Swagger UI |
| **API Docs (Alt)** | http://localhost:8000/redoc | ReDoc documentation |
| **Health Check** | http://localhost:8000/health | Server status |

---

## 🛑 Stopping the Servers

1. Close the server windows, OR
2. Press `Ctrl+C` in each server window

---

## 🔧 Manual Setup (First Time Only)

If you haven't set up the project yet:

### Backend Setup
```cmd
cd backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
python create_superadmin.py
```

### Frontend Setup
```cmd
cd frontend
npm install
```

---

## ❓ Troubleshooting

### Issue: "Python not found"
**Solution:** Make sure Python 3.11+ is installed and in your PATH

### Issue: "npm not found"
**Solution:** Install Node.js 18+ from https://nodejs.org

### Issue: Port already in use
**Solution:** 
```cmd
# Check what's using the port
netstat -ano | findstr :8000
netstat -ano | findstr :5173

# Kill the process or use the stop script
```

### Issue: PowerShell script won't run
**Solution:**
```powershell
# Run as Administrator
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
```

### Issue: Database errors
**Solution:**
```cmd
cd backend
del procurahub.db
# Restart servers - database will be recreated
python create_superadmin.py
```

---

## 📁 Project Structure

```
ProcuraHub/
├── start-servers.bat      ← Double-click to start!
├── start.bat              ← Quick start version
├── start-servers.ps1      ← PowerShell version
├── backend/               ← FastAPI backend
│   ├── .venv/            ← Python virtual environment
│   ├── app/              ← Application code
│   ├── requirements.txt  ← Python dependencies
│   └── create_superadmin.py
├── frontend/              ← React frontend
│   ├── src/              ← React components
│   ├── package.json      ← Node dependencies
│   └── vite.config.ts    ← Vite configuration
└── uploads/               ← File uploads (auto-created)
```

---

## 🎨 Features

- **Role-Based Access Control**
  - SuperAdmin, Procurement, Finance, Requester, Supplier

- **Supplier Management**
  - Self-registration with document uploads
  - Category-based organization

- **RFQ Workflow**
  - Create and distribute RFQs
  - Automatic supplier invitations
  - Fair distribution algorithm

- **Quotation System**
  - Supplier quotation submission
  - Finance approval workflow
  - Email notifications

---

## 🔥 Quick Actions

### Create a New User
1. Login as SuperAdmin
2. Go to http://localhost:8000/docs
3. Find `POST /api/auth/users`
4. Create Procurement/Finance users

### Register a Test Supplier
1. Go to supplier registration (no login needed)
2. Fill in company details
3. Upload required documents

### Create an RFQ
1. Login as Procurement or SuperAdmin
2. Create a new RFQ
3. System auto-invites matching suppliers

---

## 📞 Need Help?

- Check `QUICK_START.md` for detailed setup
- Check `FIX_EMAIL_VALIDATOR.md` for known issues
- Check `DEBUG_LOGIN.md` for login troubleshooting

---

## ✅ System Requirements

- **Python:** 3.11 or higher
- **Node.js:** 18 or higher
- **OS:** Windows (batch files), Linux/Mac (modify scripts)
- **RAM:** 2GB minimum
- **Disk:** 500MB free space

---

**Happy Procuring! 🎉**

*For production deployment, see PRODUCTION.md (not yet created)*
