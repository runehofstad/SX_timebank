'use client';

import { useEffect, useRef, useState, useCallback } from 'react';

interface UsePullToRefreshOptions {
  onRefresh: () => Promise<void>;
  threshold?: number;
  refreshTimeout?: number;
}

export function usePullToRefresh({
  onRefresh,
  threshold = 80,
  refreshTimeout = 2000,
}: UsePullToRefreshOptions) {
  const [isPulling, setIsPulling] = useState(false);
  const [pullDistance, setPullDistance] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);
  
  const startY = useRef<number | null>(null);
  const currentY = useRef(0);
  const isTracking = useRef(false);

  const handleTouchStart = useCallback((e: TouchEvent) => {
    // Only start tracking if we're at the top of the page
    if (window.scrollY <= 1) {
      startY.current = e.touches[0].clientY;
      isTracking.current = true;
    } else {
      startY.current = null;
      isTracking.current = false;
    }
  }, []);

  const handleTouchMove = useCallback((e: TouchEvent) => {
    if (!isTracking.current || startY.current === null) return;
    
    currentY.current = e.touches[0].clientY;
    const distance = currentY.current - startY.current;
    
    // Check if we're still at the top and pulling down
    if (window.scrollY <= 1 && distance > 0) {
      // Only activate pull-to-refresh after a threshold to avoid accidental triggers
      if (distance > 5) {
        // Only prevent default and set pulling if we're past the activation threshold
        if (!isPulling && distance > 10) {
          setIsPulling(true);
        }
        
        if (isPulling) {
          e.preventDefault();
          e.stopPropagation();
          setPullDistance(Math.min(distance, threshold * 1.5));
        }
      }
    } else {
      // Reset if we're no longer at the top or pulling up
      if (isPulling) {
        setIsPulling(false);
        setPullDistance(0);
      }
      isTracking.current = false;
      startY.current = null;
    }
  }, [threshold, isPulling]);

  const handleTouchEnd = useCallback(async () => {
    isTracking.current = false;
    startY.current = null;
    
    if (!isPulling) return;
    
    setIsPulling(false);
    
    if (pullDistance >= threshold && !isRefreshing) {
      setIsRefreshing(true);
      
      try {
        await onRefresh();
      } catch (error) {
        console.error('Error during refresh:', error);
      } finally {
        // Add a minimum refresh time for better UX
        setTimeout(() => {
          setIsRefreshing(false);
          setPullDistance(0);
        }, refreshTimeout);
      }
    } else {
      setPullDistance(0);
    }
  }, [isPulling, pullDistance, threshold, isRefreshing, onRefresh, refreshTimeout]);

  // Handle scroll events to reset state when scrolling
  const handleScroll = useCallback(() => {
    if (window.scrollY > 1 && (isPulling || isTracking.current)) {
      setIsPulling(false);
      setPullDistance(0);
      isTracking.current = false;
      startY.current = null;
    }
  }, [isPulling]);

  useEffect(() => {
    // Only enable on touch devices
    if ('ontouchstart' in window) {
      document.addEventListener('touchstart', handleTouchStart, { passive: true });
      document.addEventListener('touchmove', handleTouchMove, { passive: false });
      document.addEventListener('touchend', handleTouchEnd, { passive: true });
      window.addEventListener('scroll', handleScroll, { passive: true });
      
      return () => {
        document.removeEventListener('touchstart', handleTouchStart);
        document.removeEventListener('touchmove', handleTouchMove);
        document.removeEventListener('touchend', handleTouchEnd);
        window.removeEventListener('scroll', handleScroll);
      };
    }
  }, [handleTouchStart, handleTouchMove, handleTouchEnd, handleScroll]);

  return {
    isPulling,
    pullDistance,
    isRefreshing,
    threshold,
  };
}