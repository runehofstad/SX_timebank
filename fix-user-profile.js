// Fix user profile in Firestore
// This script will create/update a user profile with admin role

const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');

// Read environment variables from .env.production
const envPath = path.join(__dirname, '.env.production');
const envContent = fs.readFileSync(envPath, 'utf8');
const envVars = {};

envContent.split('\n').forEach(line => {
  const [key, value] = line.split('=');
  if (key && value && !line.startsWith('#')) {
    envVars[key.trim()] = value.trim();
  }
});

// Initialize Firebase Admin
try {
  const serviceAccount = {
    type: "service_account",
    project_id: envVars.FIREBASE_ADMIN_PROJECT_ID,
    private_key_id: "fbsvc",
    private_key: envVars.FIREBASE_ADMIN_PRIVATE_KEY.replace(/\\n/g, '\n'),
    client_email: envVars.FIREBASE_ADMIN_CLIENT_EMAIL,
    client_id: "1",
    auth_uri: "https://accounts.google.com/o/oauth2/auth",
    token_uri: "https://oauth2.googleapis.com/token",
    auth_provider_x509_cert_url: "https://www.googleapis.com/oauth2/v1/certs",
    client_x509_cert_url: `https://www.googleapis.com/robot/v1/metadata/x509/${encodeURIComponent(envVars.FIREBASE_ADMIN_CLIENT_EMAIL)}`
  };

  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    projectId: envVars.FIREBASE_ADMIN_PROJECT_ID,
  });

  console.log('Firebase Admin initialized successfully');
} catch (error) {
  console.error('Failed to initialize Firebase Admin:', error);
  process.exit(1);
}

const auth = admin.auth();
const db = admin.firestore();

async function fixUserProfile(email) {
  try {
    // Get user by email
    const userRecord = await auth.getUserByEmail(email);
    console.log('Found user:', userRecord.uid, userRecord.email);

    // Check if profile exists
    const profileDoc = await db.collection('users').doc(userRecord.uid).get();
    
    if (profileDoc.exists) {
      // Update existing profile
      await db.collection('users').doc(userRecord.uid).update({
        email: userRecord.email,
        role: 'admin',
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
      console.log('Updated existing profile to admin role');
    } else {
      // Create new profile
      await db.collection('users').doc(userRecord.uid).set({
        email: userRecord.email,
        name: userRecord.displayName || email.split('@')[0],
        role: 'admin',
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
      console.log('Created new admin profile');
    }

    console.log('\n✅ User profile fixed successfully!');
    console.log('You can now log in at: https://timebank.studiox.tech');
    
  } catch (error) {
    console.error('Error:', error.message);
    if (error.code === 'auth/user-not-found') {
      console.log('\n❌ No user found with email:', email);
      console.log('Please make sure you have an account in Firebase Authentication.');
    }
  }
}

// Get email from command line
const email = process.argv[2];
if (!email) {
  console.log('Usage: node fix-user-profile.js <email>');
  console.log('Example: node fix-user-profile.js rune@studiox.no');
  process.exit(1);
}

fixUserProfile(email).then(() => process.exit(0));