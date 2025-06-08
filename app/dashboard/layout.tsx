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
      {children}
    </div>
  );
}