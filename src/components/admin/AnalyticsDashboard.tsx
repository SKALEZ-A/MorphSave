'use client';

import React, { useState, useEffect } from 'react';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';

interface AnalyticsData {
  userMetrics: {
    totalUsers: number;
    activeUsers: number;
    newUsersToday: number;
    retentionRate: number;
    averageSessionTime: number;
  };
  engagementMetrics: {
    dailyActiveUsers: number;
    weeklyActiveUsers: number;
    monthlyActiveUsers: number;
    averageTransactionsPerUser: number;
    achievementUnlockRate: number;
  };
  financialMetrics: {
    totalSavings: number;
    averageSavingsPerUser: number;
    totalTransactions: number;
    averageTransactionAmount: number;
    yieldGenerated: number;
  };
  socialMetrics: {
    totalChallenges: number;
    activeChallenges: number;
    challengeParticipationRate: number;
    averageFriendsPerUser: number;
    socialShareRate: number;
  };
  technicalMetrics: {
    apiResponseTime: number;
    errorRate: number;
    uptime: number;
    blockchainSyncStatus: string;
    cacheHitRate: number;
  };
  timeSeriesData: {
    userGrowth: Array<{ date: string; users: number }>;
    savingsGrowth: Array<{ date: string; amount: number }>;
    transactionVolume: Array<{ date: string; count: number }>;
    engagementTrend: Array<{ date: string; engagement: number }>;
  };
}

const AnalyticsDashboard: React.FC = () => {
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedTimeRange, setSelectedTimeRange] = useState<'24h' | '7d' | '30d' | '90d'>('7d');

  useEffect(() => {
    fetchAnalytics();
    const interval = setInterval(fetchAnalytics, 60000); // Update every minute
    return () => clearInterval(interval);
  }, [selectedTimeRange]);

  const fetchAnalytics = async () => {
    try {
      const response = await fetch(`/api/admin/analytics?timeRange=${selectedTimeRange}`);
      if (response.ok) {
        const data = await response.json();
        setAnalytics(data);
      }
    } catch (error) {
      console.error('Failed to fetch analytics:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading || !analytics) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  const formatCurrency = (amount: number) => `$${amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  const formatPercentage = (value: number) => `${(value * 100).toFixed(1)}%`;
  const formatTime = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}m ${remainingSeconds}s`;
  };

  return (
    <div className="space-y-6">
      {/* Time Range Selector */}
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-gray-900">Analytics Dashboard</h2>
        <div className="flex space-x-2">
          {(['24h', '7d', '30d', '90d'] as const).map((range) => (
            <button
              key={range}
              onClick={() => setSelectedTimeRange(range)}
              className={`px-3 py-1 rounded-md text-sm font-medium ${
                selectedTimeRange === range
                  ? 'bg-blue-100 text-blue-700'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {range}
            </button>
          ))}
        </div>
      </div>

      {/* User Metrics */}
      <div>
        <h3 className="text-lg font-semibold text-gray-900 mb-4">User Metrics</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          <Card className="p-4">
            <div className="text-2xl font-bold text-blue-600">{analytics.userMetrics.totalUsers.toLocaleString()}</div>
            <div className="text-sm text-gray-600">Total Users</div>
          </Card>
          <Card className="p-4">
            <div className="text-2xl font-bold text-green-600">{analytics.userMetrics.activeUsers.toLocaleString()}</div>
            <div className="text-sm text-gray-600">Active Users</div>
          </Card>
          <Card className="p-4">
            <div className="text-2xl font-bold text-purple-600">+{analytics.userMetrics.newUsersToday}</div>
            <div className="text-sm text-gray-600">New Today</div>
          </Card>
          <Card className="p-4">
            <div className="text-2xl font-bold text-orange-600">{formatPercentage(analytics.userMetrics.retentionRate)}</div>
            <div className="text-sm text-gray-600">Retention Rate</div>
          </Card>
          <Card className="p-4">
            <div className="text-2xl font-bold text-indigo-600">{formatTime(analytics.userMetrics.averageSessionTime)}</div>
            <div className="text-sm text-gray-600">Avg Session</div>
          </Card>
        </div>
      </div>

      {/* Engagement Metrics */}
      <div>
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Engagement Metrics</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          <Card className="p-4">
            <div className="text-2xl font-bold text-blue-600">{analytics.engagementMetrics.dailyActiveUsers.toLocaleString()}</div>
            <div className="text-sm text-gray-600">Daily Active</div>
          </Card>
          <Card className="p-4">
            <div className="text-2xl font-bold text-green-600">{analytics.engagementMetrics.weeklyActiveUsers.toLocaleString()}</div>
            <div className="text-sm text-gray-600">Weekly Active</div>
          </Card>
          <Card className="p-4">
            <div className="text-2xl font-bold text-purple-600">{analytics.engagementMetrics.monthlyActiveUsers.toLocaleString()}</div>
            <div className="text-sm text-gray-600">Monthly Active</div>
          </Card>
          <Card className="p-4">
            <div className="text-2xl font-bold text-orange-600">{analytics.engagementMetrics.averageTransactionsPerUser.toFixed(1)}</div>
            <div className="text-sm text-gray-600">Avg Transactions</div>
          </Card>
          <Card className="p-4">
            <div className="text-2xl font-bold text-indigo-600">{formatPercentage(analytics.engagementMetrics.achievementUnlockRate)}</div>
            <div className="text-sm text-gray-600">Achievement Rate</div>
          </Card>
        </div>
      </div>

      {/* Financial Metrics */}
      <div>
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Financial Metrics</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          <Card className="p-4">
            <div className="text-2xl font-bold text-green-600">{formatCurrency(analytics.financialMetrics.totalSavings)}</div>
            <div className="text-sm text-gray-600">Total Savings</div>
          </Card>
          <Card className="p-4">
            <div className="text-2xl font-bold text-blue-600">{formatCurrency(analytics.financialMetrics.averageSavingsPerUser)}</div>
            <div className="text-sm text-gray-600">Avg per User</div>
          </Card>
          <Card className="p-4">
            <div className="text-2xl font-bold text-purple-600">{analytics.financialMetrics.totalTransactions.toLocaleString()}</div>
            <div className="text-sm text-gray-600">Total Transactions</div>
          </Card>
          <Card className="p-4">
            <div className="text-2xl font-bold text-orange-600">{formatCurrency(analytics.financialMetrics.averageTransactionAmount)}</div>
            <div className="text-sm text-gray-600">Avg Transaction</div>
          </Card>
          <Card className="p-4">
            <div className="text-2xl font-bold text-indigo-600">{formatCurrency(analytics.financialMetrics.yieldGenerated)}</div>
            <div className="text-sm text-gray-600">Yield Generated</div>
          </Card>
        </div>
      </div>

      {/* Social Metrics */}
      <div>
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Social Metrics</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          <Card className="p-4">
            <div className="text-2xl font-bold text-blue-600">{analytics.socialMetrics.totalChallenges}</div>
            <div className="text-sm text-gray-600">Total Challenges</div>
          </Card>
          <Card className="p-4">
            <div className="text-2xl font-bold text-green-600">{analytics.socialMetrics.activeChallenges}</div>
            <div className="text-sm text-gray-600">Active Challenges</div>
          </Card>
          <Card className="p-4">
            <div className="text-2xl font-bold text-purple-600">{formatPercentage(analytics.socialMetrics.challengeParticipationRate)}</div>
            <div className="text-sm text-gray-600">Participation Rate</div>
          </Card>
          <Card className="p-4">
            <div className="text-2xl font-bold text-orange-600">{analytics.socialMetrics.averageFriendsPerUser.toFixed(1)}</div>
            <div className="text-sm text-gray-600">Avg Friends</div>
          </Card>
          <Card className="p-4">
            <div className="text-2xl font-bold text-indigo-600">{formatPercentage(analytics.socialMetrics.socialShareRate)}</div>
            <div className="text-sm text-gray-600">Share Rate</div>
          </Card>
        </div>
      </div>

      {/* Technical Metrics */}
      <div>
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Technical Metrics</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          <Card className="p-4">
            <div className="text-2xl font-bold text-green-600">{analytics.technicalMetrics.apiResponseTime}ms</div>
            <div className="text-sm text-gray-600">API Response</div>
          </Card>
          <Card className="p-4">
            <div className="text-2xl font-bold text-red-600">{formatPercentage(analytics.technicalMetrics.errorRate)}</div>
            <div className="text-sm text-gray-600">Error Rate</div>
          </Card>
          <Card className="p-4">
            <div className="text-2xl font-bold text-green-600">{formatPercentage(analytics.technicalMetrics.uptime)}</div>
            <div className="text-sm text-gray-600">Uptime</div>
          </Card>
          <Card className="p-4">
            <div className="flex items-center">
              <Badge className={
                analytics.technicalMetrics.blockchainSyncStatus === 'synced' 
                  ? 'bg-green-100 text-green-800' 
                  : 'bg-yellow-100 text-yellow-800'
              }>
                {analytics.technicalMetrics.blockchainSyncStatus}
              </Badge>
            </div>
            <div className="text-sm text-gray-600">Blockchain Status</div>
          </Card>
          <Card className="p-4">
            <div className="text-2xl font-bold text-blue-600">{formatPercentage(analytics.technicalMetrics.cacheHitRate)}</div>
            <div className="text-sm text-gray-600">Cache Hit Rate</div>
          </Card>
        </div>
      </div>

      {/* Time Series Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">User Growth</h3>
          <div className="h-64 flex items-end justify-between space-x-1">
            {analytics.timeSeriesData.userGrowth.map((point, index) => (
              <div key={index} className="flex-1 flex flex-col items-center">
                <div 
                  className="bg-blue-500 w-full rounded-t"
                  style={{ 
                    height: `${(point.users / Math.max(...analytics.timeSeriesData.userGrowth.map(p => p.users))) * 200}px` 
                  }}
                ></div>
                <div className="text-xs text-gray-500 mt-1 transform -rotate-45">
                  {new Date(point.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                </div>
              </div>
            ))}
          </div>
        </Card>

        <Card className="p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Savings Growth</h3>
          <div className="h-64 flex items-end justify-between space-x-1">
            {analytics.timeSeriesData.savingsGrowth.map((point, index) => (
              <div key={index} className="flex-1 flex flex-col items-center">
                <div 
                  className="bg-green-500 w-full rounded-t"
                  style={{ 
                    height: `${(point.amount / Math.max(...analytics.timeSeriesData.savingsGrowth.map(p => p.amount))) * 200}px` 
                  }}
                ></div>
                <div className="text-xs text-gray-500 mt-1 transform -rotate-45">
                  {new Date(point.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                </div>
              </div>
            ))}
          </div>
        </Card>

        <Card className="p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Transaction Volume</h3>
          <div className="h-64 flex items-end justify-between space-x-1">
            {analytics.timeSeriesData.transactionVolume.map((point, index) => (
              <div key={index} className="flex-1 flex flex-col items-center">
                <div 
                  className="bg-purple-500 w-full rounded-t"
                  style={{ 
                    height: `${(point.count / Math.max(...analytics.timeSeriesData.transactionVolume.map(p => p.count))) * 200}px` 
                  }}
                ></div>
                <div className="text-xs text-gray-500 mt-1 transform -rotate-45">
                  {new Date(point.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                </div>
              </div>
            ))}
          </div>
        </Card>

        <Card className="p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Engagement Trend</h3>
          <div className="h-64 flex items-end justify-between space-x-1">
            {analytics.timeSeriesData.engagementTrend.map((point, index) => (
              <div key={index} className="flex-1 flex flex-col items-center">
                <div 
                  className="bg-orange-500 w-full rounded-t"
                  style={{ 
                    height: `${(point.engagement / Math.max(...analytics.timeSeriesData.engagementTrend.map(p => p.engagement))) * 200}px` 
                  }}
                ></div>
                <div className="text-xs text-gray-500 mt-1 transform -rotate-45">
                  {new Date(point.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* Key Insights */}
      <Card className="p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Key Insights</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <div className="bg-blue-50 p-4 rounded-lg">
            <h4 className="font-semibold text-blue-900">User Engagement</h4>
            <p className="text-sm text-blue-700 mt-1">
              {analytics.userMetrics.retentionRate > 0.7 
                ? "Excellent retention rate indicates strong product-market fit"
                : "Retention rate needs improvement - consider engagement features"
              }
            </p>
          </div>
          <div className="bg-green-50 p-4 rounded-lg">
            <h4 className="font-semibold text-green-900">Financial Growth</h4>
            <p className="text-sm text-green-700 mt-1">
              Average savings per user of {formatCurrency(analytics.financialMetrics.averageSavingsPerUser)} shows healthy platform adoption
            </p>
          </div>
          <div className="bg-purple-50 p-4 rounded-lg">
            <h4 className="font-semibold text-purple-900">Social Features</h4>
            <p className="text-sm text-purple-700 mt-1">
              {analytics.socialMetrics.challengeParticipationRate > 0.5
                ? "High challenge participation drives community engagement"
                : "Consider promoting social features to increase participation"
              }
            </p>
          </div>
        </div>
      </Card>
    </div>
  );
};

export default AnalyticsDashboard;