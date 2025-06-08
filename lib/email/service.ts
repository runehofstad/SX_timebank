import { Timebank, Client } from '@/types';
import nodemailer from 'nodemailer';

export interface EmailOptions {
  to: string[];
  subject: string;
  html: string;
  text?: string;
}

export async function sendEmail(options: EmailOptions): Promise<void> {
  try {
    // Check for required environment variables
    const requiredEnvVars = ['EMAIL_HOST', 'EMAIL_PORT', 'EMAIL_USER', 'EMAIL_PASSWORD', 'EMAIL_FROM'];
    const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);
    
    if (missingVars.length > 0) {
      throw new Error(`Missing required environment variables: ${missingVars.join(', ')}`);
    }
    
    console.log('Email configuration:', {
      host: process.env.EMAIL_HOST,
      port: process.env.EMAIL_PORT,
      user: process.env.EMAIL_USER,
      from: process.env.EMAIL_FROM,
      to: options.to.join(', ')
    });
    
    // Log email attempt in all environments
    console.log('=== Email Send Attempt ===');
    console.log('Environment:', process.env.NODE_ENV);
    console.log('To:', options.to.join(', '));
    console.log('Subject:', options.subject);
    console.log('From:', process.env.EMAIL_FROM);
    console.log('========================');
    
    const port = parseInt(process.env.EMAIL_PORT || '587');
    const isSecurePort = port === 465;
    
    // Try to create transporter with current username format
    let transporter;
    
    const createTransporter = (username: string) => {
      console.log(`Creating transporter with username: ${username}`);
      console.log(`Using password: ${process.env.EMAIL_PASSWORD ? '***' + process.env.EMAIL_PASSWORD.slice(-4) : 'NOT SET'}`);
      
      // Special handling for SendGrid
      if (process.env.EMAIL_HOST === 'smtp.sendgrid.net') {
        console.log('Using SendGrid configuration');
        return nodemailer.createTransport({
          host: process.env.EMAIL_HOST,
          port: port,
          secure: false, // SendGrid uses STARTTLS
          auth: {
            user: 'apikey', // SendGrid requires literal string 'apikey' as username
            pass: process.env.EMAIL_PASSWORD, // This should be your SendGrid API key
          },
        });
      }
      
      // Default configuration for other providers
      return nodemailer.createTransport({
        host: process.env.EMAIL_HOST,
        port: port,
        secure: isSecurePort, // true for 465, false for other ports
        auth: {
          user: username,
          pass: process.env.EMAIL_PASSWORD,
        },
        tls: {
          // Do not fail on invalid certs
          rejectUnauthorized: false,
          // Force TLS version 1.2
          minVersion: 'TLSv1.2',
        },
        // Additional options for better compatibility
        requireTLS: !isSecurePort, // Require STARTTLS for non-secure ports
        connectionTimeout: 30000, // 30 seconds
        greetingTimeout: 30000, // 30 seconds
        socketTimeout: 30000, // 30 seconds
        logger: false, // Disable verbose logging in production
        debug: false, // Disable debug output in production
      });
    };
    
    // First try with the configured username
    transporter = createTransporter(process.env.EMAIL_USER!);

    // Skip verification for SendGrid (it doesn't support the verify method)
    if (process.env.EMAIL_HOST !== 'smtp.sendgrid.net') {
      // Verify transporter configuration for other providers
      try {
        console.log('Verifying email configuration...');
        await transporter.verify();
        console.log('Email configuration verified successfully');
      } catch (verifyError) {
        console.error('Email configuration verification failed:', verifyError);
        
        // If authentication failed and we used short username, try with full email
        const errorMessage = verifyError instanceof Error ? verifyError.message : String(verifyError);
        if (errorMessage.includes('auth') || errorMessage.includes('535')) {
          console.log('Authentication failed, trying alternative username formats...');
          
          // Try different username formats
          const usernamesToTry = [
            process.env.EMAIL_FROM, // timebank@studiox.tech
            `${process.env.EMAIL_USER}@studiox.tech`, // studioxtech10@studiox.tech
            `${process.env.EMAIL_USER}@domeneshop.no`, // studioxtech10@domeneshop.no
          ];
          
          for (const altUsername of usernamesToTry) {
            if (altUsername && altUsername !== process.env.EMAIL_USER) {
              console.log(`Trying username: ${altUsername}`);
              transporter = createTransporter(altUsername);
              
              try {
                await transporter.verify();
                console.log(`Email configuration verified successfully with username: ${altUsername}`);
                break; // Success, stop trying
              } catch (altError) {
                console.error(`Failed with ${altUsername}:`, altError instanceof Error ? altError.message : altError);
              }
            }
          }
        }
      }
    } else {
      console.log('Using SendGrid - skipping verification');
    }
    
    console.log('Sending email...');
    const result = await transporter.sendMail({
      from: process.env.EMAIL_FROM,
      to: options.to.join(', '),
      subject: options.subject,
      html: options.html,
      text: options.text,
      // Add message headers for better deliverability
      headers: {
        'X-Priority': '3',
        'X-Mailer': 'STUDIO X Timebank System',
      },
    });
    
    console.log('Email sent successfully:', {
      messageId: result.messageId,
      accepted: result.accepted,
      rejected: result.rejected,
      response: result.response
    });
  } catch (error) {
    console.error('Error sending email:', error);
    
    // Type-safe error handling
    const err = error as any; // eslint-disable-line @typescript-eslint/no-explicit-any
    console.error('Error type:', err.code);
    console.error('Error response:', err.response);
    console.error('Error command:', err.command);
    
    // Provide more specific error message
    let errorMessage = 'Failed to send email: ';
    if (err.code === 'EAUTH') {
      errorMessage += 'Authentication failed. Check username/password.';
    } else if (err.code === 'ECONNECTION') {
      errorMessage += 'Connection failed. Check host/port settings.';
    } else if (err.code === 'ETIMEDOUT') {
      errorMessage += 'Connection timeout. Server may be unreachable.';
    } else {
      errorMessage += err.message || 'Unknown error';
    }
    
    throw new Error(errorMessage);
  }
}

export function generateTimebankLowHoursEmail(timebank: Timebank, client: Client): EmailOptions {
  const percentageUsed = (timebank.usedHours / timebank.totalHours) * 100;
  
  return {
    to: [client.email],
    subject: `Timebank Alert: ${timebank.name} is running low`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #f59e0b;">Timebank Alert: Low Hours</h2>
        
        <p>Dear ${client.name},</p>
        
        <p>This is an automated notification to inform you that your timebank "${timebank.name}" is running low on available hours.</p>
        
        <div style="background-color: #fef3c7; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <h3 style="margin-top: 0; color: #92400e;">Timebank Status</h3>
          <ul style="margin: 0; padding-left: 20px;">
            <li><strong>Timebank:</strong> ${timebank.name}</li>
            <li><strong>Total Hours:</strong> ${timebank.totalHours}</li>
            <li><strong>Hours Used:</strong> ${timebank.usedHours} (${percentageUsed.toFixed(1)}%)</li>
            <li><strong>Hours Remaining:</strong> ${timebank.remainingHours}</li>
          </ul>
        </div>
        
        <p>We recommend purchasing additional hours to avoid any interruption to your project work.</p>
        
        <p>If you have any questions or would like to purchase additional hours, please contact us.</p>
        
        <p>Best regards,<br>Your Project Team</p>
      </div>
    `,
    text: `
      Timebank Alert: Low Hours
      
      Dear ${client.name},
      
      This is an automated notification to inform you that your timebank "${timebank.name}" is running low on available hours.
      
      Timebank Status:
      - Timebank: ${timebank.name}
      - Total Hours: ${timebank.totalHours}
      - Hours Used: ${timebank.usedHours} (${percentageUsed.toFixed(1)}%)
      - Hours Remaining: ${timebank.remainingHours}
      
      We recommend purchasing additional hours to avoid any interruption to your project work.
      
      If you have any questions or would like to purchase additional hours, please contact us.
      
      Best regards,
      Your Project Team
    `,
  };
}

export function generateTimebankDepletedEmail(timebank: Timebank, client: Client): EmailOptions {
  return {
    to: [client.email],
    subject: `Timebank Depleted: ${timebank.name} has no remaining hours`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #dc2626;">Timebank Depleted</h2>
        
        <p>Dear ${client.name},</p>
        
        <p>This is an automated notification to inform you that your timebank "${timebank.name}" has been depleted and has no remaining hours.</p>
        
        <div style="background-color: #fee2e2; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <h3 style="margin-top: 0; color: #991b1b;">Timebank Status</h3>
          <ul style="margin: 0; padding-left: 20px;">
            <li><strong>Timebank:</strong> ${timebank.name}</li>
            <li><strong>Total Hours:</strong> ${timebank.totalHours}</li>
            <li><strong>Hours Used:</strong> ${timebank.usedHours}</li>
            <li><strong>Hours Remaining:</strong> 0</li>
          </ul>
        </div>
        
        <p><strong>Important:</strong> No additional work can be performed on your projects until you purchase more hours.</p>
        
        <p>Please contact us immediately to purchase additional hours and resume your project work.</p>
        
        <p>Best regards,<br>Your Project Team</p>
      </div>
    `,
    text: `
      Timebank Depleted
      
      Dear ${client.name},
      
      This is an automated notification to inform you that your timebank "${timebank.name}" has been depleted and has no remaining hours.
      
      Timebank Status:
      - Timebank: ${timebank.name}
      - Total Hours: ${timebank.totalHours}
      - Hours Used: ${timebank.usedHours}
      - Hours Remaining: 0
      
      Important: No additional work can be performed on your projects until you purchase more hours.
      
      Please contact us immediately to purchase additional hours and resume your project work.
      
      Best regards,
      Your Project Team
    `,
  };
}

export function generateTimebankExpiringEmail(timebank: Timebank, client: Client, daysUntilExpiry: number): EmailOptions {
  return {
    to: [client.email],
    subject: `Timebank Expiring Soon: ${timebank.name} expires in ${daysUntilExpiry} days`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #f59e0b;">Timebank Expiring Soon</h2>
        
        <p>Dear ${client.name},</p>
        
        <p>This is an automated notification to inform you that your timebank "${timebank.name}" will expire in ${daysUntilExpiry} days.</p>
        
        <div style="background-color: #fef3c7; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <h3 style="margin-top: 0; color: #92400e;">Timebank Details</h3>
          <ul style="margin: 0; padding-left: 20px;">
            <li><strong>Timebank:</strong> ${timebank.name}</li>
            <li><strong>Hours Remaining:</strong> ${timebank.remainingHours}</li>
            <li><strong>Expiry Date:</strong> ${timebank.expiryDate ? new Date(timebank.expiryDate).toLocaleDateString() : 'Not set'}</li>
            <li><strong>Days Until Expiry:</strong> ${daysUntilExpiry}</li>
          </ul>
        </div>
        
        <p>Please ensure you use your remaining hours before the expiry date, as unused hours will be forfeited.</p>
        
        <p>If you need to extend the timebank or have any questions, please contact us.</p>
        
        <p>Best regards,<br>Your Project Team</p>
      </div>
    `,
    text: `
      Timebank Expiring Soon
      
      Dear ${client.name},
      
      This is an automated notification to inform you that your timebank "${timebank.name}" will expire in ${daysUntilExpiry} days.
      
      Timebank Details:
      - Timebank: ${timebank.name}
      - Hours Remaining: ${timebank.remainingHours}
      - Expiry Date: ${timebank.expiryDate ? new Date(timebank.expiryDate).toLocaleDateString() : 'Not set'}
      - Days Until Expiry: ${daysUntilExpiry}
      
      Please ensure you use your remaining hours before the expiry date, as unused hours will be forfeited.
      
      If you need to extend the timebank or have any questions, please contact us.
      
      Best regards,
      Your Project Team
    `,
  };
}