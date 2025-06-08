'use client';

import { useState } from 'react';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase/config';
import { useAuth } from '@/contexts/AuthContext';
import ProtectedRoute from '@/components/auth/ProtectedRoute';

export default function AdminUpgradePage() {
  const { userProfile, currentUser } = useAuth();
  const [upgrading, setUpgrading] = useState(false);

  const handleUpgrade = async () => {
    console.log('Upgrade button clicked');
    console.log('Current user:', currentUser);
    console.log('User profile:', userProfile);
    
    if (!currentUser) {
      alert('No user logged in. Please login first.');
      return;
    }
    
    if (!userProfile) {
      alert('User profile not loaded. Please refresh the page.');
      return;
    }
    
    setUpgrading(true);
    try {
      console.log('Attempting to update user document:', currentUser.uid);
      
      await updateDoc(doc(db, 'users', currentUser.uid), {
        role: 'admin',
        updatedAt: new Date(),
      });
      
      console.log('Update successful');
      alert('You have been upgraded to Admin! The page will now refresh.');
      
      // Force a page reload to refresh the auth context
      setTimeout(() => {
        window.location.href = '/dashboard';
      }, 1000);
    } catch (error) {
      console.error('Error upgrading to admin:', error);
      alert(`Failed to upgrade to admin: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setUpgrading(false);
    }
  };

  return (
    <ProtectedRoute>
      <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-md w-full space-y-8">
          <div className="text-center">
            <h2 className="mt-6 text-3xl font-extrabold text-gray-900 dark:text-foreground">
              Admin Upgrade Tool
            </h2>
            <p className="mt-2 text-sm text-gray-600 dark:text-muted-foreground">
              This is a temporary page to upgrade your account to Admin role
            </p>
          </div>
          
          <div className="bg-white shadow rounded-lg p-6">
            <div className="space-y-4">
              <div>
                <p className="text-sm text-gray-600 dark:text-muted-foreground">Current User:</p>
                <p className="font-medium">{userProfile?.email}</p>
              </div>
              
              <div>
                <p className="text-sm text-gray-600 dark:text-muted-foreground">Current Role:</p>
                <p className="font-medium capitalize">{userProfile?.role?.replace('_', ' ') || 'No role set'}</p>
              </div>
              
              <div className="bg-gray-50 p-3 rounded text-xs font-mono">
                <p>Debug Info:</p>
                <p>Auth UID: {currentUser?.uid || 'No user'}</p>
                <p>Profile ID: {userProfile?.id || 'No profile'}</p>
                <p>Has Profile: {userProfile ? 'Yes' : 'No'}</p>
              </div>
              
              {userProfile?.role === 'admin' ? (
                <div className="bg-green-50 border border-green-200 rounded-md p-4">
                  <p className="text-green-800 dark:text-green-200">✓ You are already an Admin!</p>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="bg-yellow-50 border border-yellow-200 rounded-md p-4">
                    <p className="text-yellow-800 text-sm">
                      ⚠️ Upgrading to Admin will give you full access to all features including:
                    </p>
                    <ul className="mt-2 list-disc list-inside text-sm text-yellow-700">
                      <li>Client Management</li>
                      <li>Timebank Management</li>
                      <li>User Management</li>
                      <li>System Settings</li>
                    </ul>
                  </div>
                  
                  <button
                    onClick={handleUpgrade}
                    disabled={upgrading}
                    className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-studio-x hover:bg-studio-x-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-studio-x disabled:opacity-50"
                  >
                    {upgrading ? 'Upgrading...' : 'Upgrade to Admin'}
                  </button>
                </div>
              )}
              
              <div className="text-center">
                <a
                  href="/dashboard"
                  className="text-sm text-studio-x hover:text-studio-x-600"
                >
                  Back to Dashboard
                </a>
              </div>
            </div>
          </div>
        </div>
      </div>
    </ProtectedRoute>
  );
}