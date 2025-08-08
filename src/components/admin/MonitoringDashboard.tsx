'use client';

import React, { useState, useEffect } from 'react';
import { 
  Activity, 
  Users, 
  TrendingUp, 
  AlertTriangle, 
  Clock, 
  Server,
  Zap,
  Eye,
  BarChart3,
  PieChart
} from 'lucide-react';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';

interface DashboardMetrics {
  userBehavior: {
    totalUsers: number;
    activeUsers: number;
    newUsers: number;
    averageSessionDuration: number;
    bounceRate: number;
    topPages: Array<{ page: string; views: number }>;
  };
  performance: {
    averageResponseTime: number;
    p95ResponseTime: number;
    errorRate: number;
    throughput: number;
    slowestEndpoints: Array<{ endpoint: string; averageTime: number }>;
  };
  business: {
    totalSavings: number;
    totalUsers: number;
    savingsGrowthRate: number;
    challengeParticipationRate: number;
  };
  errors: {
    totalErrors: number;
    uniqueErrors: number;
    errorRate: number;
    topErrors: Array<{ name: string; occurrences: number }>;
  };
  realtime: {
    activeUsers: number;
    currentRPS: number;
    averageResponseTime: number;
    errorRate: number;
  };
}

export const MonitoringDashboard: React.FC = () => {
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [timeRange, setTimeRange] = useState(86400000); // 24 hours
  const [activeTab, setActiveTab] = useState('overview');

  useEffect(() => {
    loadMetrics();
    const interval = setInterval(loadRealTimeMetrics, 30000); // Update real-time every 30s
    return () => clearInterval(interval);
  }, [timeRange]);

  const loadMetrics = async () => {
    try {
      setLoading(true);
      
      const [userBehavior, performance, business, errors] = await Promise.all([
        fetch(`/api/analytics/metrics?type=behavior&timeRange=${timeRange}`).then(r => r.json()),
        fetch(`/api/monitoring/performance?type=stats&timeRange=${timeRange}`).then(r => r.json()),
        fetch(`/api/analytics/metrics?type=business&timeRange=${timeRange}`).then(r => r.json()),
        fetch(`/api/monitoring/errors?timeRange=${timeRange}`).then(r => r.json())
      ]);

      const realtime = await loadRealTimeMetrics();

      setMetrics({
        userBehavior: userBehavior.data,
        performance: performance.data,
        business: business.data,
        errors: errors.data,
        realtime
      });
    } catch (error) {
      console.error('Failed to load metrics:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadRealTimeMetrics = async () => {
    try {
      const [analyticsRealtime, performanceRealtime] = await Promise.all([
        fetch('/api/analytics/metrics?type=realtime').then(r => r.json()),
        fetch('/api/monitoring/performance?type=realtime').then(r => r.json())
      ]);

      const realtime = {
        activeUsers: analyticsRealtime.data.activeUsers,
        currentRPS: performanceRealtime.data.currentRPS,
        averageResponseTime: performanceRealtime.data.averageResponseTime,
        errorRate: performanceRealtime.data.errorRate
      };

      if (metrics) {
        setMetrics(prev => ({ ...prev!, realtime }));
      }

      return realtime;
    } catch (error) {
      console.error('Failed to load real-time metrics:', error);
      return {
        activeUsers: 0,
        currentRPS: 0,
        averageResponseTime: 0,
        errorRate: 0
      };
    }
  };

  const formatNumber = (num: number) => {
    return new Intl.NumberFormat().format(num);
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount);
  };

  const formatDuration = (ms: number) => {
    if (ms < 1000) return `${Math.round(ms)}ms`;
    if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
    return `${(ms / 60000).toFixed(1)}m`;
  };

  const getHealthStatus = (errorRate: number, responseTime: number) => {
    if (errorRate > 5 || responseTime > 1000) return { status: 'critical', color: 'bg-red-500' };
    if (errorRate > 2 || responseTime > 500) return { status: 'warning', color: 'bg-yellow-500' };
    return { status: 'healthy', color: 'bg-green-500' };
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  if (!metrics) {
    return (
      <div className="text-center py-8 text-red-500">
        Failed to load monitoring metrics
      </div>
    );
  }

  const health = getHealthStatus(metrics.realtime.errorRate, metrics.realtime.averageResponseTime);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center">
            <Activity className="w-8 h-8 mr-3 text-blue-600" />
            Monitoring Dashboard
          </h1>
          <p className="text-gray-600 mt-2">
            Real-time application performance and user analytics
          </p>
        </div>
        
        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-2">
            <div className={`w-3 h-3 rounded-full ${health.color}`}></div>
            <span className="text-sm font-medium capitalize">{health.status}</span>
          </div>
          <select
            value={timeRange}
            onChange={(e) => setTimeRange(parseInt(e.target.value))}
            className="px-3 py-2 border border-gray-300 rounded-md"
          >
            <option value={3600000}>Last Hour</option>
            <option value={86400000}>Last 24 Hours</option>
            <option value={604800000}>Last Week</option>
            <option value={2592000000}>Last Month</option>
          </select>
          <Button onClick={loadMetrics} size="sm">
            Refresh
          </Button>
        </div>
      </div>

      {/* Real-time Overview */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Active Users</p>
              <p className="text-2xl font-bold text-blue-600">
                {formatNumber(metrics.realtime.activeUsers)}
              </p>
            </div>
            <Users className="w-8 h-8 text-blue-600" />
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Requests/sec</p>
              <p className="text-2xl font-bold text-green-600">
                {metrics.realtime.currentRPS.toFixed(1)}
              </p>
            </div>
            <Zap className="w-8 h-8 text-green-600" />
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Response Time</p>
              <p className={`text-2xl font-bold ${
                metrics.realtime.averageResponseTime > 1000 ? 'text-red-600' : 
                metrics.realtime.averageResponseTime > 500 ? 'text-yellow-600' : 'text-green-600'
              }`}>
                {Math.round(metrics.realtime.averageResponseTime)}ms
              </p>
            </div>
            <Clock className="w-8 h-8 text-gray-600" />
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Error Rate</p>
              <p className={`text-2xl font-bold ${
                metrics.realtime.errorRate > 5 ? 'text-red-600' : 
                metrics.realtime.errorRate > 2 ? 'text-yellow-600' : 'text-green-600'
              }`}>
                {metrics.realtime.errorRate.toFixed(1)}%
              </p>
            </div>
            <AlertTriangle className="w-8 h-8 text-gray-600" />
          </div>
        </Card>
      </div>

      {/* Navigation Tabs */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-8">
          {[
            { id: 'overview', name: 'Overview', icon: BarChart3 },
            { id: 'performance', name: 'Performance', icon: Server },
            { id: 'users', name: 'Users', icon: Users },
            { id: 'business', name: 'Business', icon: TrendingUp },
            { id: 'errors', name: 'Errors', icon: AlertTriangle }
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center py-2 px-1 border-b-2 font-medium text-sm ${
                activeTab === tab.id
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <tab.icon className="w-4 h-4 mr-2" />
              {tab.name}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab Content */}
      {activeTab === 'overview' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Performance Overview */}
          <Card className="p-6">
            <h3 className="text-lg font-semibold mb-4 flex items-center">
              <Server className="w-5 h-5 mr-2" />
              Performance Overview
            </h3>
            <div className="space-y-4">
              <div className="flex justify-between">
                <span>Average Response Time</span>
                <span className="font-medium">{Math.round(metrics.performance.averageResponseTime)}ms</span>
              </div>
              <div className="flex justify-between">
                <span>95th Percentile</span>
                <span className="font-medium">{Math.round(metrics.performance.p95ResponseTime)}ms</span>
              </div>
              <div className="flex justify-between">
                <span>Throughput</span>
                <span className="font-medium">{metrics.performance.throughput.toFixed(1)} req/s</span>
              </div>
              <div className="flex justify-between">
                <span>Error Rate</span>
                <span className={`font-medium ${
                  metrics.performance.errorRate > 5 ? 'text-red-600' : 'text-green-600'
                }`}>
                  {metrics.performance.errorRate.toFixed(2)}%
                </span>
              </div>
            </div>
          </Card>

          {/* User Overview */}
          <Card className="p-6">
            <h3 className="text-lg font-semibold mb-4 flex items-center">
              <Users className="w-5 h-5 mr-2" />
              User Overview
            </h3>
            <div className="space-y-4">
              <div className="flex justify-between">
                <span>Total Users</span>
                <span className="font-medium">{formatNumber(metrics.userBehavior.totalUsers)}</span>
              </div>
              <div className="flex justify-between">
                <span>Active Users</span>
                <span className="font-medium">{formatNumber(metrics.userBehavior.activeUsers)}</span>
              </div>
              <div className="flex justify-between">
                <span>New Users</span>
                <span className="font-medium">{formatNumber(metrics.userBehavior.newUsers)}</span>
              </div>
              <div className="flex justify-between">
                <span>Avg Session Duration</span>
                <span className="font-medium">{formatDuration(metrics.userBehavior.averageSessionDuration)}</span>
              </div>
            </div>
          </Card>
        </div>
      )}

      {activeTab === 'performance' && (
        <div className="space-y-6">
          {/* Slowest Endpoints */}
          <Card className="p-6">
            <h3 className="text-lg font-semibold mb-4">Slowest Endpoints</h3>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-2">Endpoint</th>
                    <th className="text-left py-2">Average Time</th>
                    <th className="text-left py-2">Requests</th>
                    <th className="text-left py-2">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {metrics.performance.slowestEndpoints.map((endpoint, index) => (
                    <tr key={index} className="border-b">
                      <td className="py-2 font-mono text-sm">{endpoint.endpoint}</td>
                      <td className="py-2">{Math.round(endpoint.averageTime)}ms</td>
                      <td className="py-2">{formatNumber(endpoint.count)}</td>
                      <td className="py-2">
                        <Badge variant={endpoint.averageTime > 1000 ? 'destructive' : 'default'}>
                          {endpoint.averageTime > 1000 ? 'Slow' : 'Normal'}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      )}

      {activeTab === 'users' && (
        <div className="space-y-6">
          {/* Top Pages */}
          <Card className="p-6">
            <h3 className="text-lg font-semibold mb-4">Top Pages</h3>
            <div className="space-y-3">
              {metrics.userBehavior.topPages.map((page, index) => (
                <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <span className="font-mono text-sm">{page.page}</span>
                  <div className="flex items-center space-x-2">
                    <Eye className="w-4 h-4 text-gray-500" />
                    <span className="font-medium">{formatNumber(page.views)}</span>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </div>
      )}

      {activeTab === 'business' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card className="p-6">
            <h3 className="text-lg font-semibold mb-4">Financial Metrics</h3>
            <div className="space-y-4">
              <div className="flex justify-between">
                <span>Total Savings</span>
                <span className="font-medium text-green-600">
                  {formatCurrency(metrics.business.totalSavings)}
                </span>
              </div>
              <div className="flex justify-between">
                <span>Growth Rate</span>
                <span className={`font-medium ${
                  metrics.business.savingsGrowthRate > 0 ? 'text-green-600' : 'text-red-600'
                }`}>
                  {metrics.business.savingsGrowthRate > 0 ? '+' : ''}
                  {metrics.business.savingsGrowthRate.toFixed(1)}%
                </span>
              </div>
            </div>
          </Card>

          <Card className="p-6">
            <h3 className="text-lg font-semibold mb-4">Engagement Metrics</h3>
            <div className="space-y-4">
              <div className="flex justify-between">
                <span>Challenge Participation</span>
                <span className="font-medium">
                  {metrics.business.challengeParticipationRate.toFixed(1)}%
                </span>
              </div>
              <div className="flex justify-between">
                <span>Total Users</span>
                <span className="font-medium">{formatNumber(metrics.business.totalUsers)}</span>
              </div>
            </div>
          </Card>
        </div>
      )}

      {activeTab === 'errors' && (
        <div className="space-y-6">
          {/* Error Overview */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Card className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Total Errors</p>
                  <p className="text-2xl font-bold text-red-600">
                    {formatNumber(metrics.errors.totalErrors)}
                  </p>
                </div>
                <AlertTriangle className="w-8 h-8 text-red-600" />
              </div>
            </Card>

            <Card className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Unique Errors</p>
                  <p className="text-2xl font-bold text-orange-600">
                    {formatNumber(metrics.errors.uniqueErrors)}
                  </p>
                </div>
                <PieChart className="w-8 h-8 text-orange-600" />
              </div>
            </Card>

            <Card className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Error Rate</p>
                  <p className="text-2xl font-bold text-yellow-600">
                    {metrics.errors.errorRate.toFixed(2)}%
                  </p>
                </div>
                <TrendingUp className="w-8 h-8 text-yellow-600" />
              </div>
            </Card>
          </div>

          {/* Top Errors */}
          <Card className="p-6">
            <h3 className="text-lg font-semibold mb-4">Top Errors</h3>
            <div className="space-y-3">
              {metrics.errors.topErrors.map((error, index) => (
                <div key={index} className="flex items-center justify-between p-3 bg-red-50 rounded-lg border border-red-200">
                  <div>
                    <p className="font-medium text-red-800">{error.name}</p>
                    <p className="text-sm text-red-600">
                      {error.occurrences} occurrence{error.occurrences !== 1 ? 's' : ''}
                    </p>
                  </div>
                  <Badge variant="destructive">
                    {error.occurrences}
                  </Badge>
                </div>
              ))}
            </div>
          </Card>
        </div>
      )}
    </div>
  );
};