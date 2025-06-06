'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { User } from '@/types';

interface ProtectedRouteProps {
  children: React.ReactNode;
  requiredRoles?: User['role'][];
}

export default function ProtectedRoute({ children, requiredRoles }: ProtectedRouteProps) {
  const { currentUser, userProfile, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !currentUser) {
      router.push('/login');
    }
    
    if (!loading && currentUser && requiredRoles && userProfile) {
      if (!requiredRoles.includes(userProfile.role)) {
        router.push('/dashboard');
      }
    }
  }, [currentUser, userProfile, loading, router, requiredRoles]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-studio-x"></div>
      </div>
    );
  }

  if (!currentUser) {
    return null;
  }

  if (requiredRoles && userProfile && !requiredRoles.includes(userProfile.role)) {
    return null;
  }

  return <>{children}</>;
}