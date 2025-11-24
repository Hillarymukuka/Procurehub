# Gmail Email Setup Guide for ProcuraHub

## ✅ Configuration Complete!

Your Gmail account `ancestroai@gmail.com` has been configured for the email notification system.

## 🔐 Important: Get Your Gmail App Password

Gmail requires an **App Password** (not your regular Gmail password) for security.

### Steps to Generate a Gmail App Password:

1. **Enable 2-Step Verification** (if not already enabled):
   - Go to: https://myaccount.google.com/security
   - Click on "2-Step Verification"
   - Follow the steps to enable it

2. **Generate App Password**:
   - Go to: https://myaccount.google.com/apppasswords
   - Or navigate: Google Account → Security → 2-Step Verification → App passwords
   - Select "Mail" as the app
   - Select "Windows Computer" as the device (or "Other")
   - Click "Generate"
   - Copy the 16-character password (it will look like: `xxxx xxxx xxxx xxxx`)

3. **Update the `.env` file**:
   - Open: `h:\python Projects\Procure\backend\.env`
   - Replace `your-app-password-here` with your generated app password
   - Remove spaces from the password (use: `xxxxxxxxxxxxxxxx`)

   Example:
   ```
   SMTP_PASSWORD=abcd efgh ijkl mnop  ❌ (with spaces)
   SMTP_PASSWORD=abcdefghijklmnop     ✅ (without spaces)
   ```

## 📧 Email Configuration Details

The following settings are configured in your `.env` file:

- **EMAIL_SENDER**: ancestroai@gmail.com
- **EMAIL_CONSOLE_FALLBACK**: false (will send real emails)
- **SMTP_HOST**: smtp.gmail.com
- **SMTP_PORT**: 587
- **SMTP_USERNAME**: ancestroai@gmail.com
- **SMTP_USE_TLS**: true

## 🚀 Testing the Email System

After updating your app password:

1. Restart your backend server
2. Trigger any email event (e.g., invite a supplier, approve a request)
3. Check your Gmail sent folder to verify emails are being sent
4. Check the recipient's inbox

## 🎯 Email Events That Will Trigger:

- ✉️ RFQ invitations to suppliers
- 📥 New quotation submissions (to procurement)
- 🎉 Quotation approvals (to winning supplier)
- 📬 Quotation rejections (to losing suppliers)
- ✅ Purchase request approvals (procurement & finance)
- ❌ Purchase request rejections
- 💰 Budget approval notifications

## 🔧 Troubleshooting

### If emails aren't sending:

1. **Check your app password** - Make sure it's correct and has no spaces
2. **Check 2-Step Verification** - Must be enabled for app passwords
3. **Check logs** - Look for error messages in the console/terminal
4. **Test with console fallback** - Set `EMAIL_CONSOLE_FALLBACK=true` to see emails in logs

### Common Errors:

- **"Username and Password not accepted"** → Wrong app password or 2-step verification not enabled
- **"SMTP Authentication Error"** → App password has spaces or typos
- **"Connection refused"** → Check firewall or internet connection

## 📝 Switch Between Console and Real Emails

In your `.env` file:

```bash
# Send real emails via Gmail
EMAIL_CONSOLE_FALLBACK=false

# Or just log to console (for testing)
EMAIL_CONSOLE_FALLBACK=true
```

## 🔒 Security Notes

- ✅ The `.env` file is gitignored - your password won't be committed
- ✅ App passwords are safer than your main Gmail password
- ✅ You can revoke app passwords anytime from Google Account settings
- ⚠️ Never share your `.env` file or commit it to version control

---

**Status**: ✅ Gmail configuration complete! Just add your app password to get started.
