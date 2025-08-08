'use client';

import React, { useState, useEffect } from 'react';
import { TouchButton, PullToRefresh } from '../../lib/utils/touchGestures';
import { OptimizedImage } from '../ui/OptimizedImage';

interface MobileOptimizedLayoutProps {
  children: React.ReactNode;
  title?: string;
  showBackButton?: boolean;
  onBack?: () => void;
  onRefresh?: () => Promise<void>;
  rightAction?: React.ReactNode;
  bottomNavigation?: React.ReactNode;
  className?: string;
}

export const MobileOptimizedLayout: React.FC<MobileOptimizedLayoutProps> = ({
  children,
  title,
  showBackButton = false,
  onBack,
  onRefresh,
  rightAction,
  bottomNavigation,
  className = '',
}) => {
  const [isScrolled, setIsScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 10);
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const content = onRefresh ? (
    <PullToRefresh onRefresh={onRefresh} className="flex-1">
      {children}
    </PullToRefresh>
  ) : (
    <div className="flex-1">{children}</div>
  );

  return (
    <div className={`flex flex-col min-h-screen bg-gray-50 dark:bg-gray-900 ${className}`}>
      {/* Mobile Header */}
      <header
        className={`
          sticky top-0 z-50 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700
          transition-shadow duration-200
          ${isScrolled ? 'shadow-sm' : ''}
        `}
      >
        <div className="flex items-center justify-between px-4 py-3 min-h-[56px]">
          {/* Left side */}
          <div className="flex items-center space-x-3">
            {showBackButton && (
              <TouchButton
                onPress={onBack}
                className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </TouchButton>
            )}
            
            {title && (
              <h1 className="text-lg font-semibold text-gray-900 dark:text-white truncate">
                {title}
              </h1>
            )}
          </div>

          {/* Right side */}
          {rightAction && (
            <div className="flex items-center">
              {rightAction}
            </div>
          )}
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 overflow-hidden">
        {content}
      </main>

      {/* Bottom Navigation */}
      {bottomNavigation && (
        <nav className="sticky bottom-0 z-40 bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700">
          {bottomNavigation}
        </nav>
      )}
    </div>
  );
};

// Mobile-optimized bottom navigation
interface BottomNavItem {
  id: string;
  label: string;
  icon: React.ReactNode;
  href: string;
  badge?: number;
}

interface MobileBottomNavProps {
  items: BottomNavItem[];
  activeItem: string;
  onItemPress: (item: BottomNavItem) => void;
}

export const MobileBottomNav: React.FC<MobileBottomNavProps> = ({
  items,
  activeItem,
  onItemPress,
}) => {
  return (
    <div className="flex items-center justify-around py-2 px-1">
      {items.map((item) => (
        <TouchButton
          key={item.id}
          onPress={() => onItemPress(item)}
          className={`
            flex flex-col items-center justify-center p-2 rounded-lg min-w-[60px]
            transition-colors duration-200
            ${activeItem === item.id
              ? 'text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20'
              : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
            }
          `}
        >
          <div className="relative">
            {item.icon}
            {item.badge && item.badge > 0 && (
              <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full min-w-[16px] h-4 flex items-center justify-center px-1">
                {item.badge > 99 ? '99+' : item.badge}
              </span>
            )}
          </div>
          <span className="text-xs mt-1 font-medium">{item.label}</span>
        </TouchButton>
      ))}
    </div>
  );
};

// Mobile-optimized card component
interface MobileCardProps {
  children: React.ReactNode;
  className?: string;
  padding?: 'none' | 'sm' | 'md' | 'lg';
  shadow?: boolean;
  rounded?: boolean;
}

export const MobileCard: React.FC<MobileCardProps> = ({
  children,
  className = '',
  padding = 'md',
  shadow = true,
  rounded = true,
}) => {
  const paddingClasses = {
    none: '',
    sm: 'p-3',
    md: 'p-4',
    lg: 'p-6',
  };

  return (
    <div
      className={`
        bg-white dark:bg-gray-800
        ${rounded ? 'rounded-lg' : ''}
        ${shadow ? 'shadow-sm' : ''}
        ${paddingClasses[padding]}
        ${className}
      `}
    >
      {children}
    </div>
  );
};

// Mobile-optimized list item
interface MobileListItemProps {
  children: React.ReactNode;
  onPress?: () => void;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  subtitle?: string;
  className?: string;
  disabled?: boolean;
}

export const MobileListItem: React.FC<MobileListItemProps> = ({
  children,
  onPress,
  leftIcon,
  rightIcon,
  subtitle,
  className = '',
  disabled = false,
}) => {
  const content = (
    <div className="flex items-center space-x-3 py-3 px-4">
      {leftIcon && (
        <div className="flex-shrink-0 text-gray-500 dark:text-gray-400">
          {leftIcon}
        </div>
      )}
      
      <div className="flex-1 min-w-0">
        <div className="text-gray-900 dark:text-white font-medium truncate">
          {children}
        </div>
        {subtitle && (
          <div className="text-sm text-gray-500 dark:text-gray-400 truncate">
            {subtitle}
          </div>
        )}
      </div>
      
      {rightIcon && (
        <div className="flex-shrink-0 text-gray-400 dark:text-gray-500">
          {rightIcon}
        </div>
      )}
    </div>
  );

  if (onPress && !disabled) {
    return (
      <TouchButton
        onPress={onPress}
        className={`
          w-full text-left border-b border-gray-100 dark:border-gray-700 last:border-b-0
          hover:bg-gray-50 dark:hover:bg-gray-700/50
          active:bg-gray-100 dark:active:bg-gray-700
          transition-colors duration-150
          ${className}
        `}
      >
        {content}
      </TouchButton>
    );
  }

  return (
    <div className={`border-b border-gray-100 dark:border-gray-700 last:border-b-0 ${className}`}>
      {content}
    </div>
  );
};

// Mobile-optimized floating action button
interface FloatingActionButtonProps {
  onPress: () => void;
  icon: React.ReactNode;
  className?: string;
  position?: 'bottom-right' | 'bottom-left' | 'bottom-center';
}

export const FloatingActionButton: React.FC<FloatingActionButtonProps> = ({
  onPress,
  icon,
  className = '',
  position = 'bottom-right',
}) => {
  const positionClasses = {
    'bottom-right': 'bottom-6 right-6',
    'bottom-left': 'bottom-6 left-6',
    'bottom-center': 'bottom-6 left-1/2 transform -translate-x-1/2',
  };

  return (
    <TouchButton
      onPress={onPress}
      className={`
        fixed z-50 w-14 h-14 bg-blue-600 hover:bg-blue-700 text-white
        rounded-full shadow-lg hover:shadow-xl
        flex items-center justify-center
        transition-all duration-200
        ${positionClasses[position]}
        ${className}
      `}
    >
      {icon}
    </TouchButton>
  );
};