// Firebase Cloud Messaging Service Worker
importScripts('https://www.gstatic.com/firebasejs/10.7.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.7.0/firebase-messaging-compat.js');

// Your Firebase config
firebase.initializeApp({
  apiKey: "AIzaSyC4tKJ-vLfAQ3xiG_qJ8L1EfQISsY6OKzo",
  authDomain: "timebank-a9da5.firebaseapp.com",
  projectId: "timebank-a9da5",
  storageBucket: "timebank-a9da5.firebasestorage.app",
  messagingSenderId: "876764217431",
  appId: "1:876764217431:web:fc387fb8f97e17c1f96e9f",
  measurementId: "G-VT1Q43H04B"
});

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