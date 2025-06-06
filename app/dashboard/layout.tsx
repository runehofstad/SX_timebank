'use client';

import { useAuth } from '@/contexts/AuthContext';
import { useEffect } from 'react';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { userProfile } = useAuth();
  
  useEffect(() => {
    // Log user info for debugging
    console.log('Dashboard Layout - User Profile:', userProfile);
    console.log('User Role:', userProfile?.role);
    console.log('User Email:', userProfile?.email);
  }, [userProfile]);

  return (
    <div>
      {/* Debug info banner */}
      {userProfile && (
        <div className="bg-yellow-100 border-b border-yellow-300 p-2 text-sm">
          <div className="max-w-7xl mx-auto px-4">
            Debug: Logged in as <strong>{userProfile.email}</strong> with role <strong>{userProfile.role}</strong>
            {userProfile.role !== 'admin' && (
              <span className="ml-4 text-red-600">
                ⚠️ You need Admin role to access all features. Currently you are: {userProfile.role}
              </span>
            )}
          </div>
        </div>
      )}
      {children}
    </div>
  );
}