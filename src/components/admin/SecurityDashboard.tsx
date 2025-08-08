'use client';

import React, { useState, useEffect } from 'react';
import { Shield, AlertTriangle, Activity, Users, Clock, TrendingUp } from 'lucide-react';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';

interface SecurityMetrics {
  totalRequests: number;
  errorRate: number;
  averageResponseTime: number;
  topIps: Array<{ ip: string; requests: number; errors: number }>;
  recentIncidents: Array<{ type: string; count: number }>;
  activeAlerts: Array<{
    id: string;
    type: string;
    severity: 'low' | 'medium' | 'high' | 'critical';
    message: string;
    timestamp: Date;
  }>;
}

export const SecurityDashboard: React.FC = () => {
  const [metrics, setMetrics] = useState<SecurityMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [timeRange, setTimeRange] = useState(3600000); // 1 hour

  useEffect(() => {
    loadSecurityMetrics();
    const interval = setInterval(loadSecurityMetrics, 30000); // Refresh every 30 seconds
    return () => clearInterval(interval);
  }, [timeRange]);

  const loadSecurityMetrics = async () => {
    try {
      const response = await fetch(`/api/security/metrics?timeRange=${timeRange}`);
      const result = await response.json();

      if (result.success) {
        setMetrics(result.data);
      }
    } catch (error) {
      console.error('Failed to load security metrics:', error);
    } finally {
      setLoading(false);
    }
  };

  const resolveAlert = async (alertId: string) => {
    try {
      const response = await fetch(`/api/security/alerts/${alertId}/resolve`, {
        method: 'PUT'
      });

      if (response.ok) {
        // Refresh metrics to update alerts
        await loadSecurityMetrics();
      }
    } catch (error) {
      console.error('Failed to resolve alert:', error);
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical':
        return 'bg-red-500 text-white';
      case 'high':
        return 'bg-orange-500 text-white';
      case 'medium':
        return 'bg-yellow-500 text-black';
      case 'low':
        return 'bg-blue-500 text-white';
      default:
        return 'bg-gray-500 text-white';
    }
  };

  const formatNumber = (num: number) => {
    return new Intl.NumberFormat().format(num);
  };

  const formatTime = (date: Date) => {
    return new Intl.DateTimeFormat('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    }).format(new Date(date));
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
        Failed to load security metrics
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center">
            <Shield className="w-8 h-8 mr-3 text-blue-600" />
            Security Dashboard
          </h1>
          <p className="text-gray-600 mt-2">
            Monitor security metrics, alerts, and system health
          </p>
        </div>
        
        <div className="flex items-center space-x-4">
          <select
            value={timeRange}
            onChange={(e) => setTimeRange(parseInt(e.target.value))}
            className="px-3 py-2 border border-gray-300 rounded-md"
          >
            <option value={3600000}>Last Hour</option>
            <option value={86400000}>Last 24 Hours</option>
            <option value={604800000}>Last Week</option>
          </select>
          <Button onClick={loadSecurityMetrics} size="sm">
            Refresh
          </Button>
        </div>
      </div>

      {/* Active Alerts */}
      {metrics.activeAlerts.length > 0 && (
        <Card className="p-6 border-red-200 bg-red-50">
          <h2 className="text-xl font-semibold mb-4 flex items-center text-red-700">
            <AlertTriangle className="w-5 h-5 mr-2" />
            Active Security Alerts ({metrics.activeAlerts.length})
          </h2>
          <div className="space-y-3">
            {metrics.activeAlerts.map((alert) => (
              <div key={alert.id} className="flex items-center justify-between p-3 bg-white rounded-lg border">
                <div className="flex items-center space-x-3">
                  <Badge className={getSeverityColor(alert.severity)}>
                    {alert.severity.toUpperCase()}
                  </Badge>
                  <div>
                    <p className="font-medium">{alert.message}</p>
                    <p className="text-sm text-gray-600">
                      {alert.type} • {formatTime(alert.timestamp)}
                    </p>
                  </div>
                </div>
                <Button
                  onClick={() => resolveAlert(alert.id)}
                  size="sm"
                  variant="outline"
                >
                  Resolve
                </Button>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Metrics Overview */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Total Requests</p>
              <p className="text-2xl font-bold text-blue-600">
                {formatNumber(metrics.totalRequests)}
              </p>
            </div>
            <Activity className="w-8 h-8 text-blue-600" />
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Error Rate</p>
              <p className={`text-2xl font-bold ${
                metrics.errorRate > 10 ? 'text-red-600' : 
                metrics.errorRate > 5 ? 'text-yellow-600' : 'text-green-600'
              }`}>
                {metrics.errorRate.toFixed(1)}%
              </p>
            </div>
            <TrendingUp className="w-8 h-8 text-gray-600" />
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Avg Response Time</p>
              <p className={`text-2xl font-bold ${
                metrics.averageResponseTime > 1000 ? 'text-red-600' : 
                metrics.averageResponseTime > 500 ? 'text-yellow-600' : 'text-green-600'
              }`}>
                {Math.round(metrics.averageResponseTime)}ms
              </p>
            </div>
            <Clock className="w-8 h-8 text-gray-600" />
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Active Alerts</p>
              <p className={`text-2xl font-bold ${
                metrics.activeAlerts.length > 0 ? 'text-red-600' : 'text-green-600'
              }`}>
                {metrics.activeAlerts.length}
              </p>
            </div>
            <AlertTriangle className="w-8 h-8 text-gray-600" />
          </div>
        </Card>
      </div>

      {/* Top IPs */}
      <Card className="p-6">
        <h2 className="text-xl font-semibold mb-4 flex items-center">
          <Users className="w-5 h-5 mr-2" />
          Top IP Addresses
        </h2>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b">
                <th className="text-left py-2">IP Address</th>
                <th className="text-left py-2">Requests</th>
                <th className="text-left py-2">Errors</th>
                <th className="text-left py-2">Error Rate</th>
                <th className="text-left py-2">Status</th>
              </tr>
            </thead>
            <tbody>
              {metrics.topIps.map((ip, index) => {
                const errorRate = ip.requests > 0 ? (ip.errors / ip.requests) * 100 : 0;
                return (
                  <tr key={index} className="border-b">
                    <td className="py-2 font-mono">{ip.ip}</td>
                    <td className="py-2">{formatNumber(ip.requests)}</td>
                    <td className="py-2">{formatNumber(ip.errors)}</td>
                    <td className="py-2">
                      <span className={`font-medium ${
                        errorRate > 20 ? 'text-red-600' : 
                        errorRate > 10 ? 'text-yellow-600' : 'text-green-600'
                      }`}>
                        {errorRate.toFixed(1)}%
                      </span>
                    </td>
                    <td className="py-2">
                      <Badge variant={errorRate > 20 ? 'destructive' : 'default'}>
                        {errorRate > 20 ? 'Suspicious' : 'Normal'}
                      </Badge>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Recent Incidents */}
      <Card className="p-6">
        <h2 className="text-xl font-semibold mb-4">Recent Security Incidents</h2>
        {metrics.recentIncidents.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {metrics.recentIncidents.map((incident, index) => (
              <div key={index} className="p-4 bg-gray-50 rounded-lg">
                <div className="flex items-center justify-between">
                  <h3 className="font-medium capitalize">
                    {incident.type.replace(/_/g, ' ')}
                  </h3>
                  <Badge variant="outline">
                    {incident.count}
                  </Badge>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-gray-500 text-center py-4">
            No recent security incidents
          </p>
        )}
      </Card>
    </div>
  );
};