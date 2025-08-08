'use client';

import React from 'react';
import { clsx } from 'clsx';
import { Loader2 } from 'lucide-react';

export interface LoadingSpinnerProps {
  size?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
  text?: string;
}

const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({ 
  size = 'md', 
  className,
  text 
}) => {
  const sizes = {
    sm: 'h-4 w-4',
    md: 'h-6 w-6',
    lg: 'h-8 w-8',
    xl: 'h-12 w-12'
  };

  if (text) {
    return (
      <div className={clsx('flex items-center justify-center space-x-2', className)}>
        <Loader2 className={clsx('animate-spin text-blue-600', sizes[size])} />
        <span className="text-sm text-gray-600 dark:text-gray-400">{text}</span>
      </div>
    );
  }

  return (
    <div className={clsx('flex items-center justify-center', className)}>
      <Loader2 className={clsx('animate-spin text-blue-600', sizes[size])} />
    </div>
  );
};

export { LoadingSpinner };
export default LoadingSpinner;