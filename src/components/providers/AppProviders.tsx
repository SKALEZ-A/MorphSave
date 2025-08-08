'use client';

import React, { ReactNode } from 'react';
import { WebSocketProvider } from './WebSocketProvider';
import { useAuth } from '../../hooks/useAuth';

interface AppProvidersProps {
  children: ReactNode;
}

export const AppProviders: React.FC<AppProvidersProps> = ({ children }) => {
  const { token, isLoading } = useAuth();

  // Don't render WebSocket provider until auth is loaded
  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  return (
    <WebSocketProvider token={token}>
      {children}
    </WebSocketProvider>
  );
};