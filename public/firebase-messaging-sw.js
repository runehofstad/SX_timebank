// Firebase Cloud Messaging Service Worker
importScripts('https://www.gstatic.com/firebasejs/10.7.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.7.0/firebase-messaging-compat.js');

// The Firebase config is fetched from the app at runtime
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'FIREBASE_CONFIG') {
    // Initialize Firebase with the config sent from the app
    firebase.initializeApp(event.data.config);
    
    const messaging = firebase.messaging();
    
    // Handle background messages
    messaging.onBackgroundMessage((payload) => {
      console.log('[firebase-messaging-sw.js] Received background message ', payload);
      
      // Customize notification here
      const notificationTitle = payload.notification.title || 'Timebank Alert';
      const notificationOptions = {
        body: payload.notification.body || 'You have a new timebank notification',
        icon: '/icon-192.png',
        badge: '/icon-192.png',
        vibrate: [200, 100, 200],
        tag: payload.data?.timebankId || 'timebank-notification',
        data: payload.data,
        actions: [
          {
            action: 'view',
            title: 'View Details'
          },
          {
            action: 'close',
            title: 'Dismiss'
          }
        ]
      };

      self.registration.showNotification(notificationTitle, notificationOptions);
    });
  }
});

// Handle notification click
self.addEventListener('notificationclick', (event) => {
  console.log('[Service Worker] Notification click Received.');
  event.notification.close();

  if (event.action === 'view' || !event.action) {
    // Open the app when notification is clicked
    event.waitUntil(
      clients.openWindow(event.notification.data?.url || '/')
    );
  }
});