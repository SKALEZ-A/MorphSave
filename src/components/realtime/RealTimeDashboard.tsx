'use client';

import React, { useEffect, useState } from 'react';
import { useWebSocketContext } from '../../../lib/websocket/useWebSocket';
import { 
  BalanceUpdateData, 
  TransactionUpdateData, 
  AchievementData,
  NotificationData,
  ConnectionState 
} from '../../../lib/websocket/types';
import { Card } from '../ui/Card';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';

interface RealTimeDashboardProps {
  userId: string;
}

export const RealTimeDashboard: React.FC<RealTimeDashboardProps> = ({ userId }) => {
  const {
    connectionState,
    isConnected,
    onBalanceUpdate,
    onTransactionUpdate,
    onAchievementUnlocked,
    onNotification
  } = useWebSocketContext();

  const [balance, setBalance] = useState<BalanceUpdateData | null>(null);
  const [recentTransactions, setRecentTransactions] = useState<TransactionUpdateData[]>([]);
  const [recentAchievements, setRecentAchievements] = useState<AchievementData[]>([]);
  const [notifications, setNotifications] = useState<NotificationData[]>([]);

  useEffect(() => {
    // Set up real-time event listeners
    const unsubscribeBalance = onBalanceUpdate((data) => {
      setBalance(data);
    });

    const unsubscribeTransaction = onTransactionUpdate((data) => {
      setRecentTransactions(prev => [data, ...prev.slice(0, 4)]); // Keep last 5
    });

    const unsubscribeAchievement = onAchievementUnlocked((data) => {
      setRecentAchievements(prev => [data, ...prev.slice(0, 2)]); // Keep last 3
    });

    const unsubscribeNotification = onNotification((data) => {
      setNotifications(prev => [data, ...prev.slice(0, 4)]); // Keep last 5
    });

    // Cleanup subscriptions
    return () => {
      unsubscribeBalance();
      unsubscribeTransaction();
      unsubscribeAchievement();
      unsubscribeNotification();
    };
  }, [onBalanceUpdate, onTransactionUpdate, onAchievementUnlocked, onNotification]);

  const getConnectionStatusColor = () => {
    switch (connectionState) {
      case ConnectionState.CONNECTED:
        return 'bg-green-500';
      case ConnectionState.CONNECTING:
      case ConnectionState.RECONNECTING:
        return 'bg-yellow-500';
      case ConnectionState.DISCONNECTED:
      case ConnectionState.ERROR:
        return 'bg-red-500';
      default:
        return 'bg-gray-500';
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount);
  };

  const formatDate = (date: Date) => {
    return new Intl.DateTimeFormat('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    }).format(new Date(date));
  };

  return (
    <div className="space-y-6">
      {/* Connection Status */}
      <Card className="p-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold">Real-Time Connection</h3>
          <div className="flex items-center space-x-2">
            <div className={`w-3 h-3 rounded-full ${getConnectionStatusColor()}`} />
            <span className="text-sm text-gray-600 capitalize">
              {connectionState.replace('_', ' ')}
            </span>
          </div>
        </div>
      </Card>

      {/* Balance Overview */}
      {balance && (
        <Card className="p-6">
          <h3 className="text-lg font-semibold mb-4">Live Balance</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center">
              <p className="text-2xl font-bold text-green-600">
                {formatCurrency(balance.totalBalance)}
              </p>
              <p className="text-sm text-gray-600">Total Balance</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-blue-600">
                {formatCurrency(balance.totalSaved)}
              </p>
              <p className="text-sm text-gray-600">Total Saved</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-purple-600">
                {formatCurrency(balance.yieldEarned)}
              </p>
              <p className="text-sm text-gray-600">Yield Earned</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-orange-600">
                {balance.currentAPY.toFixed(2)}%
              </p>
              <p className="text-sm text-gray-600">Current APY</p>
            </div>
          </div>
          <p className="text-xs text-gray-500 mt-4">
            Last updated: {formatDate(balance.lastUpdated)}
          </p>
        </Card>
      )}

      {/* Recent Transactions */}
      <Card className="p-6">
        <h3 className="text-lg font-semibold mb-4">Live Transactions</h3>
        {recentTransactions.length > 0 ? (
          <div className="space-y-3">
            {recentTransactions.map((tx) => (
              <div key={tx.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div className="flex items-center space-x-3">
                  <div className={`w-2 h-2 rounded-full ${
                    tx.status === 'confirmed' ? 'bg-green-500' : 
                    tx.status === 'pending' ? 'bg-yellow-500' : 'bg-red-500'
                  }`} />
                  <div>
                    <p className="font-medium capitalize">{tx.type.replace('_', ' ')}</p>
                    <p className="text-sm text-gray-600">{formatDate(tx.timestamp)}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="font-semibold">{formatCurrency(tx.amount)}</p>
                  <Badge variant={tx.status === 'confirmed' ? 'success' : 'warning'}>
                    {tx.status}
                  </Badge>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-gray-500 text-center py-4">No recent transactions</p>
        )}
      </Card>

      {/* Recent Achievements */}
      <Card className="p-6">
        <h3 className="text-lg font-semibold mb-4">Latest Achievements</h3>
        {recentAchievements.length > 0 ? (
          <div className="space-y-3">
            {recentAchievements.map((achievement) => (
              <div key={achievement.id} className="flex items-center space-x-4 p-3 bg-gradient-to-r from-purple-50 to-pink-50 rounded-lg">
                <div className="text-3xl">{achievement.icon}</div>
                <div className="flex-1">
                  <p className="font-semibold">{achievement.name}</p>
                  <p className="text-sm text-gray-600">{achievement.description}</p>
                  <p className="text-xs text-gray-500">
                    Unlocked: {formatDate(achievement.unlockedAt)}
                  </p>
                </div>
                <div className="text-right">
                  <Badge variant={achievement.rarity === 'legendary' ? 'warning' : 'default'}>
                    {achievement.rarity}
                  </Badge>
                  <p className="text-sm font-semibold text-purple-600">
                    +{achievement.points} pts
                  </p>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-gray-500 text-center py-4">No recent achievements</p>
        )}
      </Card>

      {/* Notifications */}
      <Card className="p-6">
        <h3 className="text-lg font-semibold mb-4">Live Notifications</h3>
        {notifications.length > 0 ? (
          <div className="space-y-3">
            {notifications.map((notification) => (
              <div key={notification.id} className={`p-3 rounded-lg border-l-4 ${
                notification.type === 'achievement' ? 'border-purple-500 bg-purple-50' :
                notification.type === 'transaction' ? 'border-green-500 bg-green-50' :
                notification.type === 'challenge' ? 'border-blue-500 bg-blue-50' :
                'border-gray-500 bg-gray-50'
              }`}>
                <div className="flex items-start justify-between">
                  <div>
                    <p className="font-semibold">{notification.title}</p>
                    <p className="text-sm text-gray-600">{notification.message}</p>
                    <p className="text-xs text-gray-500 mt-1">
                      {formatDate(notification.createdAt)}
                    </p>
                  </div>
                  {!notification.read && (
                    <div className="w-2 h-2 bg-blue-500 rounded-full" />
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-gray-500 text-center py-4">No recent notifications</p>
        )}
      </Card>
    </div>
  );
};