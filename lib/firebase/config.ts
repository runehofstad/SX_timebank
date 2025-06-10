import { initializeApp, getApps, FirebaseApp } from 'firebase/app';
import { getAuth, Auth, connectAuthEmulator } from 'firebase/auth';
import { getFirestore, Firestore, connectFirestoreEmulator } from 'firebase/firestore';
import { getMessaging, Messaging, isSupported } from 'firebase/messaging';

// Use demo project if no real config is provided
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || 'demo-api-key',
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || 'demo-project.firebaseapp.com',
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || 'demo-project',
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || 'demo-project.appspot.com',
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || '123456789',
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID || '1:123456789:web:abcdef',
};

let app: FirebaseApp;
let auth: Auth;
let db: Firestore;
let messaging: Messaging | null = null;

try {
  app = !getApps().length ? initializeApp(firebaseConfig) : getApps()[0];
  auth = getAuth(app);
  db = getFirestore(app);
} catch (error) {
  console.error('Firebase initialization error:', error);
  // Initialize with demo project as fallback
  const demoConfig = {
    apiKey: 'demo-api-key',
    authDomain: 'demo-project.firebaseapp.com',
    projectId: 'demo-project',
    storageBucket: 'demo-project.appspot.com',
    messagingSenderId: '123456789',
    appId: '1:123456789:web:abcdef',
  };
  app = !getApps().length ? initializeApp(demoConfig) : getApps()[0];
  auth = getAuth(app);
  db = getFirestore(app);
}

// Connect to emulators if in development
if (typeof window !== 'undefined' && process.env.NODE_ENV === 'development' && process.env.NEXT_PUBLIC_USE_EMULATOR === 'true') {
  try {
    connectAuthEmulator(auth, 'http://localhost:9099', { disableWarnings: true });
    connectFirestoreEmulator(db, 'localhost', 8080);
  } catch {
    // Emulators might already be connected
    console.log('Emulators already connected or not available');
  }
}

// Initialize Firebase Cloud Messaging
export const getMessagingInstance = async (): Promise<Messaging | null> => {
  if (typeof window === 'undefined') {
    return null;
  }
  
  try {
    const isSupportedBrowser = await isSupported();
    if (isSupportedBrowser && !messaging) {
      messaging = getMessaging(app);
    }
    return messaging;
  } catch (error) {
    console.error('Error initializing messaging:', error);
    return null;
  }
};

export { app, auth, db };