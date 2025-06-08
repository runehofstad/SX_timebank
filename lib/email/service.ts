import { Timebank, Client } from '@/types';

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
    
    // Use eval to require nodemailer to avoid Next.js bundling issues
    const nodemailer = eval('require')('nodemailer');
    
    const port = parseInt(process.env.EMAIL_PORT || '587');
    const isSecurePort = port === 465;
    
    // Try to create transporter with current username format
    let transporter;
    let authError = null;
    
    const createTransporter = (username: string) => {
      console.log(`Creating transporter with username: ${username}`);
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
        logger: true, // Enable logging
        debug: true, // Enable debug output
      });
    };
    
    // First try with the configured username
    transporter = createTransporter(process.env.EMAIL_USER!);

    // Verify transporter configuration
    try {
      console.log('Verifying email configuration...');
      await transporter.verify();
      console.log('Email configuration verified successfully');
    } catch (verifyError: any) {
      console.error('Email configuration verification failed:', verifyError);
      authError = verifyError;
      
      // If authentication failed and we used short username, try with full email
      if (verifyError.message?.includes('auth') && process.env.EMAIL_USER && !process.env.EMAIL_USER.includes('@')) {
        console.log('Authentication failed with short username, trying with full email format...');
        const fullEmail = process.env.EMAIL_FROM || `${process.env.EMAIL_USER}@studiox.tech`;
        transporter = createTransporter(fullEmail);
        
        try {
          await transporter.verify();
          console.log('Email configuration verified successfully with full email username');
          authError = null; // Clear the error since it worked
        } catch (secondError) {
          console.error('Email configuration verification failed with full email too:', secondError);
          authError = secondError;
        }
      }
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
  } catch (error: any) {
    console.error('Error sending email:', error);
    console.error('Error type:', error.code);
    console.error('Error response:', error.response);
    console.error('Error command:', error.command);
    
    // Provide more specific error message
    let errorMessage = 'Failed to send email: ';
    if (error.code === 'EAUTH') {
      errorMessage += 'Authentication failed. Check username/password.';
    } else if (error.code === 'ECONNECTION') {
      errorMessage += 'Connection failed. Check host/port settings.';
    } else if (error.code === 'ETIMEDOUT') {
      errorMessage += 'Connection timeout. Server may be unreachable.';
    } else {
      errorMessage += error.message || 'Unknown error';
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