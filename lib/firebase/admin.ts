import { initializeApp, getApps, cert, ServiceAccount } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import { getMessaging } from 'firebase-admin/messaging';

const serviceAccount: ServiceAccount = {
  projectId: process.env.FIREBASE_ADMIN_PROJECT_ID!,
  clientEmail: process.env.FIREBASE_ADMIN_CLIENT_EMAIL!,
  privateKey: process.env.FIREBASE_ADMIN_PRIVATE_KEY!.replace(/\\n/g, '\n'),
};

if (!getApps().length) {
  initializeApp({
    credential: cert(serviceAccount),
  });
}

export const adminAuth = getAuth();
export const adminDb = getFirestore();
export const adminMessaging = getMessaging();