# Firebase Setup Guide for Timebank System

This guide will help you set up Firebase for your timebank system.

## Prerequisites
- A Google account
- Access to Firebase Console (https://console.firebase.google.com)

## Step 1: Create a Firebase Project

1. Go to [Firebase Console](https://console.firebase.google.com)
2. Click "Create a project" or "Add project"
3. Enter a project name (e.g., "timebank-system")
4. Follow the setup wizard (you can disable Google Analytics if not needed)

## Step 2: Enable Authentication

1. In Firebase Console, go to "Authentication" in the left sidebar
2. Click "Get started"
3. Go to "Sign-in method" tab
4. Enable "Email/Password" authentication
5. Click "Save"

## Step 3: Enable Firestore Database

1. Go to "Firestore Database" in the left sidebar
2. Click "Create database"
3. Choose "Start in production mode"
4. Select your preferred location (e.g., us-central1)
5. Click "Enable"

## Step 4: Get Your Configuration

1. Go to Project Settings (gear icon) > General
2. Scroll down to "Your apps"
3. Click "Web" icon (</>)
4. Register your app with a nickname (e.g., "Timebank Web App")
5. Copy the Firebase configuration object

## Step 5: Update Environment Variables

Replace the placeholder values in `.env.local` with your actual Firebase configuration:

```env
NEXT_PUBLIC_FIREBASE_API_KEY=your-actual-api-key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your-project-id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your-project.appspot.com
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your-sender-id
NEXT_PUBLIC_FIREBASE_APP_ID=your-app-id
```

## Step 6: Set Up Firebase Admin SDK

1. Go to Project Settings > Service accounts
2. Click "Generate new private key"
3. Save the JSON file securely
4. Update these values in `.env.local`:

```env
FIREBASE_ADMIN_PROJECT_ID=your-project-id
FIREBASE_ADMIN_CLIENT_EMAIL=firebase-adminsdk-xxxxx@your-project.iam.gserviceaccount.com
FIREBASE_ADMIN_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----"
```

## Step 7: Deploy Firestore Rules (Optional)

After logging in to Firebase CLI:

```bash
firebase login
firebase use --add
firebase deploy --only firestore:rules
firebase deploy --only firestore:indexes
```

## Step 8: Test Your Setup

1. Restart your Next.js development server:
   ```bash
   npm run dev
   ```

2. Visit http://localhost:3000
3. Try registering a new user account
4. If successful, you'll see the user in Firebase Console > Authentication

## Using Firebase Emulators (Optional)

For local development without using real Firebase services:

```bash
# Install emulators
firebase init emulators

# Start emulators
firebase emulators:start

# In another terminal, start Next.js with emulator config
NEXT_PUBLIC_USE_EMULATOR=true npm run dev
```

## Troubleshooting

### Common Issues:

1. **Invalid API Key Error**: Double-check your Firebase configuration in `.env.local`
2. **Permission Denied**: Check Firestore rules or ensure user is authenticated
3. **Network Error**: Ensure you're connected to internet and Firebase services are accessible

### Need Help?

- Check Firebase Console for error logs
- Review browser console for detailed error messages
- Ensure all environment variables are correctly set

## Security Notes

- Never commit `.env.local` to version control
- Keep your service account key secure
- Regularly review Firestore security rules
- Monitor usage in Firebase Console
