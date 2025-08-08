'use client';

import React, { useEffect, useState } from 'react';
import { useWebSocketContext } from '../../../lib/websocket/useWebSocket';
import { 
  ChallengeProgressData, 
  LeaderboardData,
  MessageData 
} from '../../../lib/websocket/types';
import { Card } from '../ui/Card';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';

interface LiveChallengeProgressProps {
  challengeId: string;
  challengeName: string;
  userId: string;
}

export const LiveChallengeProgress: React.FC<LiveChallengeProgressProps> = ({
  challengeId,
  challengeName,
  userId
}) => {
  const {
    isConnected,
    joinChallenge,
    leaveChallenge,
    sendMessage,
    startTyping,
    stopTyping,
    onChallengeProgress,
    onLeaderboardUpdate,
    onNewMessage
  } = useWebSocketContext();

  const [progress, setProgress] = useState<ChallengeProgressData | null>(null);
  const [leaderboard, setLeaderboard] = useState<LeaderboardData | null>(null);
  const [messages, setMessages] = useState<MessageData[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [typingUsers, setTypingUsers] = useState<Set<string>>(new Set());
  const [isJoined, setIsJoined] = useState(false);

  useEffect(() => {
    if (isConnected && challengeId) {
      joinChallenge(challengeId);
      setIsJoined(true);
    }

    return () => {
      if (challengeId) {
        leaveChallenge(challengeId);
        setIsJoined(false);
      }
    };
  }, [isConnected, challengeId, joinChallenge, leaveChallenge]);

  useEffect(() => {
    // Set up real-time event listeners
    const unsubscribeProgress = onChallengeProgress((data) => {
      if (data.challengeId === challengeId) {
        setProgress(data);
      }
    });

    const unsubscribeLeaderboard = onLeaderboardUpdate((data) => {
      if (data.challengeId === challengeId) {
        setLeaderboard(data);
      }
    });

    const unsubscribeMessages = onNewMessage((data) => {
      if (data.challengeId === challengeId) {
        setMessages(prev => [...prev, data]);
        
        // Remove typing indicator for this user
        if (data.senderId !== userId) {
          setTypingUsers(prev => {
            const newSet = new Set(prev);
            newSet.delete(data.senderId);
            return newSet;
          });
        }
      }
    });

    // Cleanup subscriptions
    return () => {
      unsubscribeProgress();
      unsubscribeLeaderboard();
      unsubscribeMessages();
    };
  }, [challengeId, userId, onChallengeProgress, onLeaderboardUpdate, onNewMessage]);

  const handleSendMessage = () => {
    if (newMessage.trim() && isJoined) {
      sendMessage({
        challengeId,
        message: newMessage.trim()
      });
      setNewMessage('');
    }
  };

  const handleTyping = () => {
    if (isJoined) {
      startTyping({ challengeId });
    }
  };

  const handleStopTyping = () => {
    if (isJoined) {
      stopTyping({ challengeId });
    }
  };

  const formatTimeRemaining = (ms: number) => {
    const days = Math.floor(ms / (1000 * 60 * 60 * 24));
    const hours = Math.floor((ms % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60));
    
    if (days > 0) return `${days}d ${hours}h`;
    if (hours > 0) return `${hours}h ${minutes}m`;
    return `${minutes}m`;
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount);
  };

  const formatTime = (date: Date) => {
    return new Intl.DateTimeFormat('en-US', {
      hour: '2-digit',
      minute: '2-digit'
    }).format(new Date(date));
  };

  const getUserProgress = () => {
    return progress?.participants.find(p => p.userId === userId);
  };

  return (
    <div className="space-y-6">
      {/* Challenge Header */}
      <Card className="p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-2xl font-bold">{challengeName}</h2>
          <div className="flex items-center space-x-2">
            <div className={`w-3 h-3 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'}`} />
            <span className="text-sm text-gray-600">
              {isConnected ? 'Live' : 'Disconnected'}
            </span>
          </div>
        </div>
        
        {progress && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="text-center">
              <p className="text-2xl font-bold text-blue-600">
                {progress.participants.length}
              </p>
              <p className="text-sm text-gray-600">Participants</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-green-600">
                {formatCurrency(progress.totalProgress)}
              </p>
              <p className="text-sm text-gray-600">Total Progress</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-orange-600">
                {formatTimeRemaining(progress.timeRemaining)}
              </p>
              <p className="text-sm text-gray-600">Time Remaining</p>
            </div>
          </div>
        )}
      </Card>

      {/* User's Progress */}
      {getUserProgress() && (
        <Card className="p-6">
          <h3 className="text-lg font-semibold mb-4">Your Progress</h3>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-2xl font-bold text-purple-600">
                {formatCurrency(getUserProgress()!.progress)}
              </p>
              <p className="text-sm text-gray-600">Your Savings</p>
            </div>
            <div className="text-right">
              <p className="text-lg font-semibold">Rank #{getUserProgress()!.rank}</p>
              <Badge variant={getUserProgress()!.rank <= 3 ? 'success' : 'default'}>
                {getUserProgress()!.rank <= 3 ? 'Top 3!' : 'Keep Going!'}
              </Badge>
            </div>
          </div>
        </Card>
      )}

      {/* Live Leaderboard */}
      {leaderboard && (
        <Card className="p-6">
          <h3 className="text-lg font-semibold mb-4">Live Leaderboard</h3>
          <div className="space-y-3">
            {leaderboard.leaderboard.map((entry) => (
              <div 
                key={entry.userId} 
                className={`flex items-center justify-between p-3 rounded-lg ${
                  entry.userId === userId ? 'bg-blue-50 border border-blue-200' : 'bg-gray-50'
                }`}
              >
                <div className="flex items-center space-x-3">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold ${
                    entry.rank === 1 ? 'bg-yellow-500 text-white' :
                    entry.rank === 2 ? 'bg-gray-400 text-white' :
                    entry.rank === 3 ? 'bg-orange-500 text-white' :
                    'bg-gray-200 text-gray-700'
                  }`}>
                    {entry.rank}
                  </div>
                  <div>
                    <p className="font-semibold">{entry.username}</p>
                    {entry.userId === userId && (
                      <p className="text-xs text-blue-600">You</p>
                    )}
                  </div>
                </div>
                <div className="text-right">
                  <p className="font-semibold">{formatCurrency(entry.score)}</p>
                </div>
              </div>
            ))}
          </div>
          <p className="text-xs text-gray-500 mt-4">
            Last updated: {formatTime(leaderboard.lastUpdated)}
          </p>
        </Card>
      )}

      {/* Live Chat */}
      <Card className="p-6">
        <h3 className="text-lg font-semibold mb-4">Challenge Chat</h3>
        
        {/* Messages */}
        <div className="h-64 overflow-y-auto mb-4 space-y-2 border rounded-lg p-3 bg-gray-50">
          {messages.map((message, index) => (
            <div 
              key={index}
              className={`flex ${message.senderId === userId ? 'justify-end' : 'justify-start'}`}
            >
              <div className={`max-w-xs px-3 py-2 rounded-lg ${
                message.senderId === userId 
                  ? 'bg-blue-500 text-white' 
                  : 'bg-white border'
              }`}>
                {message.senderId !== userId && (
                  <p className="text-xs font-semibold mb-1">{message.senderUsername}</p>
                )}
                <p className="text-sm">{message.message}</p>
                <p className={`text-xs mt-1 ${
                  message.senderId === userId ? 'text-blue-100' : 'text-gray-500'
                }`}>
                  {formatTime(message.timestamp)}
                </p>
              </div>
            </div>
          ))}
          
          {/* Typing indicators */}
          {typingUsers.size > 0 && (
            <div className="text-sm text-gray-500 italic">
              {Array.from(typingUsers).join(', ')} {typingUsers.size === 1 ? 'is' : 'are'} typing...
            </div>
          )}
        </div>

        {/* Message input */}
        <div className="flex space-x-2">
          <Input
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            onFocus={handleTyping}
            onBlur={handleStopTyping}
            onKeyPress={(e) => {
              if (e.key === 'Enter') {
                handleSendMessage();
              }
            }}
            placeholder="Type a message..."
            disabled={!isJoined}
            className="flex-1"
          />
          <Button 
            onClick={handleSendMessage}
            disabled={!newMessage.trim() || !isJoined}
          >
            Send
          </Button>
        </div>
      </Card>
    </div>
  );
};