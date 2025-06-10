import { NextResponse } from 'next/server';
import { adminDb, adminMessaging } from '@/lib/firebase/admin';
import { sendEmail, generateTimebankLowHoursEmail, generateTimebankDepletedEmail, generateTimebankExpiringEmail } from '@/lib/email/service';
import { Timebank, Client, EmailNotification, User, Project } from '@/types';
import { formatTimebankNotification } from '@/lib/notifications/push-service';

// Helper function to send push notifications
async function sendPushNotifications(
  timebank: Timebank,
  client: Client,
  type: 'low_hours' | 'critical_hours' | 'depleted' | 'expiring_soon',
  users: User[],
  projects: Project[]
) {
  try {
    // Find projects for this client
    const clientProjects = projects.filter(p => p.clientId === client.id);
    
    // Get users who should receive notifications
    const notificationRecipients: User[] = [];
    
    // Add admins - they get all notifications
    const admins = users.filter(u => u.role === 'admin' && u.pushNotificationsEnabled && u.fcmTokens?.length);
    notificationRecipients.push(...admins);
    
    // Add users assigned to projects for this client
    const projectUserIds = new Set<string>();
    clientProjects.forEach(project => {
      project.teamMembers?.forEach(userId => projectUserIds.add(userId));
    });
    
    const projectUsers = users.filter(u => 
      projectUserIds.has(u.id) && 
      u.pushNotificationsEnabled && 
      u.fcmTokens?.length
    );
    notificationRecipients.push(...projectUsers);
    
    // Remove duplicates
    const uniqueRecipients = Array.from(new Map(notificationRecipients.map(u => [u.id, u])).values());
    
    // Collect all FCM tokens
    const allTokens: string[] = [];
    uniqueRecipients.forEach(user => {
      if (user.fcmTokens) {
        allTokens.push(...user.fcmTokens);
      }
    });
    
    if (allTokens.length === 0) {
      console.log('No FCM tokens found for push notifications');
      return;
    }
    
    // Format notification based on user role
    const messages = uniqueRecipients.flatMap(user => {
      const isAdmin = user.role === 'admin';
      const projectName = !isAdmin && clientProjects.length > 0 ? clientProjects[0].name : undefined;
      
      const { title, body } = formatTimebankNotification(
        timebank.name,
        client.name,
        timebank.remainingHours,
        timebank.totalHours,
        isAdmin,
        projectName
      );
      
      return user.fcmTokens?.map(token => ({
        token,
        notification: { title, body },
        data: {
          timebankId: timebank.id,
          clientId: client.id,
          type,
          url: isAdmin ? `/timebanks` : `/projects/${clientProjects[0]?.id || ''}`,
          remainingHours: timebank.remainingHours.toString(),
          totalHours: timebank.totalHours.toString()
        },
        webpush: {
          fcmOptions: {
            link: isAdmin ? `/timebanks` : `/projects/${clientProjects[0]?.id || ''}`
          }
        }
      })) || [];
    });
    
    // Send notifications in batches (FCM limit is 500 per request)
    const batchSize = 500;
    for (let i = 0; i < messages.length; i += batchSize) {
      const batch = messages.slice(i, i + batchSize);
      const response = await adminMessaging.sendEach(batch);
      console.log(`Sent ${response.successCount} push notifications, ${response.failureCount} failed`);
      
      // Log failed tokens for cleanup
      response.responses.forEach((resp, idx) => {
        if (!resp.success && resp.error) {
          console.error(`Failed to send to token ${batch[idx].token}:`, resp.error);
        }
      });
    }
  } catch (error) {
    console.error('Error sending push notifications:', error);
  }
}

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
    
    // Get all users for push notifications
    const usersSnapshot = await adminDb.collection('users').get();
    const users = usersSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    } as User));
    
    // Get all projects for user access control
    const projectsSnapshot = await adminDb.collection('projects').get();
    const projects = projectsSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    } as Project));

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
        
        // Send push notifications
        await sendPushNotifications(timebank, client, 'depleted', users, projects);
        
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
          
          // Send push notifications
          await sendPushNotifications(timebank, client, 'low_hours', users, projects);
          
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
          
          // Send push notifications
          await sendPushNotifications(timebank, client, 'critical_hours', users, projects);
          
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
            
            // Send push notifications
            await sendPushNotifications(timebank, client, 'expiring_soon', users, projects);
            
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