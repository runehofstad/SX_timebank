import { NextRequest, NextResponse } from 'next/server';
import { sendEmail } from '@/lib/email/service';

export async function POST(request: NextRequest) {
  try {
    const { testEmail } = await request.json();
    
    if (!testEmail) {
      return NextResponse.json({ error: 'Test email address is required' }, { status: 400 });
    }
    
    console.log('=== Email Test Started ===');
    console.log('Test email address:', testEmail);
    console.log('Environment variables check:');
    console.log('EMAIL_HOST:', process.env.EMAIL_HOST ? '✓ Set' : '✗ Missing');
    console.log('EMAIL_PORT:', process.env.EMAIL_PORT ? '✓ Set' : '✗ Missing');
    console.log('EMAIL_USER:', process.env.EMAIL_USER ? `✓ Set (${process.env.EMAIL_USER})` : '✗ Missing');
    console.log('EMAIL_PASSWORD:', process.env.EMAIL_PASSWORD ? '✓ Set' : '✗ Missing');
    console.log('EMAIL_FROM:', process.env.EMAIL_FROM ? `✓ Set (${process.env.EMAIL_FROM})` : '✗ Missing');
    console.log('NODE_ENV:', process.env.NODE_ENV);
    console.log('========================');
    
    const emailContent = {
      to: [testEmail],
      subject: 'STUDIO X Timebank - Email Test',
      html: `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background-color: #FF3366; padding: 40px 20px; text-align: center;">
            <h1 style="color: #ffffff; margin: 0; font-size: 32px; font-weight: 700;">STUDIO X</h1>
            <p style="color: #ffffff; margin: 10px 0 0 0; font-size: 16px; opacity: 0.9;">TIMEBANK</p>
          </div>
          
          <div style="padding: 40px 30px;">
            <h2 style="color: #1a1a1a; font-size: 24px; margin-bottom: 20px;">Email Configuration Test</h2>
            
            <p style="color: #4a4a4a; font-size: 16px; line-height: 1.6;">This is a test email from your STUDIO X Timebank system.</p>
            
            <p style="color: #4a4a4a; font-size: 16px; line-height: 1.6;">If you're receiving this email, your email configuration is working correctly!</p>
            
            <div style="background-color: #f5f5f5; padding: 20px; border-radius: 8px; margin: 20px 0;">
              <h3 style="margin-top: 0; color: #1a1a1a;">Configuration Details:</h3>
              <ul style="margin: 0; padding-left: 20px; color: #4a4a4a;">
                <li><strong>SMTP Host:</strong> ${process.env.EMAIL_HOST}</li>
                <li><strong>SMTP Port:</strong> ${process.env.EMAIL_PORT}</li>
                <li><strong>From Address:</strong> ${process.env.EMAIL_FROM}</li>
                <li><strong>Timestamp:</strong> ${new Date().toLocaleString()}</li>
              </ul>
            </div>
          </div>
          
          <div style="background-color: #f9f9f9; padding: 30px; text-align: center; border-top: 1px solid #e5e7eb;">
            <p style="color: #9ca3af; font-size: 12px; margin: 0;">
              © ${new Date().getFullYear()} STUDIO X. All rights reserved.
            </p>
          </div>
        </div>
      `,
      text: `
        STUDIO X TIMEBANK - Email Configuration Test
        
        This is a test email from your STUDIO X Timebank system.
        
        If you're receiving this email, your email configuration is working correctly!
        
        Configuration Details:
        - SMTP Host: ${process.env.EMAIL_HOST}
        - SMTP Port: ${process.env.EMAIL_PORT}
        - From Address: ${process.env.EMAIL_FROM}
        - Timestamp: ${new Date().toLocaleString()}
        
        © ${new Date().getFullYear()} STUDIO X. All rights reserved.
      `,
    };
    
    await sendEmail(emailContent);
    
    return NextResponse.json({ 
      success: true,
      message: 'Test email sent successfully',
      details: {
        to: testEmail,
        from: process.env.EMAIL_FROM,
        host: process.env.EMAIL_HOST,
        port: process.env.EMAIL_PORT,
        username: process.env.EMAIL_USER
      }
    });
  } catch (error) {
    console.error('Test email failed:', error);
    return NextResponse.json({ 
      error: 'Failed to send test email',
      details: error instanceof Error ? error.message : 'Unknown error',
      diagnostics: {
        host: process.env.EMAIL_HOST,
        port: process.env.EMAIL_PORT,
        username: process.env.EMAIL_USER,
        from: process.env.EMAIL_FROM,
        hasPassword: !!process.env.EMAIL_PASSWORD
      }
    }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({
    message: 'Email test endpoint',
    usage: 'POST /api/test-email with { "testEmail": "your-email@example.com" }',
    environment: {
      host: process.env.EMAIL_HOST ? '✓ Set' : '✗ Missing',
      port: process.env.EMAIL_PORT ? '✓ Set' : '✗ Missing',
      username: process.env.EMAIL_USER ? '✓ Set' : '✗ Missing',
      password: process.env.EMAIL_PASSWORD ? '✓ Set' : '✗ Missing',
      from: process.env.EMAIL_FROM ? '✓ Set' : '✗ Missing',
    }
  });
}