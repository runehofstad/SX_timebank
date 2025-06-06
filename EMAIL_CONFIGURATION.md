# Email Configuration Guide

## Supported Email Services

### Microsoft 365/Outlook (Recommended for STUDIO X)

**SMTP Settings:**
- Host: `smtp.office365.com`
- Port: `587`
- Security: STARTTLS
- Authentication: Required

**Configuration in .env.local:**
```
EMAIL_HOST=smtp.office365.com
EMAIL_PORT=587
EMAIL_USER=your-email@studiox.no
EMAIL_PASSWORD=your-password
EMAIL_FROM=noreply@studiox.no
```

**Important Notes:**
- Use your full email address as the username
- The FROM address should be either the same as EMAIL_USER or an alias on that account
- You may need to enable SMTP authentication in your Microsoft 365 admin settings

### Domeneshop Email

**SMTP Settings:**
- Host: `smtp.domeneshop.no`
- Port: `587` (or `465` for SSL)
- Security: STARTTLS (port 587) or SSL/TLS (port 465)

**Configuration in .env.local:**
```
EMAIL_HOST=smtp.domeneshop.no
EMAIL_PORT=587
EMAIL_USER=your-email@yourdomain.no
EMAIL_PASSWORD=your-password
EMAIL_FROM=noreply@yourdomain.no
```

### Gmail (Alternative)

**SMTP Settings:**
- Host: `smtp.gmail.com`
- Port: `587`
- Requires App Password (not regular password)

**Configuration in .env.local:**
```
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USER=your-email@gmail.com
EMAIL_PASSWORD=your-app-password
EMAIL_FROM=noreply@yourdomain.com
```

## Development Mode

When running locally with `NODE_ENV=development`, the system will:
- Log emails to the console instead of sending them
- Still create invitation records in Firestore
- Allow testing without valid SMTP credentials

## Testing Email Configuration

1. Update your `.env.local` with real credentials
2. Restart the development server
3. Try sending an invite
4. Check the console logs for success/error messages

## Troubleshooting

**Microsoft 365 Issues:**
- Ensure SMTP authentication is enabled in admin center
- Check if your account has 2FA enabled (may need app password)
- Verify the FROM address is valid for your account

**Connection Errors:**
- Check firewall settings
- Verify the port is not blocked
- Try using port 465 with SSL if 587 doesn't work

**Authentication Errors:**
- Double-check username/password
- For Microsoft 365, use full email as username
- Ensure no special characters need escaping in password