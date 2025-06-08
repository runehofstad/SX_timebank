# SendGrid Setup for Timebank System

## Quick Setup Guide

### 1. Create SendGrid Account
1. Go to [https://sendgrid.com](https://sendgrid.com)
2. Sign up for a free account (100 emails/day)

### 2. Create API Key
1. Navigate to Settings → API Keys
2. Click "Create API Key"
3. Name: "Timebank System"
4. Permissions: Full Access
5. Click "Create & View"
6. **COPY THE API KEY IMMEDIATELY** (shown only once)

### 3. Verify Sender
1. Go to Settings → Sender Authentication
2. Choose "Single Sender Verification"
3. Fill in:
   - From Email: `timebank@studiox.tech`
   - From Name: `STUDIO X Timebank`
   - Reply To: `noreply@studiox.tech`
4. Complete verification

### 4. Update Vercel Environment Variables

In your Vercel project settings, update these variables:

```
EMAIL_HOST=smtp.sendgrid.net
EMAIL_PORT=587
EMAIL_USER=apikey
EMAIL_PASSWORD=YOUR_SENDGRID_API_KEY_HERE
EMAIL_FROM=timebank@studiox.tech
```

**Important Notes:**
- EMAIL_USER must be exactly `apikey` (literal string)
- EMAIL_PASSWORD should be your SendGrid API key (starts with `SG.`)
- EMAIL_FROM must match your verified sender

### 5. Test Configuration

After updating Vercel:
1. Wait for automatic redeployment
2. Visit https://timebank-system.vercel.app/test-email
3. Send a test email

## Troubleshooting

### "Sender not verified" error
- Make sure you've completed sender verification
- Check that EMAIL_FROM matches exactly

### "Invalid API Key" error
- Verify the API key is copied correctly
- No extra spaces or characters
- Starts with `SG.`

### Rate Limits
- Free tier: 100 emails/day
- Upgrade if you need more

## Production Best Practices

1. **Domain Authentication** (Optional but recommended)
   - Improves deliverability
   - Go to Settings → Sender Authentication → Domain Authentication

2. **Monitor Usage**
   - Check SendGrid dashboard for stats
   - Set up alerts for failures

3. **Email Templates**
   - Consider using SendGrid's template system for consistent branding