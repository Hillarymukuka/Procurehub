# ProcureHub Deployment Guide

## Overview
This guide covers deploying ProcureHub with:
- **Frontend**: Cloudflare Pages
- **Backend**: Render
- **Database**: Render PostgreSQL

## Prerequisites
- GitHub account with repository: https://github.com/Hillarymukuka/Procurehub.git
- Cloudflare account
- Render account
- Gmail account with App Password (for email notifications)

## Backend Deployment (Render)

### 1. Create Render Account
1. Sign up at https://render.com
2. Connect your GitHub account

### 2. Deploy Backend
1. Click "New +" → "Web Service"
2. Connect to your GitHub repository: `Hillarymukuka/Procurehub`
3. Configure settings:
   - **Name**: `procurehub-backend`
   - **Region**: Oregon (or closest to your users)
   - **Branch**: `main`
   - **Root Directory**: `backend`
   - **Runtime**: Python 3
   - **Build Command**: `pip install -r requirements.txt`
   - **Start Command**: `uvicorn app.main:app --host 0.0.0.0 --port $PORT`

### 3. Create PostgreSQL Database
1. Click "New +" → "PostgreSQL"
2. Configure:
   - **Name**: `procurehub-db`
   - **Region**: Same as backend (Oregon)
   - **Plan**: Free
3. Once created, copy the **Internal Database URL**

### 4. Configure Environment Variables
In your backend web service, add these environment variables:

```bash
ENVIRONMENT=production
DATABASE_URL=<paste-internal-database-url>
SECRET_KEY=<generate-using-python-command-below>
ACCESS_TOKEN_EXPIRE_MINUTES=60
CORS_ALLOW_ORIGINS=https://your-app.pages.dev
EMAIL_SENDER=noreply@procurahub.com
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USERNAME=your-email@gmail.com
SMTP_PASSWORD=your-gmail-app-password
INVITATION_BATCH_SIZE=25
```

**Generate SECRET_KEY:**
```bash
python -c "import secrets; print(secrets.token_urlsafe(64))"
```

**Get Gmail App Password:**
1. Go to Google Account → Security → 2-Step Verification
2. Scroll to "App passwords"
3. Generate password for "Mail"
4. Use this as `SMTP_PASSWORD`

### 5. Deploy
1. Click "Create Web Service"
2. Wait for deployment (5-10 minutes)
3. Note your backend URL: `https://procurehub-backend.onrender.com`

## Frontend Deployment (Cloudflare Pages)

### 1. Update Frontend Configuration
Before deploying, update `frontend/.env.production`:

```bash
VITE_API_BASE_URL=https://procurehub-backend.onrender.com
```

Commit this change to your repository.

### 2. Create Cloudflare Account
1. Sign up at https://pages.cloudflare.com
2. Connect your GitHub account

### 3. Deploy Frontend
1. Click "Create a project"
2. Select your repository: `Hillarymukuka/Procurehub`
3. Configure build settings:
   - **Project name**: `procurehub`
   - **Production branch**: `main`
   - **Framework preset**: Vite
   - **Build command**: `npm run build`
   - **Build output directory**: `dist`
   - **Root directory**: `frontend`

### 4. Set Environment Variables
In Cloudflare Pages project settings → Environment variables:

```bash
VITE_API_BASE_URL=https://procurehub-backend.onrender.com
```

### 5. Deploy
1. Click "Save and Deploy"
2. Wait for deployment (2-5 minutes)
3. Your app will be available at: `https://procurehub.pages.dev`

### 6. Update Backend CORS
Return to Render backend → Environment Variables → Update:

```bash
CORS_ALLOW_ORIGINS=https://procurehub.pages.dev
```

## Post-Deployment Setup

### 1. Initialize Database
Run the database initialization script on Render:

1. Go to your backend web service
2. Click "Shell" tab
3. Run:
```bash
python init_fresh_db.py
```

### 2. Create Super Admin
Create your first admin user:

```bash
python create_superadmin.py
```

Follow prompts to set email and password.

### 3. Test Application
1. Visit `https://procurehub.pages.dev`
2. Login with super admin credentials
3. Test key features:
   - Department creation
   - User invitations
   - RFQ creation
   - Email notifications

## Custom Domain (Optional)

### Cloudflare Pages
1. Go to project → Custom domains
2. Add your domain: `procurehub.com`
3. Update DNS records as instructed
4. Update backend CORS to include your custom domain

### Render
1. Go to web service → Settings → Custom Domain
2. Add your API subdomain: `api.procurehub.com`
3. Update DNS with CNAME record

## Monitoring

### Render
- **Logs**: Web Service → Logs tab
- **Metrics**: Dashboard shows CPU, memory, requests
- **Alerts**: Set up email notifications for failures

### Cloudflare Pages
- **Analytics**: Built-in analytics dashboard
- **Logs**: Deployment logs and function logs
- **Performance**: Web Vitals and performance metrics

## Troubleshooting

### Backend Issues
- **500 Error**: Check Render logs for Python errors
- **Database Connection**: Verify DATABASE_URL is correct
- **CORS Error**: Ensure CORS_ALLOW_ORIGINS includes frontend URL

### Frontend Issues
- **API Connection Failed**: Check VITE_API_BASE_URL is correct
- **404 on Refresh**: Verify `_redirects` file is in `frontend/public/`
- **Build Failed**: Check npm dependencies in package.json

### Email Issues
- **Emails Not Sending**: Verify SMTP credentials
- **Gmail Blocking**: Ensure using App Password, not account password
- **Rate Limiting**: Gmail has daily send limits (500/day for free)

## Security Checklist

- [ ] Strong SECRET_KEY (64+ characters)
- [ ] DATABASE_URL uses internal connection string
- [ ] CORS_ALLOW_ORIGINS only includes your domains
- [ ] SMTP_PASSWORD uses Gmail App Password
- [ ] Environment variables marked as secret in Render
- [ ] HTTPS enforced on both frontend and backend
- [ ] Regular security updates (dependabot enabled)

## Costs

### Free Tier Limits
- **Render Web Service**: 750 hours/month (enough for 1 app)
- **Render PostgreSQL**: 90 days free, then $7/month
- **Cloudflare Pages**: Unlimited requests, 500 builds/month
- **Total**: ~$7/month after PostgreSQL trial

## Maintenance

### Regular Tasks
- Monitor Render logs for errors
- Check database size (upgrade if needed)
- Update dependencies monthly
- Backup PostgreSQL database weekly

### Updating Application
1. Push changes to GitHub `main` branch
2. Cloudflare Pages auto-deploys frontend
3. Render auto-deploys backend
4. Monitor deployment logs

## Support Resources

- **Render Docs**: https://render.com/docs
- **Cloudflare Pages Docs**: https://developers.cloudflare.com/pages
- **FastAPI Deployment**: https://fastapi.tiangolo.com/deployment
- **Vite Deployment**: https://vitejs.dev/guide/static-deploy.html

---

**Deployment prepared**: This application is ready for production deployment with all security fixes applied, rate limiting enabled, and proper error handling configured.
