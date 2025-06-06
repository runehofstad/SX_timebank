import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';
import { sendEmail, generateTimebankLowHoursEmail, generateTimebankDepletedEmail, generateTimebankExpiringEmail } from '@/lib/email/service';
import { Timebank, Client, EmailNotification } from '@/types';

export async function POST() {
  try {
    // Get system settings
    const settingsDoc = await adminDb.collection('system').doc('settings').get();
    const settings = settingsDoc.data() || {};
    
    // Check if email notifications are enabled
    if (!settings.emailNotifications) {
      return NextResponse.json({ 
        success: true, 
        message: 'Email notifications are disabled',
        notificationsSent: 0 
      });
    }
    
    const lowHoursThreshold = settings.lowHoursThreshold || 25;
    const criticalHoursThreshold = settings.criticalHoursThreshold || 10;
    const notificationEmails = settings.notificationEmails || [];
    
    // Check timebanks for low hours, depleted, or expiring soon
    const timebanksSnapshot = await adminDb.collection('timebanks').get();
    const timebanks = timebanksSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    } as Timebank));

    const clientsSnapshot = await adminDb.collection('clients').get();
    const clients = clientsSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    } as Client));

    const notifications: EmailNotification[] = [];

    for (const timebank of timebanks) {
      const client = clients.find(c => c.id === timebank.clientId);
      if (!client) continue;

      const percentageUsed = (timebank.usedHours / timebank.totalHours) * 100;
      const percentageRemaining = 100 - percentageUsed;
      const now = new Date();
      
      // Prepare recipient list (client email + additional notification emails)
      const recipients = [client.email, ...notificationEmails];
      
      // Check for depleted timebank
      if (timebank.remainingHours <= 0 && timebank.status !== 'depleted') {
        const emailOptions = generateTimebankDepletedEmail(timebank, client);
        emailOptions.to = recipients; // Send to all recipients
        await sendEmail(emailOptions);
        
        notifications.push({
          id: '', // Will be set by Firestore
          clientId: client.id,
          timebankId: timebank.id,
          type: 'depleted',
          sentAt: now,
          sentTo: recipients,
        });

        // Update timebank status
        await adminDb.collection('timebanks').doc(timebank.id).update({
          status: 'depleted',
          updatedAt: now,
        });
      }
      // Check for low hours (when remaining percentage falls below threshold)
      else if (percentageRemaining <= lowHoursThreshold && percentageRemaining > criticalHoursThreshold) {
        // Check if we've already sent a low hours notification in the last 7 days
        const recentNotificationSnapshot = await adminDb
          .collection('emailNotifications')
          .where('timebankId', '==', timebank.id)
          .where('type', '==', 'low_hours')
          .where('sentAt', '>', new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000))
          .get();

        if (recentNotificationSnapshot.empty) {
          const emailOptions = generateTimebankLowHoursEmail(timebank, client);
          emailOptions.to = recipients; // Send to all recipients
          await sendEmail(emailOptions);
          
          notifications.push({
            id: '',
            clientId: client.id,
            timebankId: timebank.id,
            type: 'low_hours',
            sentAt: now,
            sentTo: recipients,
          });
        }
      }
      // Check for critical hours (when remaining percentage falls below critical threshold)
      else if (percentageRemaining <= criticalHoursThreshold && percentageRemaining > 0) {
        // Check if we've already sent a critical hours notification in the last 3 days
        const recentNotificationSnapshot = await adminDb
          .collection('emailNotifications')
          .where('timebankId', '==', timebank.id)
          .where('type', '==', 'critical_hours')
          .where('sentAt', '>', new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000))
          .get();

        if (recentNotificationSnapshot.empty) {
          const emailOptions = generateTimebankLowHoursEmail(timebank, client);
          emailOptions.to = recipients; // Send to all recipients
          emailOptions.subject = `URGENT: Timebank Critical - ${timebank.name} has only ${percentageRemaining.toFixed(1)}% remaining`;
          await sendEmail(emailOptions);
          
          notifications.push({
            id: '',
            clientId: client.id,
            timebankId: timebank.id,
            type: 'critical_hours',
            sentAt: now,
            sentTo: recipients,
          });
        }
      }
      // Check for expiring timebank (within 30 days)
      else if (timebank.expiryDate) {
        const expiryDate = timebank.expiryDate instanceof Date 
          ? timebank.expiryDate 
          : new Date(timebank.expiryDate);
        const daysUntilExpiry = Math.ceil((expiryDate.getTime() - now.getTime()) / (24 * 60 * 60 * 1000));
        
        if (daysUntilExpiry <= 30 && daysUntilExpiry > 0) {
          // Check if we've already sent an expiring notification in the last 7 days
          const recentNotificationSnapshot = await adminDb
            .collection('emailNotifications')
            .where('timebankId', '==', timebank.id)
            .where('type', '==', 'expiring_soon')
            .where('sentAt', '>', new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000))
            .get();

          if (recentNotificationSnapshot.empty) {
            const emailOptions = generateTimebankExpiringEmail(timebank, client, daysUntilExpiry);
            emailOptions.to = recipients; // Send to all recipients
            await sendEmail(emailOptions);
            
            notifications.push({
              id: '',
              clientId: client.id,
              timebankId: timebank.id,
              type: 'expiring_soon',
              sentAt: now,
              sentTo: recipients,
            });
          }
        }
      }
    }

    // Save notification records
    for (const notification of notifications) {
      await adminDb.collection('emailNotifications').add(notification);
    }

    return NextResponse.json({ 
      success: true, 
      notificationsSent: notifications.length,
      notifications: notifications.map(n => ({ type: n.type, clientId: n.clientId }))
    });
  } catch (error) {
    console.error('Error sending notifications:', error);
    return NextResponse.json({ error: 'Failed to send notifications' }, { status: 500 });
  }
}