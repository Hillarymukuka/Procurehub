# URGENT: Render Environment Variables Setup

## Problem
CORS error still occurring because Render doesn't automatically read `.env.production` file. Environment variables must be set manually in Render dashboard.

## Required Actions on Render Dashboard

### Step 1: Go to Render Dashboard
1. Navigate to: https://dashboard.render.com/
2. Find your service: **procurehub** (or similar name)
3. Click on the service name

### Step 2: Navigate to Environment Variables
1. Click on **Environment** tab (left sidebar)
2. You'll see a list of environment variables

### Step 3: Add/Update These Variables

**Critical CORS Variable:**
```
Key: CORS_ALLOW_ORIGINS
Value: ["https://procurehub.pages.dev"]
```
⚠️ **IMPORTANT**: Include the square brackets and quotes exactly as shown!

**Email Configuration (to fix email notifications):**
```
Key: EMAIL_CONSOLE_FALLBACK
Value: false
```

### Step 4: Verify Other Required Variables

Make sure these are also set:

```
ENVIRONMENT=production
DATABASE_URL=postgresql://procurehub_bdzp_user:trWQgIifvBLhX69tzitiPKUhC50baF8P@dpg-d4i317h5pdvs739i5drg-a/procurehub_bdzp
SECRET_KEY=WAGbkEYcW3QqU8ZThQRVKbz2J4VuUuf0xm1hHaX8E1IDUVFXk3UqIYdTIWeZXNetMeXehR4fxjSj_Bd819c0IQ
ACCESS_TOKEN_EXPIRE_MINUTES=60
EMAIL_SENDER=ancestroai@gmail.com
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USERNAME=ancestroai@gmail.com
SMTP_PASSWORD=azdqratjjkuuhvjq
SMTP_USE_TLS=true
INVITATION_BATCH_SIZE=25
```

### Step 5: Save and Redeploy
1. Click **Save Changes** button
2. Render will automatically redeploy your service
3. Wait 2-5 minutes for deployment to complete

### Step 6: Verify Deployment
1. Check **Logs** tab in Render dashboard
2. Look for these log lines:
   ```
   CORS configured with origins: ['https://procurehub.pages.dev']
   CORS raw config: ['https://procurehub.pages.dev']
   ```
3. If you see `['http://localhost:5173']` instead, the env var wasn't set correctly

## Troubleshooting

### If CORS still doesn't work:

**Option A: Check the exact format**
- Render might interpret the JSON array differently
- Try without brackets: `https://procurehub.pages.dev`
- The code will auto-wrap it in a list

**Option B: Add multiple origins**
If you need to support multiple domains:
```
["https://procurehub.pages.dev","http://localhost:5173"]
```

**Option C: Temporary wildcard (NOT for production)**
For immediate testing only:
```
CORS_ALLOW_ORIGINS=*
```
Then change back to specific domain after confirming it works.

### If emails still don't work:

1. Verify `EMAIL_CONSOLE_FALLBACK=false` (not "False" or "FALSE")
2. Check SMTP logs for authentication errors
3. Verify Gmail App Password hasn't expired
4. Check if Gmail is blocking the login

## Quick Test

After deployment completes:

1. **Test CORS**: Try creating a department in SuperAdmin dashboard
2. **Test Email**: Create a new supplier and check for welcome email
3. **Check Logs**: Look for "Email sent successfully to..." in Render logs

## Common Mistakes

❌ Setting `CORS_ALLOW_ORIGINS` as: `https://procurehub.pages.dev` (no brackets)
✅ Correct: `["https://procurehub.pages.dev"]`

❌ Setting `EMAIL_CONSOLE_FALLBACK` as: `False` or `FALSE`
✅ Correct: `false` (lowercase)

❌ Forgetting to click "Save Changes"
✅ Always save and wait for auto-redeploy

## Alternative: Use Render Secrets

For sensitive values like passwords, use Render's Secret Files feature:
1. Go to **Environment** > **Secret Files**
2. Create `.env` file with all variables
3. Render will automatically load it

But for now, individual env vars in the dashboard should work.
