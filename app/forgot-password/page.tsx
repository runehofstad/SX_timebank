'use client';

import { useState } from 'react';
import { sendPasswordResetEmail } from 'firebase/auth';
import { auth } from '@/lib/firebase/config';
import Link from 'next/link';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setMessage('');
    setLoading(true);

    try {
      await sendPasswordResetEmail(auth, email);
      setMessage('Password reset email sent! Check your inbox.');
      setEmail('');
    } catch (err) {
      const error = err as any; // eslint-disable-line @typescript-eslint/no-explicit-any
      if (error.code === 'auth/user-not-found') {
        setError('No user found with this email address.');
      } else if (error.code === 'auth/invalid-email') {
        setError('Invalid email address.');
      } else {
        setError('Failed to send reset email. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-background py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div>
          {/* Logo */}
          <div className="flex justify-center mb-8">
            {/* Light mode logo */}
            <img 
              src="/timebank_logo_light.png" 
              alt="Timebank Logo" 
              className="h-16 w-auto dark:hidden"
            />
            {/* Dark mode logo */}
            <img 
              src="/timebank_logo_dark.png" 
              alt="Timebank Logo" 
              className="h-16 w-auto hidden dark:block"
            />
          </div>
          
          <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900 dark:text-foreground">
            Reset your password
          </h2>
          <p className="mt-2 text-center text-sm text-gray-600 dark:text-muted-foreground">
            Enter your email address and we&apos;ll send you a link to reset your password.
          </p>
        </div>
        
        <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
          {error && (
            <div className="rounded-md bg-red-50 dark:bg-red-900/20 p-4">
              <div className="flex">
                <div className="ml-3">
                  <h3 className="text-sm font-medium text-red-800 dark:text-red-200">{error}</h3>
                </div>
              </div>
            </div>
          )}
          
          {message && (
            <div className="rounded-md bg-green-50 dark:bg-green-900/20 p-4">
              <div className="flex">
                <div className="ml-3">
                  <h3 className="text-sm font-medium text-green-800 dark:text-green-200">{message}</h3>
                </div>
              </div>
            </div>
          )}
          
          <div className="-space-y-px">
            <div>
              <label htmlFor="email-address" className="sr-only">
                Email address
              </label>
              <input
                id="email-address"
                name="email"
                type="email"
                autoComplete="email"
                required
                className="appearance-none relative block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 placeholder-gray-500 dark:placeholder-gray-400 text-gray-900 dark:text-foreground rounded-md focus:outline-none focus:ring-studio-x focus:border-studio-x focus:z-10 sm:text-sm bg-white dark:bg-card"
                placeholder="Email address"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
          </div>

          <div>
            <button
              type="submit"
              disabled={loading}
              className="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-studio-x hover:bg-studio-x-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-studio-x disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Sending...' : 'Send reset email'}
            </button>
          </div>

          <div className="text-center">
            <Link 
              href="/login" 
              className="font-medium text-studio-x hover:text-studio-x-600"
            >
              Back to login
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
}