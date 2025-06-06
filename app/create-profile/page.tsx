'use client';

import { useState, useEffect } from 'react';
import { doc, setDoc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase/config';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';

export default function CreateProfilePage() {
  const { currentUser } = useAuth();
  const router = useRouter();
  const [creating, setCreating] = useState(false);
  const [profileExists, setProfileExists] = useState<boolean | null>(null);
  const [name, setName] = useState('');

  useEffect(() => {
    checkProfile();
  }, [currentUser]);

  const checkProfile = async () => {
    if (!currentUser) return;
    
    try {
      const userDoc = await getDoc(doc(db, 'users', currentUser.uid));
      setProfileExists(userDoc.exists());
      
      if (userDoc.exists()) {
        const data = userDoc.data();
        console.log('Existing profile:', data);
      }
    } catch (error) {
      console.error('Error checking profile:', error);
    }
  };

  const handleCreateProfile = async () => {
    if (!currentUser || !name.trim()) return;
    
    setCreating(true);
    try {
      const userProfile = {
        id: currentUser.uid,
        email: currentUser.email!,
        name: name.trim(),
        role: 'admin', // Creating as admin for testing
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      
      console.log('Creating profile with data:', userProfile);
      
      await setDoc(doc(db, 'users', currentUser.uid), userProfile);
      
      // Verify creation
      const createdDoc = await getDoc(doc(db, 'users', currentUser.uid));
      if (createdDoc.exists()) {
        alert('Profile created successfully! Redirecting to dashboard...');
        setTimeout(() => {
          window.location.href = '/dashboard';
        }, 1000);
      } else {
        throw new Error('Profile creation failed');
      }
    } catch (error: any) {
      console.error('Error creating profile:', error);
      alert(`Failed to create profile: ${error.message}`);
    } finally {
      setCreating(false);
    }
  };

  if (!currentUser) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <h2 className="text-xl font-semibold text-gray-900">Not logged in</h2>
          <a href="/login" className="mt-4 text-blue-600 hover:text-blue-500">
            Go to login
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div className="text-center">
          <h2 className="mt-6 text-3xl font-extrabold text-gray-900">
            Create User Profile
          </h2>
          <p className="mt-2 text-sm text-gray-600">
            Your account exists but is missing a user profile
          </p>
        </div>
        
        <div className="bg-white shadow rounded-lg p-6">
          <div className="space-y-4">
            <div className="bg-blue-50 p-4 rounded">
              <p className="text-sm">
                <strong>Email:</strong> {currentUser.email}
              </p>
              <p className="text-sm">
                <strong>UID:</strong> {currentUser.uid}
              </p>
              <p className="text-sm">
                <strong>Profile Exists:</strong> {profileExists === null ? 'Checking...' : profileExists ? 'Yes' : 'No'}
              </p>
            </div>
            
            {profileExists === false && (
              <>
                <div>
                  <label htmlFor="name" className="block text-sm font-medium text-gray-700">
                    Your Name
                  </label>
                  <input
                    type="text"
                    id="name"
                    className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm text-gray-900 focus:outline-none focus:ring-studio-x focus:border-studio-x sm:text-sm"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Enter your full name"
                  />
                </div>
                
                <button
                  onClick={handleCreateProfile}
                  disabled={creating || !name.trim()}
                  className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-studio-x hover:bg-studio-x-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-studio-x disabled:opacity-50"
                >
                  {creating ? 'Creating Profile...' : 'Create Profile as Admin'}
                </button>
              </>
            )}
            
            {profileExists === true && (
              <div className="bg-green-50 p-4 rounded">
                <p className="text-green-800">✓ Profile already exists!</p>
                <a href="/dashboard" className="mt-2 inline-block text-blue-600 hover:text-blue-500">
                  Go to Dashboard
                </a>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}