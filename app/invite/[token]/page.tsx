'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { collection, query, where, getDocs, updateDoc, doc } from 'firebase/firestore';
import { createUserWithEmailAndPassword } from 'firebase/auth';
import { auth, db } from '@/lib/firebase/config';
import { Invitation } from '@/types';

export default function InvitePage({ params }: { params: { token: string } }) {
  const router = useRouter();
  const [invitation, setInvitation] = useState<Invitation | null>(null);
  const [loading, setLoading] = useState(true);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [accepting, setAccepting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchInvitation();
  }, [params.token]);

  const fetchInvitation = async () => {
    try {
      const inviteQuery = query(
        collection(db, 'invitations'),
        where('token', '==', params.token),
        where('status', '==', 'pending')
      );
      const inviteSnapshot = await getDocs(inviteQuery);
      
      if (!inviteSnapshot.empty) {
        const inviteData = {
          id: inviteSnapshot.docs[0].id,
          ...inviteSnapshot.docs[0].data()
        } as Invitation;
        setInvitation(inviteData);
      }
    } catch (error) {
      console.error('Error fetching invitation:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAccept = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    if (password.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }

    if (!invitation) return;

    setAccepting(true);

    try {
      // Create user account
      const { user } = await createUserWithEmailAndPassword(auth, invitation.email, password);
      
      // Create user profile
      await setDoc(doc(db, 'users', user.uid), {
        id: user.uid,
        email: invitation.email,
        name: invitation.name,
        role: invitation.role,
        department: invitation.department,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      // Update invitation status
      await updateDoc(doc(db, 'invitations', invitation.id), {
        status: 'accepted',
        acceptedAt: new Date(),
      });

      // Redirect to dashboard
      router.push('/dashboard');
    } catch (err) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError('Failed to create account');
      }
      setAccepting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-studio-x"></div>
      </div>
    );
  }

  if (!invitation) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-background">
        <div className="max-w-md w-full text-center">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">Invalid Invitation</h2>
          <p className="text-gray-600 mb-8">
            This invitation link is invalid or has already been used.
          </p>
          <a href="/login" className="text-studio-x hover:text-studio-x-600">
            Go to login
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div>
          <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900 dark:text-foreground">
            Accept Invitation
          </h2>
          <p className="mt-2 text-center text-sm text-gray-600 dark:text-muted-foreground">
            You've been invited to join as a {invitation.role.replace('_', ' ')}
          </p>
        </div>
        
        <form className="mt-8 space-y-6" onSubmit={handleAccept}>
          <div className="rounded-md shadow-sm -space-y-px">
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Name</label>
              <input
                type="text"
                value={invitation.name}
                disabled
                className="mt-1 appearance-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-md focus:outline-none focus:ring-studio-x focus:border-studio-x focus:z-10 sm:text-sm bg-gray-100 dark:bg-muted"
              />
            </div>
            
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Email</label>
              <input
                type="email"
                value={invitation.email}
                disabled
                className="mt-1 appearance-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-md focus:outline-none focus:ring-studio-x focus:border-studio-x focus:z-10 sm:text-sm bg-gray-100 dark:bg-muted"
              />
            </div>
            
            <div className="mb-4">
              <label htmlFor="password" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                Create Password
              </label>
              <input
                id="password"
                name="password"
                type="password"
                autoComplete="new-password"
                required
                className="mt-1 appearance-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-md focus:outline-none focus:ring-studio-x focus:border-studio-x focus:z-10 sm:text-sm"
                placeholder="Minimum 6 characters"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
            
            <div>
              <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                Confirm Password
              </label>
              <input
                id="confirmPassword"
                name="confirmPassword"
                type="password"
                autoComplete="new-password"
                required
                className="mt-1 appearance-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-md focus:outline-none focus:ring-studio-x focus:border-studio-x focus:z-10 sm:text-sm"
                placeholder="Confirm your password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
              />
            </div>
          </div>

          {error && (
            <div className="rounded-md bg-red-50 p-4">
              <div className="flex">
                <div className="ml-3">
                  <h3 className="text-sm font-medium text-red-800 dark:text-red-200">{error}</h3>
                </div>
              </div>
            </div>
          )}

          <div>
            <button
              type="submit"
              disabled={accepting}
              className="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-studio-x hover:bg-studio-x-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-studio-x disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {accepting ? 'Creating account...' : 'Accept & Create Account'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// Import for setDoc
import { setDoc } from 'firebase/firestore';