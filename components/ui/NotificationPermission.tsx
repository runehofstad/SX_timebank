'use client';

import { useState } from 'react';
import { Bell, X } from 'lucide-react';
import { useFCMToken } from '@/hooks/useFCMToken';

export default function NotificationPermission() {
  const { permission, requestPermission, loading, error, isSupported } = useFCMToken();
  const [showPrompt, setShowPrompt] = useState(true);

  if (!isSupported) {
    return null;
  }

  if (permission === 'granted' || permission === 'denied' || !showPrompt) {
    return null;
  }

  return (
    <div className="fixed bottom-4 right-4 max-w-sm bg-white dark:bg-card rounded-lg shadow-lg border border-gray-200 dark:border-border p-4 z-50">
      <div className="flex items-start">
        <div className="flex-shrink-0">
          <Bell className="h-6 w-6 text-studio-x" />
        </div>
        <div className="ml-3 flex-1">
          <h3 className="text-sm font-medium text-gray-900 dark:text-foreground">
            Enable Push Notifications
          </h3>
          <p className="mt-1 text-sm text-gray-500 dark:text-muted-foreground">
            Get instant alerts when timebank hours are running low.
          </p>
          {error && (
            <p className="mt-2 text-sm text-red-600 dark:text-red-400">
              {error}
            </p>
          )}
          <div className="mt-4 flex space-x-3">
            <button
              onClick={requestPermission}
              disabled={loading}
              className="inline-flex items-center px-3 py-2 border border-transparent text-sm leading-4 font-medium rounded-md text-white bg-studio-x hover:bg-studio-x-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-studio-x disabled:opacity-50"
            >
              {loading ? 'Enabling...' : 'Enable'}
            </button>
            <button
              onClick={() => setShowPrompt(false)}
              className="inline-flex items-center px-3 py-2 border border-gray-300 dark:border-gray-600 text-sm leading-4 font-medium rounded-md text-gray-700 dark:text-gray-300 bg-white dark:bg-card hover:bg-gray-50 dark:hover:bg-secondary focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-studio-x"
            >
              Not Now
            </button>
          </div>
        </div>
        <button
          onClick={() => setShowPrompt(false)}
          className="ml-4 flex-shrink-0 text-gray-400 hover:text-gray-500"
        >
          <X className="h-5 w-5" />
        </button>
      </div>
    </div>
  );
}