# ProcuraHub Server Startup Scripts

This folder contains scripts to easily start both the backend and frontend servers.

## Quick Start

### Option 1: Batch File (Recommended for Windows)
Double-click: **`start-servers.bat`**

Or run from command prompt:
```cmd
start-servers.bat
```

### Option 2: Simple Batch File
Double-click: **`start.bat`** (minimal version with less output)

### Option 3: PowerShell Script
Right-click **`start-servers.ps1`** → "Run with PowerShell"

Or run from PowerShell:
```powershell
.\start-servers.ps1
```

## What Happens

1. **Backend server starts** in a new window
   - FastAPI server on http://localhost:8000
   - Auto-reload enabled for development

2. **Frontend server starts** in a new window
   - Vite dev server on http://localhost:5173
   - Hot Module Replacement (HMR) enabled

3. **Browser opens** automatically to http://localhost:5173

## Stopping the Servers

- Close the server windows, or
- Press `Ctrl+C` in each server window

## Login Credentials

```
Email:    admin@procurahub.local
Password: admin123
```

## Troubleshooting

### "Python not found" or "npm not found"
Make sure you've completed the setup:
```cmd
cd backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt

cd ../frontend
npm install
```

### Port already in use
If you see port errors, another instance may be running:
- Check for existing processes: `netstat -ano | findstr :8000`
- Check for existing processes: `netstat -ano | findstr :5173`
- Close existing server windows or kill the processes

### PowerShell execution policy error
Run PowerShell as Administrator and execute:
```powershell
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
```

## Manual Start (Alternative)

If the scripts don't work, you can start manually:

**Terminal 1 (Backend):**
```cmd
cd backend
.\.venv\Scripts\python.exe -m uvicorn app.main:app --reload
```

**Terminal 2 (Frontend):**
```cmd
cd frontend
npm run dev
```

## Files

- `start-servers.bat` - Main batch script with detailed output
- `start.bat` - Minimal batch script for quick start
- `start-servers.ps1` - PowerShell version with colored output
- `START_SERVERS.md` - This documentation file
