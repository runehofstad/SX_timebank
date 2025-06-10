'use client';

import { RefreshCw } from 'lucide-react';
import { usePullToRefresh } from '@/hooks/usePullToRefresh';

interface PullToRefreshProps {
  onRefresh: () => Promise<void>;
  children: React.ReactNode;
}

export default function PullToRefresh({ onRefresh, children }: PullToRefreshProps) {
  const { isPulling, pullDistance, isRefreshing, threshold } = usePullToRefresh({
    onRefresh,
    threshold: 80,
    refreshTimeout: 1500,
  });

  const pullProgress = Math.min(pullDistance / threshold, 1);
  const showIndicator = isPulling || isRefreshing;

  return (
    <div className="relative">
      {/* Pull indicator */}
      <div
        className={`absolute top-0 left-0 right-0 flex justify-center transition-all duration-300 ${
          showIndicator ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
        style={{
          transform: `translateY(${isRefreshing ? 0 : pullDistance - 50}px)`,
          height: '50px',
          zIndex: 10,
        }}
      >
        <div className="flex items-center justify-center">
          <div
            className={`rounded-full bg-white dark:bg-gray-800 shadow-lg p-3 ${
              isRefreshing ? 'animate-spin' : ''
            }`}
            style={{
              transform: `rotate(${pullProgress * 360}deg)`,
              transition: isRefreshing ? 'none' : 'transform 0.1s',
            }}
          >
            <RefreshCw
              className={`h-5 w-5 ${
                pullProgress >= 1
                  ? 'text-studio-x'
                  : 'text-gray-400 dark:text-gray-600'
              }`}
            />
          </div>
        </div>
      </div>

      {/* Main content */}
      <div
        className="relative"
        style={{
          transform: `translateY(${isPulling || isRefreshing ? Math.min(pullDistance, threshold) : 0}px)`,
          transition: isPulling ? 'none' : 'transform 0.3s ease-out',
        }}
      >
        {children}
      </div>
    </div>
  );
}