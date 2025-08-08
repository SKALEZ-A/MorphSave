'use client';

import { useEffect, useRef, useCallback, useState } from 'react';

export interface TouchGestureOptions {
  onSwipeLeft?: () => void;
  onSwipeRight?: () => void;
  onSwipeUp?: () => void;
  onSwipeDown?: () => void;
  onTap?: () => void;
  onDoubleTap?: () => void;
  onLongPress?: () => void;
  onPinch?: (scale: number) => void;
  threshold?: number;
  longPressDelay?: number;
  doubleTapDelay?: number;
}

export interface TouchPoint {
  x: number;
  y: number;
  timestamp: number;
}

export const useTouchGestures = (options: TouchGestureOptions) => {
  const elementRef = useRef<HTMLElement>(null);
  const startTouch = useRef<TouchPoint | null>(null);
  const lastTap = useRef<TouchPoint | null>(null);
  const longPressTimer = useRef<NodeJS.Timeout | null>(null);
  const initialDistance = useRef<number>(0);

  const {
    onSwipeLeft,
    onSwipeRight,
    onSwipeUp,
    onSwipeDown,
    onTap,
    onDoubleTap,
    onLongPress,
    onPinch,
    threshold = 50,
    longPressDelay = 500,
    doubleTapDelay = 300,
  } = options;

  const getDistance = useCallback((touch1: Touch, touch2: Touch): number => {
    const dx = touch1.clientX - touch2.clientX;
    const dy = touch1.clientY - touch2.clientY;
    return Math.sqrt(dx * dx + dy * dy);
  }, []);

  const handleTouchStart = useCallback((e: TouchEvent) => {
    const touch = e.touches[0];
    const now = Date.now();

    startTouch.current = {
      x: touch.clientX,
      y: touch.clientY,
      timestamp: now,
    };

    // Handle multi-touch for pinch gestures
    if (e.touches.length === 2 && onPinch) {
      initialDistance.current = getDistance(e.touches[0], e.touches[1]);
    }

    // Start long press timer
    if (onLongPress) {
      longPressTimer.current = setTimeout(() => {
        onLongPress();
        longPressTimer.current = null;
      }, longPressDelay);
    }
  }, [onLongPress, onPinch, longPressDelay, getDistance]);

  const handleTouchMove = useCallback((e: TouchEvent) => {
    // Cancel long press on move
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }

    // Handle pinch gesture
    if (e.touches.length === 2 && onPinch && initialDistance.current > 0) {
      const currentDistance = getDistance(e.touches[0], e.touches[1]);
      const scale = currentDistance / initialDistance.current;
      onPinch(scale);
    }
  }, [onPinch, getDistance]);

  const handleTouchEnd = useCallback((e: TouchEvent) => {
    // Clear long press timer
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }

    if (!startTouch.current) return;

    const touch = e.changedTouches[0];
    const endTouch: TouchPoint = {
      x: touch.clientX,
      y: touch.clientY,
      timestamp: Date.now(),
    };

    const deltaX = endTouch.x - startTouch.current.x;
    const deltaY = endTouch.y - startTouch.current.y;
    const deltaTime = endTouch.timestamp - startTouch.current.timestamp;
    const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);

    // Handle swipe gestures
    if (distance > threshold) {
      const absX = Math.abs(deltaX);
      const absY = Math.abs(deltaY);

      if (absX > absY) {
        // Horizontal swipe
        if (deltaX > 0 && onSwipeRight) {
          onSwipeRight();
        } else if (deltaX < 0 && onSwipeLeft) {
          onSwipeLeft();
        }
      } else {
        // Vertical swipe
        if (deltaY > 0 && onSwipeDown) {
          onSwipeDown();
        } else if (deltaY < 0 && onSwipeUp) {
          onSwipeUp();
        }
      }
    } else {
      // Handle tap gestures
      if (deltaTime < 200) {
        // Check for double tap
        if (lastTap.current && 
            endTouch.timestamp - lastTap.current.timestamp < doubleTapDelay &&
            Math.abs(endTouch.x - lastTap.current.x) < 20 &&
            Math.abs(endTouch.y - lastTap.current.y) < 20) {
          if (onDoubleTap) {
            onDoubleTap();
          }
          lastTap.current = null;
        } else {
          lastTap.current = endTouch;
          // Delay single tap to allow for double tap
          setTimeout(() => {
            if (lastTap.current === endTouch && onTap) {
              onTap();
            }
          }, doubleTapDelay);
        }
      }
    }

    startTouch.current = null;
    initialDistance.current = 0;
  }, [onSwipeLeft, onSwipeRight, onSwipeUp, onSwipeDown, onTap, onDoubleTap, threshold, doubleTapDelay]);

  useEffect(() => {
    const element = elementRef.current;
    if (!element) return;

    // Add passive listeners for better performance
    element.addEventListener('touchstart', handleTouchStart, { passive: true });
    element.addEventListener('touchmove', handleTouchMove, { passive: true });
    element.addEventListener('touchend', handleTouchEnd, { passive: true });

    return () => {
      element.removeEventListener('touchstart', handleTouchStart);
      element.removeEventListener('touchmove', handleTouchMove);
      element.removeEventListener('touchend', handleTouchEnd);
    };
  }, [handleTouchStart, handleTouchMove, handleTouchEnd]);

  return elementRef;
};

// Touch-friendly button component
export interface TouchButtonProps {
  children: React.ReactNode;
  onPress?: () => void;
  onLongPress?: () => void;
  className?: string;
  disabled?: boolean;
  hapticFeedback?: boolean;
}

export const TouchButton: React.FC<TouchButtonProps> = ({
  children,
  onPress,
  onLongPress,
  className = '',
  disabled = false,
  hapticFeedback = true,
}) => {
  const buttonRef = useTouchGestures({
    onTap: () => {
      if (!disabled && onPress) {
        if (hapticFeedback && 'vibrate' in navigator) {
          navigator.vibrate(10);
        }
        onPress();
      }
    },
    onLongPress: () => {
      if (!disabled && onLongPress) {
        if (hapticFeedback && 'vibrate' in navigator) {
          navigator.vibrate([50, 25, 50]);
        }
        onLongPress();
      }
    },
  });

  return (
    <button
      ref={buttonRef as any}
      className={`
        touch-manipulation select-none
        active:scale-95 transition-transform duration-100
        min-h-[44px] min-w-[44px] // Minimum touch target size
        ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
        ${className}
      `}
      disabled={disabled}
      type="button"
    >
      {children}
    </button>
  );
};

// Swipeable card component
export interface SwipeableCardProps {
  children: React.ReactNode;
  onSwipeLeft?: () => void;
  onSwipeRight?: () => void;
  className?: string;
  leftAction?: React.ReactNode;
  rightAction?: React.ReactNode;
}

export const SwipeableCard: React.FC<SwipeableCardProps> = ({
  children,
  onSwipeLeft,
  onSwipeRight,
  className = '',
  leftAction,
  rightAction,
}) => {
  const cardRef = useTouchGestures({
    onSwipeLeft,
    onSwipeRight,
    threshold: 100,
  });

  return (
    <div className={`relative overflow-hidden ${className}`}>
      {/* Left action (revealed on right swipe) */}
      {leftAction && (
        <div className="absolute left-0 top-0 h-full w-20 flex items-center justify-center bg-green-500 text-white">
          {leftAction}
        </div>
      )}
      
      {/* Right action (revealed on left swipe) */}
      {rightAction && (
        <div className="absolute right-0 top-0 h-full w-20 flex items-center justify-center bg-red-500 text-white">
          {rightAction}
        </div>
      )}
      
      {/* Main card content */}
      <div
        ref={cardRef as any}
        className="relative bg-white dark:bg-gray-800 transition-transform duration-200 ease-out"
      >
        {children}
      </div>
    </div>
  );
};

// Pull-to-refresh component
export interface PullToRefreshProps {
  children: React.ReactNode;
  onRefresh: () => Promise<void>;
  refreshThreshold?: number;
  className?: string;
}

export const PullToRefresh: React.FC<PullToRefreshProps> = ({
  children,
  onRefresh,
  refreshThreshold = 80,
  className = '',
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [pullDistance, setPullDistance] = useState(0);

  const handleTouchStart = useCallback((e: TouchEvent) => {
    if (containerRef.current?.scrollTop === 0) {
      const touch = e.touches[0];
      startTouch.current = { x: touch.clientX, y: touch.clientY, timestamp: Date.now() };
    }
  }, []);

  const handleTouchMove = useCallback((e: TouchEvent) => {
    if (!startTouch.current || containerRef.current?.scrollTop !== 0) return;

    const touch = e.touches[0];
    const deltaY = touch.clientY - startTouch.current.y;

    if (deltaY > 0) {
      e.preventDefault();
      setPullDistance(Math.min(deltaY * 0.5, refreshThreshold * 1.5));
    }
  }, [refreshThreshold]);

  const handleTouchEnd = useCallback(async () => {
    if (pullDistance >= refreshThreshold && !isRefreshing) {
      setIsRefreshing(true);
      try {
        await onRefresh();
      } finally {
        setIsRefreshing(false);
      }
    }
    setPullDistance(0);
    startTouch.current = null;
  }, [pullDistance, refreshThreshold, isRefreshing, onRefresh]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    container.addEventListener('touchstart', handleTouchStart, { passive: false });
    container.addEventListener('touchmove', handleTouchMove, { passive: false });
    container.addEventListener('touchend', handleTouchEnd);

    return () => {
      container.removeEventListener('touchstart', handleTouchStart);
      container.removeEventListener('touchmove', handleTouchMove);
      container.removeEventListener('touchend', handleTouchEnd);
    };
  }, [handleTouchStart, handleTouchMove, handleTouchEnd]);

  return (
    <div
      ref={containerRef}
      className={`relative overflow-auto ${className}`}
      style={{
        transform: `translateY(${pullDistance}px)`,
        transition: pullDistance === 0 ? 'transform 0.3s ease-out' : 'none',
      }}
    >
      {/* Pull indicator */}
      <div
        className="absolute top-0 left-0 right-0 flex items-center justify-center text-gray-500 transition-opacity duration-200"
        style={{
          height: `${pullDistance}px`,
          opacity: pullDistance > 20 ? 1 : 0,
          transform: `translateY(-${pullDistance}px)`,
        }}
      >
        {isRefreshing ? (
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-500" />
        ) : pullDistance >= refreshThreshold ? (
          <span>Release to refresh</span>
        ) : (
          <span>Pull to refresh</span>
        )}
      </div>
      
      {children}
    </div>
  );
};

