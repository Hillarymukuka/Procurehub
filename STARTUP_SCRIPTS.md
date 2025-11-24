# 🎉 Startup Scripts Created Successfully!

## ✅ What Was Created

I've created several convenient scripts to start and stop your ProcuraHub application:

### 🚀 Startup Scripts

| Script | Type | Description |
|--------|------|-------------|
| **`start-servers.bat`** | Batch | Full version with detailed output and auto-browser |
| **`start.bat`** | Batch | Minimal quick-start version |
| **`start-servers.ps1`** | PowerShell | Colored output version for PowerShell |

### 🛑 Stop Scripts

| Script | Type | Description |
|--------|------|-------------|
| **`stop-servers.bat`** | Batch | Cleanly stops both servers |
| **`stop-servers.ps1`** | PowerShell | PowerShell version with status |

### 📚 Documentation

| File | Purpose |
|------|---------|
| **`GETTING_STARTED.md`** | Complete quick start guide |
| **`START_SERVERS.md`** | Script usage documentation |

---

## 🎯 How to Use

### Start the Application (Easiest)

**Just double-click:** `start-servers.bat`

That's it! Both servers will start and your browser will open automatically.

### What Happens:

1. ✅ Backend server starts in new window (Port 8000)
2. ✅ Frontend server starts in new window (Port 5173)
3. ✅ Browser opens to http://localhost:5173
4. ✅ Ready to login!

### Login:
```
Email:    admin@procurahub.local
Password: admin123
```

---

## 🛑 Stop the Application

**Option 1:** Close the server windows

**Option 2:** Double-click `stop-servers.bat`

---

## 📋 Script Features

### `start-servers.bat` Features:
- ✅ Starts backend in separate window
- ✅ Waits 3 seconds for backend to initialize
- ✅ Starts frontend in separate window  
- ✅ Waits 5 seconds then opens browser
- ✅ Shows all URLs and instructions
- ✅ Keeps windows titled for easy identification

### `start.bat` Features:
- ✅ Minimal output for quick daily use
- ✅ Same functionality, less text
- ✅ Perfect for experienced users

### `start-servers.ps1` Features:
- ✅ Colored output (Cyan, Yellow, Green)
- ✅ Same functionality as batch file
- ✅ Better for PowerShell users

---

## 🔍 Script Locations

All scripts are in the root project directory:

```
H:\python Projects\Procure\
├── start-servers.bat      ← Main startup script
├── start.bat              ← Quick startup
├── start-servers.ps1      ← PowerShell startup
├── stop-servers.bat       ← Stop all servers
├── stop-servers.ps1       ← PowerShell stop
├── GETTING_STARTED.md     ← Complete guide
└── START_SERVERS.md       ← Script documentation
```

---

## 💡 Usage Examples

### Daily Workflow

**Morning:**
```
1. Double-click: start.bat
2. Wait for browser to open
3. Login and start working
```

**Evening:**
```
1. Double-click: stop-servers.bat
   OR just close the server windows
```

### First Time Setup

**If you haven't set up yet:**
```cmd
REM Backend setup
cd backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
python create_superadmin.py

REM Frontend setup
cd ..\frontend
npm install

REM Start everything
cd ..
start-servers.bat
```

---

## 🎨 What You'll See

### When Starting:

**Batch File Output:**
```
================================================
   ProcuraHub - Starting Application Servers
================================================

[1/2] Starting Backend Server (FastAPI)...
[2/2] Starting Frontend Server (Vite)...

================================================
   Both servers are starting!
================================================

Backend:  http://localhost:8000
Frontend: http://localhost:5173
API Docs: http://localhost:8000/docs

Two new command windows have opened:
  - ProcuraHub Backend  (Port 8000)
  - ProcuraHub Frontend (Port 5173)

Opening frontend in browser in 5 seconds...
```

**New Windows Will Show:**
- **Backend Window:** Uvicorn server logs
- **Frontend Window:** Vite dev server output

---

## 🔧 Customization

### Change Ports

Edit the scripts if you need different ports:

**Backend (default 8000):**
```batch
REM Change this line in start-servers.bat:
uvicorn app.main:app --reload --port 8001
```

**Frontend (default 5173):**
```batch
REM Vite uses port from vite.config.ts
REM Edit: frontend/vite.config.ts
```

### Disable Auto-Browser

Remove this line from `start-servers.bat`:
```batch
start http://localhost:5173
```

---

## ⚙️ Advanced Options

### Run in Background (No New Windows)

Create `start-background.bat`:
```batch
@echo off
cd backend
start /B .\.venv\Scripts\python.exe -m uvicorn app.main:app --reload > backend.log 2>&1
cd ..\frontend
start /B npm run dev > frontend.log 2>&1
```

### Start Only Backend

```batch
cd backend
.\.venv\Scripts\python.exe -m uvicorn app.main:app --reload
```

### Start Only Frontend

```batch
cd frontend
npm run dev
```

---

## 🐛 Troubleshooting

### "Python not found"
- Verify Python installed: `python --version`
- Should show Python 3.13.5 (or similar)

### "npm not found"
- Verify Node.js installed: `node --version`
- Should show v20.9.0 (or similar)

### Ports already in use
- Use `stop-servers.bat` first
- Or manually: `netstat -ano | findstr :8000`

### Virtual environment not found
```cmd
cd backend
python -m venv .venv
```

### Node modules not found
```cmd
cd frontend
npm install
```

---

## ✅ Verification Checklist

After starting, verify everything works:

- [ ] Backend window shows: "Application startup complete"
- [ ] Frontend window shows: "ready in XXX ms"
- [ ] Browser opened to http://localhost:5173
- [ ] Login page displays correctly
- [ ] Can login with admin@procurahub.local / admin123
- [ ] Dashboard loads after login

---

## 🎓 Next Steps

1. ✅ **Start the servers** using `start-servers.bat`
2. ✅ **Login** with the SuperAdmin credentials
3. ✅ **Explore** the application
4. ✅ **Create** test users, suppliers, RFQs
5. ✅ **Read** `GETTING_STARTED.md` for more details

---

## 📞 Quick Reference

| Need to... | Do this... |
|------------|------------|
| **Start servers** | Double-click `start-servers.bat` |
| **Stop servers** | Double-click `stop-servers.bat` or close windows |
| **Check if running** | Visit http://localhost:5173 |
| **View API docs** | Visit http://localhost:8000/docs |
| **Check backend health** | Visit http://localhost:8000/health |
| **See logs** | Look at the server windows |

---

**Everything is ready! Just double-click `start-servers.bat` to begin!** 🚀

*Created: October 11, 2025*
