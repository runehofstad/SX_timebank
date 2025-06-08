# Email Troubleshooting Guide for Production

## Current Configuration
- **SMTP Host**: smtp.domeneshop.no
- **Port**: 587 (STARTTLS)
- **Username**: studioxtech10
- **From Address**: timebank@studiox.tech

## Common Issues and Solutions

### 1. Emails Not Being Sent

**Check Environment Variables in Vercel:**
1. Go to your Vercel project settings
2. Navigate to Environment Variables
3. Ensure these are set for production:
   - `EMAIL_HOST=smtp.domeneshop.no`
   - `EMAIL_PORT=587`
   - `EMAIL_USER=studioxtech10`
   - `EMAIL_PASSWORD=your-password`
   - `EMAIL_FROM=timebank@studiox.tech`
   - `NEXT_PUBLIC_APP_URL=https://your-domain.vercel.app`

**Verify SMTP Authentication:**
- The username might need to be the full email address: `studioxtech10@studiox.tech`
- Double-check the password doesn't contain special characters that need escaping

### 2. Emails Going to Spam

**SPF Record:**
Add to your DNS (studiox.tech):
```
v=spf1 include:domeneshop.no ~all
```

**DKIM Configuration:**
- Check with Domeneshop for DKIM setup instructions
- Add the provided DKIM record to your DNS

**Email Content:**
- Avoid spam trigger words
- Include both HTML and plain text versions (already implemented)
- Use a recognizable from name

### 3. Authentication Failures

**Try Alternative Configurations:**

Option 1 - Full email as username:
```
EMAIL_USER=timebank@studiox.tech
```

Option 2 - Different port:
```
EMAIL_PORT=465
```

Option 3 - Alternative from address:
```
EMAIL_FROM=studioxtech10@studiox.tech
```

### 4. Connection Timeouts

The email service now includes:
- 30-second timeouts for connections
- TLS 1.2 minimum version
- Better error handling

### 5. Debugging in Production

**Enable Detailed Logging:**
1. Check Vercel function logs
2. Look for these log messages:
   - "Email configuration:"
   - "Verifying email configuration..."
   - "Email sent successfully:"
   - "Error sending email:"

**Test Email Sending:**
1. Try sending an invite from the production app
2. Check Vercel function logs immediately
3. Look for specific error messages

### 6. Vercel-Specific Issues

**Cold Start Issues:**
- First email after deployment might timeout
- Subsequent emails should work normally

**Environment Variable Loading:**
- Ensure no spaces in environment values
- Redeploy after changing environment variables

### 7. Alternative Email Services

If Domeneshop continues to have issues, consider:

**SendGrid (Recommended for production):**
```
EMAIL_HOST=smtp.sendgrid.net
EMAIL_PORT=587
EMAIL_USER=apikey
EMAIL_PASSWORD=your-sendgrid-api-key
```

**Postmark:**
```
EMAIL_HOST=smtp.postmarkapp.com
EMAIL_PORT=587
EMAIL_USER=your-postmark-server-token
EMAIL_PASSWORD=your-postmark-server-token
```

## Testing Email Configuration

### Local Testing Script
Create a test file `test-email.js`:

```javascript
const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  host: 'smtp.domeneshop.no',
  port: 587,
  secure: false,
  auth: {
    user: 'studioxtech10',
    pass: 'your-password'
  },
  tls: {
    rejectUnauthorized: false,
    minVersion: 'TLSv1.2'
  }
});

async function testEmail() {
  try {
    await transporter.verify();
    console.log('Server is ready to take our messages');
    
    const result = await transporter.sendMail({
      from: 'timebank@studiox.tech',
      to: 'test@example.com',
      subject: 'Test Email',
      text: 'This is a test email'
    });
    
    console.log('Email sent:', result);
  } catch (error) {
    console.error('Error:', error);
  }
}

testEmail();
```

Run with: `node test-email.js`

## Contact Support

If issues persist:
1. Contact Domeneshop support with:
   - Your domain (studiox.tech)
   - SMTP username (studioxtech10)
   - Error messages from logs
2. Ask specifically about:
   - Correct SMTP settings for your account
   - Whether full email is required as username
   - Any IP restrictions or authentication requirements