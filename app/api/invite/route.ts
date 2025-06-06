import { NextRequest, NextResponse } from 'next/server';
import { sendEmail } from '@/lib/email/service';

export async function POST(request: NextRequest) {
  try {
    const { email, name, role, token, inviterName } = await request.json();
    
    console.log('Invite request received:', { email, name, role, inviterName });
    
    if (!process.env.NEXT_PUBLIC_APP_URL) {
      console.error('NEXT_PUBLIC_APP_URL is not defined');
      return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
    }
    
    const inviteUrl = `${process.env.NEXT_PUBLIC_APP_URL}/invite/${token}`;
    console.log('Invite URL:', inviteUrl);
    
    const emailContent = {
      to: [email],
      subject: 'Invitation to STUDIO X TIMEBANK',
      html: `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; background-color: #ffffff;">
          <div style="background-color: #FF3366; padding: 40px 20px; text-align: center;">
            <h1 style="color: #ffffff; margin: 0; font-size: 32px; font-weight: 700;">STUDIO X</h1>
            <p style="color: #ffffff; margin: 10px 0 0 0; font-size: 16px; opacity: 0.9;">TIMEBANK</p>
          </div>
          
          <div style="padding: 40px 30px;">
            <h2 style="color: #1a1a1a; font-size: 24px; margin-bottom: 20px;">You're Invited to Join Our Team!</h2>
            
            <p style="color: #4a4a4a; font-size: 16px; line-height: 1.6;">Hi ${name},</p>
            
            <p style="color: #4a4a4a; font-size: 16px; line-height: 1.6;">${inviterName} has invited you to join the STUDIO X TIMEBANK as a <strong style="color: #FF3366;">${role.replace('_', ' ')}</strong>.</p>
            
            <p style="color: #4a4a4a; font-size: 16px; line-height: 1.6;">Click the button below to accept your invitation and create your account:</p>
            
            <div style="text-align: center; margin: 40px 0;">
              <a href="${inviteUrl}" style="background-color: #FF3366; color: white; padding: 16px 32px; text-decoration: none; border-radius: 8px; display: inline-block; font-size: 16px; font-weight: 600; box-shadow: 0 2px 4px rgba(255, 51, 102, 0.3);">
                Accept Invitation
              </a>
            </div>
            
            <p style="color: #4a4a4a; font-size: 14px; line-height: 1.6;">Or copy and paste this link into your browser:</p>
            <p style="color: #FF3366; font-size: 14px; word-break: break-all; background-color: #f5f5f5; padding: 12px; border-radius: 6px;">${inviteUrl}</p>
            
            <p style="color: #6b7280; font-size: 14px; margin-top: 30px;">This invitation will expire in 7 days.</p>
          </div>
          
          <div style="background-color: #f9f9f9; padding: 30px; text-align: center; border-top: 1px solid #e5e7eb;">
            <p style="color: #6b7280; font-size: 13px; margin: 0;">
              If you didn't expect this invitation, you can safely ignore this email.
            </p>
            <p style="color: #9ca3af; font-size: 12px; margin: 10px 0 0 0;">
              © ${new Date().getFullYear()} STUDIO X. All rights reserved.
            </p>
          </div>
        </div>
      `,
      text: `
        STUDIO X - TIMEBANK Invitation
        
        Hi ${name},
        
        ${inviterName} has invited you to join the STUDIO X TIMEBANK as a ${role.replace('_', ' ')}.
        
        Click this link to accept your invitation and create your account:
        ${inviteUrl}
        
        This invitation will expire in 7 days.
        
        If you didn't expect this invitation, you can safely ignore this email.
        
        © ${new Date().getFullYear()} STUDIO X. All rights reserved.
      `,
    };
    
    console.log('Attempting to send email to:', email);
    await sendEmail(emailContent);
    console.log('Email sent successfully');
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error sending invitation email:', error);
    console.error('Error details:', error instanceof Error ? error.message : 'Unknown error');
    console.error('Stack trace:', error instanceof Error ? error.stack : 'No stack trace');
    return NextResponse.json({ 
      error: 'Failed to send invitation',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}