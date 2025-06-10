import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { requestNotificationPermission, saveFCMToken, removeFCMToken, setupMessageListener } from '@/lib/notifications/push-service';
import { useRouter } from 'next/navigation';

export function useFCMToken() {
  const { user, userProfile } = useAuth();
  const router = useRouter();
  const [permission, setPermission] = useState<NotificationPermission>('default');
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Check current permission status
    if ('Notification' in window) {
      setPermission(Notification.permission);
    }
  }, []);

  useEffect(() => {
    // Setup message listener for foreground notifications
    if (token && user) {
      setupMessageListener((payload) => {
        // Show in-app notification or custom UI
        console.log('Received foreground message:', payload);
        
        // Create browser notification for foreground messages
        if (Notification.permission === 'granted') {
          const notification = new Notification(payload.notification?.title || 'Timebank Alert', {
            body: payload.notification?.body || 'You have a new notification',
            icon: '/icon-192.png',
            badge: '/icon-192.png',
            data: payload.data
          });

          notification.onclick = () => {
            if (payload.data?.url) {
              router.push(payload.data.url);
            }
            notification.close();
          };
        }
      });
    }
  }, [token, user, router]);

  const requestPermission = async () => {
    if (!user || !userProfile) {
      setError('You must be logged in to enable notifications');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const fcmToken = await requestNotificationPermission();
      
      if (fcmToken) {
        await saveFCMToken(user.uid, fcmToken);
        setToken(fcmToken);
        setPermission('granted');
      } else {
        setPermission(Notification.permission);
        if (Notification.permission === 'denied') {
          setError('Notification permission was denied. Please enable it in your browser settings.');
        }
      }
    } catch (err) {
      console.error('Error requesting permission:', err);
      setError('Failed to enable push notifications');
    } finally {
      setLoading(false);
    }
  };

  const removeToken = async () => {
    if (!user || !token) return;

    setLoading(true);
    try {
      await removeFCMToken(user.uid, token);
      setToken(null);
    } catch (err) {
      console.error('Error removing token:', err);
      setError('Failed to disable push notifications');
    } finally {
      setLoading(false);
    }
  };

  return {
    permission,
    token,
    loading,
    error,
    requestPermission,
    removeToken,
    isSupported: 'Notification' in window && 'serviceWorker' in navigator
  };
}