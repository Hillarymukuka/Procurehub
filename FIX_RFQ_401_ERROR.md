# 🔧 Fix Applied: RFQ Creation 401 Error

## Issue
When creating RFQs from the frontend, users were getting:
```
INFO: 127.0.0.1:64741 - "POST /api/rfqs HTTP/1.1" 307 Temporary Redirect
INFO: 127.0.0.1:63329 - "POST /api/rfqs/ HTTP/1.1" 401 Unauthorized
```

## Root Cause
1. Frontend was calling `/api/rfqs` (without trailing slash)
2. FastAPI automatically redirected to `/api/rfqs/` (with trailing slash) using 307
3. **The 307 redirect doesn't preserve the Authorization header**
4. Result: Second request arrives without authentication → 401 Unauthorized

## Solution
Updated the frontend to use the correct URL with trailing slash from the start:

**Changed:**
```typescript
// Before
await apiClient.post("/api/rfqs", { ... });

// After  
await apiClient.post("/api/rfqs/", { ... });
```

**File Modified:**
- `frontend/src/pages/StaffDashboard.tsx` - Line 81

## Why This Happens
FastAPI's trailing slash handling:
- Routes defined as `@router.post("/")` expect trailing slash
- Requests without it get 307 redirected
- 307 redirects **don't preserve headers** (by HTTP spec)
- Authorization header is lost → authentication fails

## Prevention
Always use trailing slashes for POST/PUT/DELETE endpoints:
```typescript
✅ "/api/rfqs/"         // Correct
❌ "/api/rfqs"          // Will redirect and lose auth

✅ "/api/admin/users/"  // Correct
❌ "/api/admin/users"   // Will redirect and lose auth
```

GET requests are more forgiving, but consistency is best.

## Testing
After this fix:
1. Create RFQ from UI → Works ✅
2. Demo data script → Works ✅
3. No more 307 redirects
4. No more 401 errors

## Status
✅ **Fixed and tested**

The issue is now resolved!
