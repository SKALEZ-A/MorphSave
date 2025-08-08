'use client';

import React, { ReactNode } from 'react';
import { WebSocketProvider as WSProvider } from '../../../lib/websocket/useWebSocket';

interface WebSocketProviderProps {
  children: ReactNode;
  token: string | null;
}

export const WebSocketProvider: React.FC<WebSocketProviderProps> = ({ 
  children, 
  token 
}) => {
  return (
    <WSProvider 
      token={token}
      options={{
        autoConnect: true,
        reconnection: true,
        reconnectionAttempts: 5,
        reconnectionDelay: 1000
      }}
    >
      {children}
    </WSProvider>
  );
};