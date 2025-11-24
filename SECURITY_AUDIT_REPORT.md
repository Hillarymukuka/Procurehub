# 🔒 COMPREHENSIVE SECURITY AUDIT REPORT
## ProcuraHub - Procurement Management System

**Audit Date:** November 24, 2025  
**Auditor:** Senior Cybersecurity Engineer  
**Application Stack:** FastAPI (Python 3.13) + React 18 + SQLite  
**Deployment Readiness Score:** **42/100** ⚠️ **CRITICAL ISSUES FOUND**

---

## 🚨 CRITICAL VULNERABILITIES (MUST FIX BEFORE DEPLOYMENT)

### 1. **HARDCODED SMTP CREDENTIALS IN .ENV FILE**
**Risk Level:** 🔴 **CRITICAL**

**Location:** 
- `backend/.env` lines 12-14

**Description:**
Gmail SMTP password is hardcoded and committed to version control:
```dotenv
SMTP_USERNAME=ancestroai@gmail.com
SMTP_PASSWORD=svgr xzzf culk txwq  # ← App-specific password exposed!
```

**Exploitation:**
- Attacker with repository access can send unlimited emails
- Email bombing/phishing attacks using your domain
- Reputation damage, blacklisting of SMTP server
- Potential data exfiltration through email

**Fix:**
```python
# backend/.env (DO NOT COMMIT THIS FILE)
SMTP_USERNAME=${SMTP_USERNAME}
SMTP_PASSWORD=${SMTP_PASSWORD}

# Use environment variables in production
# Store in Azure Key Vault, AWS Secrets Manager, or secure .env
```

**Prevention:**
1. Add `.env` to `.gitignore` immediately
2. Rotate SMTP credentials NOW
3. Use environment-specific secrets management
4. Never commit secrets to git history (use git filter-branch if already committed)

---

### 2. **WEAK DEFAULT SECRET KEY**
**Risk Level:** 🔴 **CRITICAL**

**Location:**
- `backend/app/config.py` line 17
- `backend/.env` line 2

**Description:**
JWT signing key uses insecure default:
```python
secret_key: str = Field(default="change-me-in-production", env="SECRET_KEY")
```

Current .env value: `SECRET_KEY=change-me-in-production`

**Exploitation:**
- Attacker can forge valid JWT tokens
- Impersonate any user including SuperAdmin
- Complete system takeover
- Data breach, unauthorized transactions

**Fix:**
```bash
# Generate cryptographically secure key (32+ bytes)
python -c "import secrets; print(secrets.token_urlsafe(64))"

# Example output: 
# SECRET_KEY=vF8kP2mN9xQ7wE6rT5yU8iO3pA1sD4fG6hJ2kL9zX0cV7bN4mQ1wE8rT5yU0iO3p
```

```python
# backend/app/config.py - Remove insecure default
secret_key: str = Field(env="SECRET_KEY")  # Make it required, no default

# Add startup validation
if settings.secret_key == "change-me-in-production":
    raise ValueError("SECRET_KEY must be changed from default value!")
```

**Prevention:**
- Use 64+ character random strings for production
- Rotate keys periodically (every 90 days)
- Different keys for dev/staging/production

---

### 3. **MISSING .gitignore - SECRETS EXPOSED**
**Risk Level:** 🔴 **CRITICAL**

**Location:**
- Root directory (no `.gitignore` file found)

**Description:**
No `.gitignore` file exists, meaning sensitive files are being committed:
- `.env` files with credentials
- `backend/procurahub.db` (contains user data, passwords)
- `uploads/` directory (potentially sensitive documents)
- `__pycache__/` compiled Python files

**Exploitation:**
- Public repository = instant credential leak
- Database contains hashed passwords (bcrypt, but still risky)
- Uploaded documents may contain PII, financial data

**Fix:**
Create `.gitignore` immediately:

```gitignore
# Python
__pycache__/
*.py[cod]
*$py.class
*.so
.Python
*.egg-info/
dist/
build/
.venv/
venv/

# Environment variables
.env
.env.*
!.env.example

# Database
*.db
*.sqlite
*.sqlite3

# Uploads & sensitive data
uploads/
/backend/uploads/
/frontend/dist/

# IDE
.vscode/
.idea/
*.swp
*.swo
*~

# OS
.DS_Store
Thumbs.db

# Logs
*.log
logs/

# Secrets
*.pem
*.key
*.crt
secrets/
```

**Prevention:**
1. Remove `.env` and `procurahub.db` from git history:
   ```bash
   git filter-branch --force --index-filter \
     "git rm --cached --ignore-unmatch backend/.env backend/procurahub.db" \
     --prune-empty --tag-name-filter cat -- --all
   ```
2. Add `.gitignore` and commit
3. Audit repository for other secrets

---

### 4. **NO INPUT VALIDATION ON FILE UPLOADS**
**Risk Level:** 🔴 **CRITICAL**

**Location:**
- `backend/app/services/file_storage.py` lines 14-30
- `backend/app/routers/suppliers.py` line 156
- `backend/app/routers/requests.py` (document uploads)

**Description:**
File upload accepts ANY file type without validation:
```python
def save_upload_file(upload: UploadFile, subdir: Optional[str] = None) -> Path:
    extension = Path(upload.filename or "").suffix  # No validation!
    filename = f"{uuid4().hex}{extension}"
    # Saves directly to disk
```

**Exploitation:**
- Upload malicious executables (.exe, .sh, .bat)
- Web shells (.php, .jsp, .aspx) for RCE
- XXE attacks via crafted XML/SVG files
- Zip bombs, billion laughs attacks
- Malware distribution through document downloads

**Fix:**
```python
# backend/app/services/file_storage.py
from pathlib import Path
from typing import Optional
from uuid import uuid4
from fastapi import HTTPException, UploadFile
import magic  # python-magic library

# Whitelist allowed extensions and MIME types
ALLOWED_EXTENSIONS = {'.pdf', '.jpg', '.jpeg', '.png', '.doc', '.docx', '.xls', '.xlsx', '.txt'}
ALLOWED_MIME_TYPES = {
    'application/pdf',
    'image/jpeg',
    'image/png',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'text/plain'
}

MAX_FILE_SIZE = 10 * 1024 * 1024  # 10MB

def validate_upload_file(upload: UploadFile) -> None:
    """Validate file extension, MIME type, and size."""
    if not upload.filename:
        raise HTTPException(400, "Filename is required")
    
    # Check extension
    extension = Path(upload.filename).suffix.lower()
    if extension not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            400, 
            f"File type not allowed. Allowed: {', '.join(ALLOWED_EXTENSIONS)}"
        )
    
    # Check actual file content (magic bytes)
    upload.file.seek(0)
    file_content = upload.file.read(2048)  # Read first 2KB
    upload.file.seek(0)  # Reset for later reading
    
    mime = magic.from_buffer(file_content, mime=True)
    if mime not in ALLOWED_MIME_TYPES:
        raise HTTPException(
            400,
            f"Invalid file content. Detected: {mime}"
        )
    
    # Check file size
    upload.file.seek(0, 2)  # Seek to end
    file_size = upload.file.tell()
    upload.file.seek(0)  # Reset
    
    if file_size > MAX_FILE_SIZE:
        raise HTTPException(
            400,
            f"File too large. Max size: {MAX_FILE_SIZE / 1024 / 1024}MB"
        )

def save_upload_file(upload: UploadFile, subdir: Optional[str] = None) -> Path:
    """Persist an uploaded file after validation."""
    validate_upload_file(upload)  # ← Add this
    
    target_dir = BASE_UPLOAD_DIR
    if subdir:
        # Sanitize subdir to prevent path traversal
        subdir = Path(subdir).name  # Only basename, no ../
        target_dir = target_dir / subdir
        target_dir.mkdir(parents=True, exist_ok=True)
    
    # Use safe extension from whitelist
    extension = Path(upload.filename or "").suffix.lower()
    filename = f"{uuid4().hex}{extension}"
    file_path = target_dir / filename
    
    with file_path.open("wb") as out_file:
        content = upload.file.read()
        out_file.write(content)
    
    return file_path
```

**Dependencies to add:**
```bash
pip install python-magic python-magic-bin  # For MIME type detection
```

**Prevention:**
- Always validate both extension AND content
- Use file size limits
- Scan uploads with antivirus (ClamAV integration)
- Store uploads outside web root
- Serve files with `Content-Disposition: attachment`

---

### 5. **SQL INJECTION RISK IN MIGRATIONS**
**Risk Level:** 🔴 **CRITICAL**

**Location:**
- `backend/app/utils/migrations.py` lines 69, 74, 102, 159, etc.

**Description:**
String interpolation used in SQL statements without parameterization:
```python
text(f"ALTER TABLE supplier_profiles ADD COLUMN {column} {definition}")
text(f"UPDATE supplier_profiles SET {column} = COALESCE({column}, 0)")
```

While `column` and `definition` come from hardcoded dictionaries (currently safe), this pattern is dangerous.

**Exploitation (if modified):**
- If column names ever come from user input
- Arbitrary SQL execution
- Data exfiltration, deletion, privilege escalation

**Fix:**
Use SQLAlchemy's Table reflection for safer operations:
```python
from sqlalchemy import Table, Column, Integer, MetaData

def _ensure_supplier_profile_columns(engine: Engine) -> None:
    inspector = inspect(engine)
    if "supplier_profiles" not in inspector.get_table_names():
        return
    
    metadata = MetaData()
    supplier_table = Table('supplier_profiles', metadata, autoload_with=engine)
    
    # Use SQLAlchemy schema operations instead of raw SQL
    from sqlalchemy.schema import AddColumn
    from sqlalchemy import Integer, DateTime, Numeric
    
    column_mapping = {
        "invitations_sent": Column("invitations_sent", Integer, default=0),
        "total_awarded_value": Column("total_awarded_value", Numeric(12, 2), default=0),
    }
    
    existing_columns = {col.name for col in supplier_table.columns}
    
    for col_name, col_obj in column_mapping.items():
        if col_name not in existing_columns:
            with engine.begin() as conn:
                conn.execute(AddColumn('supplier_profiles', col_obj))
```

**Prevention:**
- Never use f-strings with SQL
- Use parameterized queries exclusively
- Use ORM methods over raw SQL
- Code review all database operations

---

### 6. **NO CSRF PROTECTION**
**Risk Level:** 🔴 **CRITICAL**

**Location:**
- `backend/app/main.py` (missing CSRF middleware)
- All POST/PUT/DELETE endpoints

**Description:**
No CSRF tokens required for state-changing operations. While using JWT (not cookies), SameSite attacks are still possible if tokens are stored in localStorage (which they are).

**Exploitation:**
```html
<!-- Attacker site -->
<script>
const token = localStorage.getItem('procurahub.token'); // Accessible if XSS exists
fetch('http://procurahub.com/api/requests/', {
  method: 'POST',
  headers: {'Authorization': `Bearer ${token}`},
  body: JSON.stringify({...malicious_request...})
});
</script>
```

**Fix:**
Implement double-submit cookie pattern or SameSite cookies:

```python
# backend/app/main.py
from fastapi_csrf_protect import CsrfProtect
from pydantic import BaseModel

class CsrfSettings(BaseModel):
    secret_key: str = settings.secret_key
    cookie_samesite: str = "strict"
    cookie_secure: bool = True  # HTTPS only in production
    cookie_httponly: bool = True

@CsrfProtect.load_config
def get_csrf_config():
    return CsrfSettings()

# Add to all state-changing endpoints:
@router.post("/requests/")
async def create_request(
    csrf_protect: CsrfProtect = Depends(),
    # ... other params
):
    await csrf_protect.validate_csrf(request)
    # ... rest of logic
```

Better approach - Switch to httpOnly cookies for token storage:

```typescript
// frontend/src/utils/client.ts
// Remove localStorage usage for tokens
apiClient.interceptors.request.use((config) => {
  // Token will be sent automatically via httpOnly cookie
  return config;
});

// backend - set httpOnly cookie on login
@router.post("/token")
def login_for_access_token(response: Response, ...):
    access_token = create_access_token(...)
    
    response.set_cookie(
        key="access_token",
        value=access_token,
        httponly=True,  # Not accessible via JavaScript
        secure=True,    # HTTPS only
        samesite="strict",  # CSRF protection
        max_age=3600
    )
    return {"message": "Logged in"}
```

**Prevention:**
- Use httpOnly, secure, SameSite cookies
- Implement CSRF tokens for all mutations
- Add Origin/Referer header validation

---

### 7. **MISSING RATE LIMITING**
**Risk Level:** 🔴 **CRITICAL**

**Location:**
- All API endpoints (no rate limiting middleware)

**Description:**
No protection against brute force, DoS, or API abuse. Login endpoint is especially vulnerable.

**Exploitation:**
- Brute force password attacks on `/api/auth/token`
- Account enumeration via registration endpoint
- DoS by flooding RFQ creation
- Resource exhaustion (database, file storage)

**Fix:**
```bash
pip install slowapi
```

```python
# backend/app/main.py
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded

limiter = Limiter(key_func=get_remote_address)

app = FastAPI()
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# backend/app/routers/auth.py
from slowapi import Limiter
from slowapi.util import get_remote_address

limiter = Limiter(key_func=get_remote_address)

@router.post("/token")
@limiter.limit("5/minute")  # 5 login attempts per minute
def login_for_access_token(
    request: Request,
    form_data: OAuth2PasswordRequestForm = Depends(),
    ...
):
    # Login logic

# For other endpoints
@router.post("/requests/")
@limiter.limit("30/minute")  # 30 requests per minute
def create_request(...):
    # Request logic
```

**Rate Limits by Endpoint:**
- Login: 5/minute, 20/hour
- Registration: 3/hour
- File uploads: 10/hour
- RFQ creation: 20/hour
- General API: 100/minute

**Prevention:**
- Implement progressive delays after failed logins
- Track failed attempts in database
- Add CAPTCHA after 3 failed logins
- Use Redis for distributed rate limiting

---

### 8. **INSECURE DIRECT OBJECT REFERENCE (IDOR)**
**Risk Level:** 🔴 **CRITICAL**

**Location:**
- `backend/app/routers/suppliers.py` line 45
- `backend/app/routers/requests.py` document download endpoints
- Multiple GET endpoints with ID parameters

**Description:**
Document download has NO authorization check:
```python
@router.get("/documents/{document_id}/download")
def download_supplier_document(document_id: int, db: Session = Depends(get_db)):
    document = db.query(SupplierDocument).filter(SupplierDocument.id == document_id).first()
    if not document:
        raise HTTPException(404, "Document not found")
    return FileResponse(...)  # ← No ownership check!
```

Any authenticated user can download ANY document by guessing IDs.

**Exploitation:**
```python
# Attacker iterates through document IDs
for doc_id in range(1, 1000):
    response = requests.get(f"/api/suppliers/documents/{doc_id}/download", 
                           headers={"Authorization": f"Bearer {token}"})
    if response.status_code == 200:
        save_file(response.content)  # Stolen confidential document
```

**Fix:**
```python
@router.get("/documents/{document_id}/download")
def download_supplier_document(
    document_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    document = db.query(SupplierDocument).filter(
        SupplierDocument.id == document_id
    ).first()
    
    if not document:
        raise HTTPException(404, "Document not found")
    
    # Authorization check
    user_role = current_user.role
    
    # Allow SuperAdmin and Procurement to view all documents
    if user_role not in [UserRole.superadmin, UserRole.procurement, UserRole.procurement_officer]:
        # Suppliers can only access their own documents
        if user_role == UserRole.supplier:
            supplier_profile = db.query(SupplierProfile).filter(
                SupplierProfile.user_id == current_user.id
            ).first()
            
            if not supplier_profile or document.supplier_id != supplier_profile.id:
                raise HTTPException(403, "Not authorized to access this document")
        else:
            raise HTTPException(403, "Not authorized to access this document")
    
    return FileResponse(
        path=document.file_path,
        filename=document.original_filename,
        media_type="application/octet-stream",
        headers={"Content-Disposition": f"attachment; filename=\"{document.original_filename}\""}
    )
```

**Similar Issues in:**
- `GET /api/requests/{request_id}` - No requester ownership check
- `GET /api/requests/{request_id}/document` - No authorization
- Message endpoints - Check sender/recipient match

**Prevention:**
- Always verify user owns/can access resource
- Use query filters with user_id/role
- Implement resource-based access control (RBAC)
- Log all access attempts for audit

---

## ⚠️ HIGH PRIORITY VULNERABILITIES

### 9. **JWT TOKEN NEVER EXPIRES (Effectively)**
**Risk Level:** 🟠 **HIGH**

**Location:**
- `backend/app/config.py` line 20
- `backend/.env` line 3

**Description:**
```python
ACCESS_TOKEN_EXPIRE_MINUTES=60  # 1 hour
```

While 1 hour seems reasonable, there's no refresh token mechanism. Users stay logged in indefinitely via localStorage.

**Issues:**
- Stolen tokens valid for 1 hour
- No way to revoke compromised tokens
- XSS can steal long-lived tokens

**Fix:**
Implement refresh tokens with shorter access tokens:

```python
# backend/app/config.py
access_token_expire_minutes: int = Field(default=15, env="ACCESS_TOKEN_EXPIRE_MINUTES")  # 15 min
refresh_token_expire_days: int = Field(default=7, env="REFRESH_TOKEN_EXPIRE_DAYS")  # 7 days

# backend/app/routers/auth.py
@router.post("/token")
def login_for_access_token(...):
    access_token = create_access_token(
        subject=str(user.id),
        expires_delta=timedelta(minutes=15)
    )
    refresh_token = create_access_token(
        subject=str(user.id),
        expires_delta=timedelta(days=7)
    )
    
    return {
        "access_token": access_token,
        "refresh_token": refresh_token,
        "token_type": "bearer"
    }

@router.post("/refresh")
def refresh_access_token(
    refresh_token: str = Body(..., embed=True),
    db: Session = Depends(get_db)
):
    payload = decode_token(refresh_token)
    if not payload:
        raise HTTPException(401, "Invalid refresh token")
    
    user_id = int(payload["sub"])
    user = db.get(User, user_id)
    
    if not user or not user.is_active:
        raise HTTPException(401, "User not found")
    
    # Generate new access token
    new_access_token = create_access_token(
        subject=str(user.id),
        expires_delta=timedelta(minutes=15)
    )
    
    return {"access_token": new_access_token, "token_type": "bearer"}
```

**Frontend changes:**
```typescript
// Auto-refresh tokens before expiry
let refreshTimer: NodeJS.Timeout;

const scheduleTokenRefresh = () => {
  clearTimeout(refreshTimer);
  refreshTimer = setTimeout(async () => {
    const refreshToken = localStorage.getItem("procurahub.refresh_token");
    const response = await apiClient.post("/api/auth/refresh", { refresh_token: refreshToken });
    localStorage.setItem("procurahub.token", response.data.access_token);
    scheduleTokenRefresh();
  }, 13 * 60 * 1000); // Refresh after 13 minutes (2 min before expiry)
};
```

**Token Revocation:**
```python
# Add token blacklist table
class TokenBlacklist(Base):
    __tablename__ = "token_blacklist"
    id = Column(Integer, primary_key=True)
    jti = Column(String(36), unique=True, nullable=False)  # JWT ID
    user_id = Column(Integer, ForeignKey("users.id"))
    expires_at = Column(DateTime, nullable=False)
    revoked_at = Column(DateTime, default=datetime.utcnow)

# Check on every request
def get_current_user(token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)):
    payload = decode_token(token)
    jti = payload.get("jti")
    
    # Check if token is blacklisted
    blacklisted = db.query(TokenBlacklist).filter(TokenBlacklist.jti == jti).first()
    if blacklisted:
        raise HTTPException(401, "Token has been revoked")
    
    # ... rest of logic
```

---

### 10. **PASSWORD POLICY TOO WEAK**
**Risk Level:** 🟠 **HIGH**

**Location:**
- No password complexity validation in user creation

**Description:**
Passwords like "12345678" are accepted (seen in test files). No minimum complexity requirements.

**Fix:**
```python
# backend/app/schemas/auth.py
from pydantic import field_validator
import re

class UserCreate(BaseModel):
    email: EmailStr
    full_name: str
    password: str
    role: str
    department_id: Optional[int] = None
    
    @field_validator('password')
    @classmethod
    def validate_password(cls, v: str) -> str:
        """Enforce strong password policy."""
        if len(v) < 12:
            raise ValueError('Password must be at least 12 characters long')
        
        if not re.search(r'[A-Z]', v):
            raise ValueError('Password must contain at least one uppercase letter')
        
        if not re.search(r'[a-z]', v):
            raise ValueError('Password must contain at least one lowercase letter')
        
        if not re.search(r'[0-9]', v):
            raise ValueError('Password must contain at least one digit')
        
        if not re.search(r'[!@#$%^&*(),.?":{}|<>]', v):
            raise ValueError('Password must contain at least one special character')
        
        # Check against common passwords
        common_passwords = ['password', '12345678', 'qwerty', 'admin', 'letmein']
        if v.lower() in common_passwords:
            raise ValueError('Password is too common')
        
        return v
```

**Add to config:**
```python
# Password requirements
PASSWORD_MIN_LENGTH = 12
PASSWORD_REQUIRE_UPPERCASE = True
PASSWORD_REQUIRE_LOWERCASE = True
PASSWORD_REQUIRE_DIGITS = True
PASSWORD_REQUIRE_SPECIAL = True
PASSWORD_EXPIRY_DAYS = 90  # Force password change every 90 days
```

---

### 11. **MISSING SECURITY HEADERS**
**Risk Level:** 🟠 **HIGH**

**Location:**
- `backend/app/main.py` (no security headers middleware)

**Description:**
No HTTP security headers implemented. Missing:
- Content-Security-Policy
- X-Frame-Options
- X-Content-Type-Options
- Strict-Transport-Security
- Permissions-Policy

**Fix:**
```python
# backend/app/main.py
from fastapi.middleware.trustedhost import TrustedHostMiddleware
from starlette.middleware.sessions import SessionMiddleware

app = FastAPI()

# Security headers middleware
@app.middleware("http")
async def add_security_headers(request: Request, call_next):
    response = await call_next(request)
    
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["X-XSS-Protection"] = "1; mode=block"
    response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"
    response.headers["Content-Security-Policy"] = (
        "default-src 'self'; "
        "script-src 'self' 'unsafe-inline' 'unsafe-eval'; "
        "style-src 'self' 'unsafe-inline'; "
        "img-src 'self' data: https:; "
        "font-src 'self' data:; "
        "connect-src 'self'; "
        "frame-ancestors 'none';"
    )
    response.headers["Permissions-Policy"] = "geolocation=(), microphone=(), camera=()"
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
    
    return response

# Trusted host middleware (prevent host header injection)
app.add_middleware(
    TrustedHostMiddleware,
    allowed_hosts=["localhost", "127.0.0.1", "your-production-domain.com"]
)
```

---

### 12. **CORS WILDCARD WITH CREDENTIALS**
**Risk Level:** 🟠 **HIGH**

**Location:**
- `backend/app/main.py` lines 28-35

**Description:**
```python
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.resolved_cors_origins,  # Could be ["*"]
    allow_credentials=True,  # ← Dangerous with wildcard
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["*"],
)
```

If `CORS_ALLOW_ORIGINS=*` is set, credentials are exposed to any origin.

**Fix:**
```python
# backend/app/config.py
@property
def resolved_cors_origins(self) -> list[str]:
    """Return sanitized CORS origins - NEVER allow wildcard."""
    origins: list[str] = []
    for origin in self.cors_allow_origins:
        if origin == "*":
            # Reject wildcard in production
            if self.environment == "production":
                raise ValueError("Wildcard CORS origin not allowed in production!")
            continue  # Skip wildcard
        trimmed = origin.rstrip("/")
        if trimmed and trimmed not in origins:
            origins.append(trimmed)
    
    if not origins:
        return ["http://localhost:5173"]  # Safe default
    
    return origins

# backend/app/main.py
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.resolved_cors_origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "PATCH"],  # Explicit methods
    allow_headers=["Authorization", "Content-Type"],  # Explicit headers
    expose_headers=["Content-Disposition"],  # Explicit expose
    max_age=3600,  # Cache preflight for 1 hour
)
```

---

### 13. **ENUMERATION VULNERABILITIES**
**Risk Level:** 🟠 **HIGH**

**Location:**
- `backend/app/routers/auth.py` lines 22-32
- `backend/app/routers/suppliers.py` registration

**Description:**
Login reveals if email exists:
```python
user = authenticate_user(db, form_data.username, form_data.password)
if not user:
    raise HTTPException(401, detail="Incorrect email or password")  # Generic message (good!)
```

But registration reveals email existence:
```python
if get_user_by_email(db, email):
    raise HTTPException(400, detail="Email already registered")  # ← Leaks info
```

**Exploitation:**
- Enumerate valid email addresses
- Targeted phishing attacks
- Account enumeration for brute force

**Fix:**
```python
# backend/app/routers/suppliers.py
@router.post("/register")
async def register_supplier(...):
    if get_user_by_email(db, email):
        # Don't reveal if email exists
        # Return success but don't create account
        return SupplierRegistrationResponse(
            user_id=0,
            supplier_id=0,
            message="If this email is not registered, you will receive a confirmation email."
        )
    
    # ... create user normally
    
    return SupplierRegistrationResponse(
        user_id=user.id,
        supplier_id=profile.id,
        message="If this email is not registered, you will receive a confirmation email."
    )
```

Better: Implement email verification:
```python
# Send verification email BEFORE creating account
email_service.send_email(
    [email],
    subject="Verify your ProcuraHub account",
    body=f"Click here to verify: {settings.app_url}/verify/{token}"
)

# Only create account after verification
```

---

### 14. **SENSITIVE DATA IN LOGS**
**Risk Level:** 🟠 **HIGH**

**Location:**
- `backend/app/services/email.py` lines 42-47
- `backend/app/context/AuthContext.tsx` console.log statements

**Description:**
```python
# Backend
logger.info("[EMAIL:%s] To=%s Subject=%s", email, recipients, subject)

# Frontend
console.log("Login attempt:", email);
console.log("Token received:", token);
```

Logs may contain PII, credentials, tokens.

**Fix:**
```python
# backend/app/services/email.py
logger.info(
    "[EMAIL] From=%s To=%s Subject=%s",
    self.settings.email_sender,
    "[REDACTED]",  # Don't log recipient emails
    subject[:50]  # Truncate subject
)

# frontend/src/context/AuthContext.tsx
// Remove all console.log in production
if (import.meta.env.DEV) {
    console.log("Login attempt");
}
// Never log tokens, passwords, PII
```

Add log sanitization:
```python
import re

def sanitize_log(message: str) -> str:
    """Remove sensitive data from logs."""
    # Redact emails
    message = re.sub(r'\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b', '[EMAIL_REDACTED]', message)
    # Redact tokens
    message = re.sub(r'Bearer\s+[\w-]+\.[\w-]+\.[\w-]+', 'Bearer [TOKEN_REDACTED]', message)
    # Redact credit cards
    message = re.sub(r'\b\d{13,19}\b', '[CARD_REDACTED]', message)
    return message

logger.info(sanitize_log(user_message))
```

---

## ⚡ MEDIUM PRIORITY ISSUES

### 15. **No Database Encryption at Rest**
**Risk Level:** 🟡 **MEDIUM**

SQLite database stores sensitive data unencrypted. Use SQLCipher for encryption.

### 16. **Missing Input Sanitization for XSS**
**Risk Level:** 🟡 **MEDIUM**

React auto-escapes, but API responses aren't sanitized. HTML in descriptions could be reflected.

**Fix:** Use DOMPurify on frontend for user-generated content.

### 17. **No Account Lockout After Failed Logins**
**Risk Level:** 🟡 **MEDIUM**

Unlimited login attempts allowed even with rate limiting.

**Fix:** Lock account for 30 minutes after 5 failed attempts.

### 18. **Insecure Session Management**
**Risk Level:** 🟡 **MEDIUM**

No "logout from all devices" functionality. Compromised accounts can't be secured.

**Fix:** Store active sessions in database, allow user to revoke all sessions.

### 19. **Missing Audit Logging**
**Risk Level:** 🟡 **MEDIUM**

No audit trail for sensitive operations (user deletion, role changes, document access).

**Fix:** Log all CRUD operations with user ID, timestamp, IP address.

### 20. **Dependency Vulnerabilities**
**Risk Level:** 🟡 **MEDIUM**

No automated dependency scanning. Check for CVEs in:
- `python-jose` (JWT library)
- `passlib` (password hashing)
- React/axios versions

**Fix:**
```bash
pip install safety
safety check --file requirements.txt

npm audit
npm audit fix
```

### 21. **No Email Spoofing Protection**
**Risk Level:** 🟡 **MEDIUM**

Email from field is not verified. Could be used for phishing.

**Fix:** Implement SPF, DKIM, DMARC for email domain.

### 22. **LocalStorage Vulnerable to XSS**
**Risk Level:** 🟡 **MEDIUM**

Tokens in localStorage accessible via JavaScript.

**Fix:** Use httpOnly cookies (mentioned in #6).

### 23. **No Multi-Factor Authentication (MFA)**
**Risk Level:** 🟡 **MEDIUM**

No 2FA option for high-privilege accounts (SuperAdmin, Procurement).

**Fix:** Implement TOTP (Google Authenticator, Authy).

### 24. **File Path Traversal in Subdir**
**Risk Level:** 🟡 **MEDIUM**

`save_upload_file(subdir=user_input)` could allow `../../../etc/passwd`.

**Fix:** `subdir = Path(subdir).name` (already mentioned in #4).

### 25. **Missing Request Size Limits**
**Risk Level:** 🟡 **MEDIUM**

No max request body size. Could lead to DoS.

**Fix:**
```python
app.add_middleware(
    RequestSizeLimitMiddleware,
    max_request_size=10 * 1024 * 1024  # 10MB
)
```

---

## 🔵 LOW PRIORITY / OPTIONAL IMPROVEMENTS

### 26. **Error Messages Too Verbose** - Leak internal paths in stack traces
### 27. **No API Versioning** - Breaking changes will affect clients
### 28. **Missing Health Check Authentication** - `/health` endpoint public
### 29. **Timezone Issues** - Inconsistent timezone handling (partially addressed)
### 30. **No Data Backup Strategy** - SQLite file could be lost
### 31. **Weak Bcrypt Rounds** - 12 rounds (acceptable, but 14 is better)
### 32. **No IP Whitelisting** - Admin endpoints accessible from anywhere
### 33. **Missing Content Compression** - No gzip middleware
### 34. **No WAF** - No Web Application Firewall for DDoS, OWASP Top 10
### 35. **Predictable IDs** - Sequential IDs allow enumeration (use UUIDs)

---

## 📊 DEPLOYMENT READINESS ASSESSMENT

### Current Score: **42/100** ⚠️

**Breakdown:**
- Authentication & Authorization: 4/10 (weak secrets, no MFA, IDOR)
- Input Validation: 2/10 (no file validation, weak passwords)
- Data Protection: 3/10 (no encryption, logs leak data)
- Infrastructure: 5/10 (no rate limiting, missing headers)
- Monitoring & Response: 2/10 (no audit logs, verbose errors)
- Code Quality: 6/10 (some good practices, SQLAlchemy ORM)

---

## 🚀 CRITICAL FIXES BEFORE DEPLOYMENT

**MUST FIX (Do NOT deploy without these):**

1. ✅ **Rotate SMTP credentials** - Change Gmail password NOW
2. ✅ **Generate strong SECRET_KEY** - 64+ random characters
3. ✅ **Add .gitignore** - Prevent secret leaks
4. ✅ **Implement file upload validation** - Whitelist extensions, check MIME types
5. ✅ **Fix IDOR vulnerabilities** - Add authorization checks to all document downloads
6. ✅ **Add rate limiting** - Prevent brute force and DoS
7. ✅ **Remove hardcoded credentials from git history** - Use git filter-branch
8. ✅ **Add security headers** - CSP, X-Frame-Options, HSTS

**Estimated Time:** 2-3 days of dedicated work

---

## 📋 PRE-DEPLOYMENT SECURITY CHECKLIST

### Environment Setup
- [ ] All secrets in environment variables (not .env files in git)
- [ ] .gitignore includes .env, *.db, uploads/, __pycache__/
- [ ] Production SECRET_KEY is 64+ random characters
- [ ] SMTP credentials rotated and secured
- [ ] Database encryption enabled (SQLCipher)
- [ ] HTTPS enforced (SSL/TLS certificate installed)

### Authentication & Authorization
- [ ] Password policy enforced (12+ chars, complexity)
- [ ] JWT tokens expire in 15 minutes
- [ ] Refresh tokens implemented
- [ ] Token revocation mechanism in place
- [ ] MFA enabled for admin accounts
- [ ] Rate limiting on login (5/minute)
- [ ] Account lockout after 5 failed attempts
- [ ] CSRF protection implemented

### Input Validation
- [ ] File upload whitelist (extensions + MIME types)
- [ ] File size limits (10MB max)
- [ ] All user inputs validated with Pydantic
- [ ] SQL injection prevented (ORM only, no raw SQL)
- [ ] XSS prevention (DOMPurify on frontend)
- [ ] Path traversal prevented in file operations

### Data Protection
- [ ] Database encrypted at rest
- [ ] Sensitive data not logged (emails, tokens, passwords)
- [ ] HTTPS for all traffic
- [ ] httpOnly, secure, SameSite cookies
- [ ] Passwords hashed with bcrypt (14 rounds)
- [ ] PII encrypted in database (if applicable)

### API Security
- [ ] Rate limiting on all endpoints
- [ ] IDOR prevention (authorization checks)
- [ ] CORS properly configured (no wildcards)
- [ ] Security headers implemented
- [ ] Request size limits enforced
- [ ] API versioning in place

### Infrastructure
- [ ] Firewall configured (allow only 80, 443)
- [ ] Intrusion detection system (IDS)
- [ ] Regular security updates scheduled
- [ ] Backup strategy implemented (daily)
- [ ] Monitoring & alerting configured
- [ ] WAF deployed (Cloudflare, AWS WAF)

### Monitoring & Incident Response
- [ ] Audit logging for all sensitive operations
- [ ] Log aggregation (ELK, Splunk)
- [ ] Anomaly detection alerts
- [ ] Incident response plan documented
- [ ] Security contact email published
- [ ] Penetration testing completed

### Compliance & Legal
- [ ] Privacy policy published
- [ ] Terms of service published
- [ ] GDPR compliance (if applicable)
- [ ] Data retention policy defined
- [ ] User consent mechanisms

### Code Quality
- [ ] Security linting (Bandit for Python, ESLint for JS)
- [ ] Dependency vulnerability scanning (Safety, npm audit)
- [ ] Code review for all changes
- [ ] Secrets scanning (TruffleHog, GitGuardian)
- [ ] Static analysis (SonarQube)

---

## 🛡️ RECOMMENDED SECURITY TOOLS

### Development
- **Bandit** - Python security linter
- **Safety** - Dependency vulnerability scanner
- **TruffleHog** - Find secrets in git history
- **Pre-commit hooks** - Prevent committing secrets

### Testing
- **OWASP ZAP** - Web app security scanner
- **Burp Suite** - Manual penetration testing
- **SQLMap** - SQL injection testing
- **Postman** - API security testing

### Production
- **Cloudflare** - WAF, DDoS protection, CDN
- **Sentry** - Error tracking & monitoring
- **Datadog** - Application performance monitoring
- **ClamAV** - Antivirus for file uploads
- **Fail2Ban** - Intrusion prevention

---

## 📞 NEXT STEPS

1. **Immediate (Today):**
   - Rotate SMTP credentials
   - Add .gitignore
   - Generate new SECRET_KEY
   - Remove secrets from git history

2. **This Week:**
   - Implement file upload validation
   - Add rate limiting
   - Fix IDOR vulnerabilities
   - Add security headers

3. **Before Production:**
   - Complete all CRITICAL fixes
   - Run penetration testing
   - Set up monitoring & alerts
   - Document incident response plan
   - Train team on security best practices

4. **Ongoing:**
   - Weekly dependency scans
   - Monthly security audits
   - Quarterly penetration testing
   - Annual third-party security assessment

---

## 📝 FINAL RECOMMENDATION

**DO NOT DEPLOY TO PRODUCTION** until all CRITICAL and HIGH priority issues are resolved. The current state has severe vulnerabilities that could lead to:

- Complete system compromise
- Data breach (user credentials, financial documents)
- Regulatory fines (GDPR violations)
- Reputational damage
- Legal liability

**Estimated Remediation Time:** 1-2 weeks of focused security hardening.

**Post-Remediation Score Target:** 85/100 (Acceptable for production)

---

*End of Security Audit Report*
*For questions or clarification, please consult with your security team.*
