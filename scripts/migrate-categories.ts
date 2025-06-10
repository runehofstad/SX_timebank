import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, updateDoc, doc, writeBatch } from 'firebase/firestore';

// Firebase configuration
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// Category mapping from old to new
const categoryMapping: Record<string, string> = {
  'backend_development': 'backend',
  'frontend_development': 'frontend',
  'ios_development': 'ios_native',
  'android_development': 'android_native',
  'flutter_development': 'flutter',
  'react_native_development': 'react_native',
  'testing': 'qa',
  // These remain the same
  'project_management': 'project_management',
  'ui_ux_design': 'ui_ux_design',
  'meeting': 'meeting',
  'video_production': 'video_production',
  'other': 'other'
};

async function migrateCategories() {
  console.log('Starting category migration...');
  
  try {
    // Get all time entries
    const timeEntriesSnapshot = await getDocs(collection(db, 'timeEntries'));
    
    let totalEntries = 0;
    let updatedEntries = 0;
    const batch = writeBatch(db);
    let batchCount = 0;
    
    for (const docSnapshot of timeEntriesSnapshot.docs) {
      totalEntries++;
      const data = docSnapshot.data();
      const oldCategory = data.category;
      
      // Check if category needs migration
      if (oldCategory && categoryMapping[oldCategory] && categoryMapping[oldCategory] !== oldCategory) {
        const newCategory = categoryMapping[oldCategory];
        
        // Add to batch
        batch.update(doc(db, 'timeEntries', docSnapshot.id), {
          category: newCategory,
          updatedAt: new Date()
        });
        
        updatedEntries++;
        batchCount++;
        
        console.log(`Migrating entry ${docSnapshot.id}: ${oldCategory} -> ${newCategory}`);
        
        // Commit batch every 500 updates (Firestore limit)
        if (batchCount >= 500) {
          await batch.commit();
          console.log(`Committed batch of ${batchCount} updates`);
          batchCount = 0;
        }
      }
    }
    
    // Commit remaining updates
    if (batchCount > 0) {
      await batch.commit();
      console.log(`Committed final batch of ${batchCount} updates`);
    }
    
    console.log('\nMigration completed successfully!');
    console.log(`Total entries: ${totalEntries}`);
    console.log(`Updated entries: ${updatedEntries}`);
    
  } catch (error) {
    console.error('Error during migration:', error);
    process.exit(1);
  }
  
  process.exit(0);
}

// Run migration
migrateCategories();