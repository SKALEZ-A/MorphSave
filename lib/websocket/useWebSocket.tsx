import React, { useEffect, useRef, useState, useCallback, createContext, useContext, ReactNode } from 'react';
import { io, Socket } from 'socket.io-client';
import { 
  ServerToClientEvents, 
  ClientToServerEvents, 
  ConnectionState,
  BalanceUpdateData,
  TransactionUpdateData,
  ChallengeProgressData,
  LeaderboardData,
  AchievementData,
  MessageData,
  NotificationData
} from './types';

interface UseWebSocketOptions {
  autoConnect?: boolean;
  reconnection?: boolean;
  reconnectionAttempts?: number;
  reconnectionDelay?: number;
}

interface UseWebSocketReturn {
  socket: Socket<ServerToClientEvents, ClientToServerEvents> | null;
  connectionState: ConnectionState;
  isConnected: boolean;
  connect: () => void;
  disconnect: () => void;
  
  // Event emitters
  joinChallenge: (challengeId: string) => void;
  leaveChallenge: (challengeId: string) => void;
  sendMessage: (data: { recipientId?: string; challengeId?: string; message: string }) => void;
  startTyping: (data: { recipientId?: string; challengeId?: string }) => void;
  stopTyping: (data: { recipientId?: string; challengeId?: string }) => void;
  
  // Event listeners
  onBalanceUpdate: (callback: (data: BalanceUpdateData) => void) => () => void;
  onTransactionUpdate: (callback: (data: TransactionUpdateData) => void) => () => void;
  onChallengeProgress: (callback: (data: ChallengeProgressData) => void) => () => void;
  onLeaderboardUpdate: (callback: (data: LeaderboardData) => void) => () => void;
  onAchievementUnlocked: (callback: (data: AchievementData) => void) => () => void;
  onNewMessage: (callback: (data: MessageData) => void) => () => void;
  onNotification: (callback: (data: NotificationData) => void) => () => void;
}

export const useWebSocket = (
  token: string | null,
  options: UseWebSocketOptions = {}
): UseWebSocketReturn => {
  const {
    autoConnect = true,
    reconnection = true,
    reconnectionAttempts = 5,
    reconnectionDelay = 1000
  } = options;

  const [connectionState, setConnectionState] = useState<ConnectionState>(ConnectionState.DISCONNECTED);
  const [socket, setSocket] = useState<Socket<ServerToClientEvents, ClientToServerEvents> | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout>();

  const connect = useCallback(() => {
    if (!token || socket?.connected) return;

    setConnectionState(ConnectionState.CONNECTING);

    const newSocket = io(process.env.NEXT_PUBLIC_WS_URL || 'http://localhost:3001', {
      auth: { token },
      transports: ['websocket', 'polling'],
      reconnection,
      reconnectionAttempts,
      reconnectionDelay
    });

    // Connection event handlers
    newSocket.on('connect', () => {
      console.log('WebSocket connected');
      setConnectionState(ConnectionState.CONNECTED);
      
      // Join friends room automatically
      newSocket.emit('join_friends_room');
    });

    newSocket.on('disconnect', (reason) => {
      console.log('WebSocket disconnected:', reason);
      setConnectionState(ConnectionState.DISCONNECTED);
    });

    newSocket.on('connect_error', (error) => {
      console.error('WebSocket connection error:', error);
      setConnectionState(ConnectionState.ERROR);
    });

    newSocket.io.on('reconnect', () => {
      console.log('WebSocket reconnected');
      setConnectionState(ConnectionState.CONNECTED);
    });

    newSocket.io.on('reconnect_attempt', () => {
      setConnectionState(ConnectionState.RECONNECTING);
    });

    newSocket.io.on('reconnect_failed', () => {
      console.error('WebSocket reconnection failed');
      setConnectionState(ConnectionState.ERROR);
    });

    setSocket(newSocket);
  }, [token, reconnection, reconnectionAttempts, reconnectionDelay]);

  const disconnect = useCallback(() => {
    if (socket) {
      socket.disconnect();
      setSocket(null);
      setConnectionState(ConnectionState.DISCONNECTED);
    }
    
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
    }
  }, [socket]);

  // Auto-connect on mount if enabled
  useEffect(() => {
    if (autoConnect && token) {
      connect();
    }

    return () => {
      disconnect();
    };
  }, [autoConnect, token, connect, disconnect]);

  // Event emitters
  const joinChallenge = useCallback((challengeId: string) => {
    socket?.emit('join_challenge', challengeId);
  }, [socket]);

  const leaveChallenge = useCallback((challengeId: string) => {
    socket?.emit('leave_challenge', challengeId);
  }, [socket]);

  const sendMessage = useCallback((data: { recipientId?: string; challengeId?: string; message: string }) => {
    socket?.emit('send_message', data);
  }, [socket]);

  const startTyping = useCallback((data: { recipientId?: string; challengeId?: string }) => {
    socket?.emit('typing_start', data);
  }, [socket]);

  const stopTyping = useCallback((data: { recipientId?: string; challengeId?: string }) => {
    socket?.emit('typing_stop', data);
  }, [socket]);

  // Event listeners with cleanup
  const onBalanceUpdate = useCallback((callback: (data: BalanceUpdateData) => void) => {
    if (!socket) return () => {};
    
    socket.on('balance_updated', callback);
    return () => socket.off('balance_updated', callback);
  }, [socket]);

  const onTransactionUpdate = useCallback((callback: (data: TransactionUpdateData) => void) => {
    if (!socket) return () => {};
    
    socket.on('transaction_updated', callback);
    return () => socket.off('transaction_updated', callback);
  }, [socket]);

  const onChallengeProgress = useCallback((callback: (data: ChallengeProgressData) => void) => {
    if (!socket) return () => {};
    
    socket.on('challenge_progress_updated', callback);
    return () => socket.off('challenge_progress_updated', callback);
  }, [socket]);

  const onLeaderboardUpdate = useCallback((callback: (data: LeaderboardData) => void) => {
    if (!socket) return () => {};
    
    socket.on('leaderboard_updated', callback);
    return () => socket.off('leaderboard_updated', callback);
  }, [socket]);

  const onAchievementUnlocked = useCallback((callback: (data: AchievementData) => void) => {
    if (!socket) return () => {};
    
    socket.on('achievement_unlocked', callback);
    return () => socket.off('achievement_unlocked', callback);
  }, [socket]);

  const onNewMessage = useCallback((callback: (data: MessageData) => void) => {
    if (!socket) return () => {};
    
    socket.on('new_message', callback);
    return () => socket.off('new_message', callback);
  }, [socket]);

  const onNotification = useCallback((callback: (data: NotificationData) => void) => {
    if (!socket) return () => {};
    
    socket.on('notification', callback);
    return () => socket.off('notification', callback);
  }, [socket]);

  return {
    socket,
    connectionState,
    isConnected: connectionState === ConnectionState.CONNECTED,
    connect,
    disconnect,
    
    // Event emitters
    joinChallenge,
    leaveChallenge,
    sendMessage,
    startTyping,
    stopTyping,
    
    // Event listeners
    onBalanceUpdate,
    onTransactionUpdate,
    onChallengeProgress,
    onLeaderboardUpdate,
    onAchievementUnlocked,
    onNewMessage,
    onNotification
  };
};

// Context provider for WebSocket
interface WebSocketContextType extends UseWebSocketReturn {}

const WebSocketContext = createContext<WebSocketContextType | null>(null);

interface WebSocketProviderProps {
  children: ReactNode;
  token: string | null;
  options?: UseWebSocketOptions;
}

export const WebSocketProvider: React.FC<WebSocketProviderProps> = ({ 
  children, 
  token, 
  options 
}) => {
  const webSocket = useWebSocket(token, options);

  return (
    <WebSocketContext.Provider value={webSocket}>
      {children}
    </WebSocketContext.Provider>
  );
};

export const useWebSocketContext = (): WebSocketContextType => {
  const context = useContext(WebSocketContext);
  if (!context) {
    throw new Error('useWebSocketContext must be used within a WebSocketProvider');
  }
  return context;
};