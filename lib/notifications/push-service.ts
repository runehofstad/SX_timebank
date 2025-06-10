import { getToken, onMessage } from 'firebase/messaging';
import { doc, setDoc, deleteDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { db, getMessagingInstance } from '@/lib/firebase/config';
import { User } from '@/types';

// VAPID key for web push notifications (you'll need to generate this in Firebase Console)
const VAPID_KEY = process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY || 'BKagOny0KF_2pCJQ3m7VogKwJvjcrJLaQJz4KovfUnEd-v7St1XBs0VEa9iqpLsm3F7ImFyNJF5JNGZ6rJ7t0Pg';

export async function requestNotificationPermission(): Promise<string | null> {
  try {
    const permission = await Notification.requestPermission();
    
    if (permission === 'granted') {
      const messaging = await getMessagingInstance();
      if (!messaging) {
        console.error('Messaging not supported');
        return null;
      }

      // Register service worker
      if ('serviceWorker' in navigator) {
        const registration = await navigator.serviceWorker.register('/firebase-messaging-sw.js');
        console.log('Service Worker registered:', registration);
      }

      // Get FCM token
      const token = await getToken(messaging, { vapidKey: VAPID_KEY });
      console.log('FCM Token:', token);
      return token;
    } else {
      console.log('Notification permission denied');
      return null;
    }
  } catch (error) {
    console.error('Error requesting notification permission:', error);
    return null;
  }
}

export async function saveFCMToken(userId: string, token: string): Promise<void> {
  try {
    // Save token to user's fcmTokens array
    const userRef = doc(db, 'users', userId);
    const user = await getDocs(query(collection(db, 'users'), where('id', '==', userId)));
    
    if (!user.empty) {
      const userData = user.docs[0].data() as User;
      const existingTokens = userData.fcmTokens || [];
      
      if (!existingTokens.includes(token)) {
        await setDoc(userRef, {
          fcmTokens: [...existingTokens, token],
          pushNotificationsEnabled: true,
          updatedAt: new Date()
        }, { merge: true });
      }
    }

    // Also save to pushSubscriptions collection for easier querying
    const subscriptionRef = doc(collection(db, 'pushSubscriptions'));
    await setDoc(subscriptionRef, {
      userId,
      fcmToken: token,
      device: navigator.userAgent,
      createdAt: new Date(),
      lastUsed: new Date()
    });
  } catch (error) {
    console.error('Error saving FCM token:', error);
    throw error;
  }
}

export async function removeFCMToken(userId: string, token: string): Promise<void> {
  try {
    // Remove from user's fcmTokens array
    const userRef = doc(db, 'users', userId);
    const user = await getDocs(query(collection(db, 'users'), where('id', '==', userId)));
    
    if (!user.empty) {
      const userData = user.docs[0].data() as User;
      const updatedTokens = (userData.fcmTokens || []).filter(t => t !== token);
      
      await setDoc(userRef, {
        fcmTokens: updatedTokens,
        pushNotificationsEnabled: updatedTokens.length > 0,
        updatedAt: new Date()
      }, { merge: true });
    }

    // Remove from pushSubscriptions collection
    const subscriptions = await getDocs(
      query(collection(db, 'pushSubscriptions'), 
        where('userId', '==', userId),
        where('fcmToken', '==', token)
      )
    );
    
    subscriptions.forEach(async (doc) => {
      await deleteDoc(doc.ref);
    });
  } catch (error) {
    console.error('Error removing FCM token:', error);
    throw error;
  }
}

export async function setupMessageListener(onMessageCallback: (payload: { notification?: { title?: string; body?: string }; data?: Record<string, string> }) => void): Promise<void> {
  const messaging = await getMessagingInstance();
  if (!messaging) return;

  onMessage(messaging, (payload) => {
    console.log('Message received:', payload);
    onMessageCallback(payload);
  });
}

// Format notification based on timebank status
export function formatTimebankNotification(
  timebankName: string,
  clientName: string,
  remainingHours: number,
  totalHours: number,
  isAdmin: boolean,
  projectName?: string
): { title: string; body: string } {
  const percentageRemaining = (remainingHours / totalHours) * 100;
  let emoji = '';
  let urgency = '';

  if (percentageRemaining <= 0) {
    emoji = '❌';
    urgency = 'Depleted';
  } else if (percentageRemaining <= 10) {
    emoji = '🚨';
    urgency = 'Critical';
  } else if (percentageRemaining <= 25) {
    emoji = '⚠️';
    urgency = 'Low Balance';
  } else if (percentageRemaining <= 50) {
    emoji = '';
    urgency = 'Timebank Alert';
  }

  const title = isAdmin 
    ? `${emoji} ${urgency} - ${clientName}`.trim()
    : `${emoji} ${urgency} - ${projectName || timebankName}`.trim();

  const body = isAdmin
    ? `${projectName ? `${projectName} - ` : ''}Saldo: ${remainingHours.toFixed(1)} hours remaining`
    : `${percentageRemaining <= 50 ? `${Math.round(100 - percentageRemaining)}% used. ` : ''}Saldo: ${remainingHours.toFixed(1)} hours remaining`;

  return { title, body };
}