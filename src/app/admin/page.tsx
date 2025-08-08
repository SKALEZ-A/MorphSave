'use client';

import React, { useState, useEffect } from 'react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { MonitoringDashboard } from '@/components/admin/MonitoringDashboard';
import { SecurityDashboard } from '@/components/admin/SecurityDashboard';

interface AdminStats {
  totalUsers: number;
  activeUsers: number;
  totalSavings: number;
  totalTransactions: number;
  activeChallenges: number;
  achievementsUnlocked: number;
  systemHealth: 'healthy' | 'warning' | 'critical';
  lastUpdated: string;
}

interface DemoControl {
  id: string;
  name: string;
  description: string;
  action: string;
  status: 'ready' | 'running' | 'completed' | 'error';
}

const AdminDashboard: React.FC = () => {
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [activeTab, setActiveTab] = useState<'overview' | 'demo' | 'monitoring' | 'security'>('overview');
  const [demoControls, setDemoControls] = useState<DemoControl[]>([
    {
      id: 'create-demo-data',
      name: 'Create Demo Data',
      description: 'Generate demo users and scenarios for presentation',
      action: 'create-demo-data',
      status: 'ready'
    },
    {
      id: 'simulate-transactions',
      name: 'Simulate Live Transactions',
      description: 'Generate real-time transaction activity for demo',
      action: 'simulate-transactions',
      status: 'ready'
    },
    {
      id: 'trigger-achievements',
      name: 'Trigger Achievement Unlocks',
      description: 'Simulate achievement unlocks for demo users',
      action: 'trigger-achievements',
      status: 'ready'
    },
    {
      id: 'update-leaderboards',
      name: 'Update Leaderboards',
      description: 'Refresh challenge leaderboards with latest data',
      action: 'update-leaderboards',
      status: 'ready'
    },
    {
      id: 'generate-insights',
      name: 'Generate AI Insights',
      description: 'Create fresh AI insights for demo accounts',
      action: 'generate-insights',
      status: 'ready'
    }
  ]);

  useEffect(() => {
    fetchAdminStats();
    const interval = setInterval(fetchAdminStats, 30000); // Update every 30 seconds
    return () => clearInterval(interval);
  }, []);

  const fetchAdminStats = async () => {
    try {
      const response = await fetch('/api/admin/stats');
      if (response.ok) {
        const data = await response.json();
        setStats(data);
      }
    } catch (error) {
      console.error('Failed to fetch admin stats:', error);
    }
  };

  const executeDemoAction = async (controlId: string, action: string) => {
    setDemoControls(prev => 
      prev.map(control => 
        control.id === controlId 
          ? { ...control, status: 'running' }
          : control
      )
    );

    try {
      const response = await fetch(`/api/admin/demo/${action}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });

      if (response.ok) {
        setDemoControls(prev => 
          prev.map(control => 
            control.id === controlId 
              ? { ...control, status: 'completed' }
              : control
          )
        );
        
        // Refresh stats after demo action
        setTimeout(fetchAdminStats, 1000);
      } else {
        throw new Error('Demo action failed');
      }
    } catch (error) {
      console.error(`Failed to execute ${action}:`, error);
      setDemoControls(prev => 
        prev.map(control => 
          control.id === controlId 
            ? { ...control, status: 'error' }
            : control
        )
      );
    }
  };

  const resetDemoData = async () => {
    if (!confirm('Are you sure you want to reset all demo data? This action cannot be undone.')) {
      return;
    }

    try {
      const response = await fetch('/api/admin/demo/reset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });

      if (response.ok) {
        alert('Demo data reset successfully');
        fetchAdminStats();
        setDemoControls(prev => 
          prev.map(control => ({ ...control, status: 'ready' }))
        );
      }
    } catch (error) {
      console.error('Failed to reset demo data:', error);
      alert('Failed to reset demo data');
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'ready': return 'bg-gray-100 text-gray-800';
      case 'running': return 'bg-blue-100 text-blue-800';
      case 'completed': return 'bg-green-100 text-green-800';
      case 'error': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getHealthColor = (health: string) => {
    switch (health) {
      case 'healthy': return 'text-green-600';
      case 'warning': return 'text-yellow-600';
      case 'critical': return 'text-red-600';
      default: return 'text-gray-600';
    }
  };

  if (!stats) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading admin dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-6">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">MorphSave Admin</h1>
              <p className="text-gray-600">Hackathon Demo Control Center</p>
            </div>
            <div className="flex items-center space-x-4">
              <Badge className={getHealthColor(stats.systemHealth)}>
                System {stats.systemHealth}
              </Badge>
              <span className="text-sm text-gray-500">
                Last updated: {new Date(stats.lastUpdated).toLocaleTimeString()}
              </span>
            </div>
          </div>
          
          <nav className="flex space-x-8">
            {[
              { id: 'overview', label: 'Overview' },
              { id: 'demo', label: 'Demo Controls' },
              { id: 'monitoring', label: 'Monitoring' },
              { id: 'security', label: 'Security' }
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`py-2 px-1 border-b-2 font-medium text-sm ${
                  activeTab === tab.id
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </nav>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {activeTab === 'overview' && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <Card className="p-6">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                      <span className="text-blue-600 font-semibold">👥</span>
                    </div>
                  </div>
                  <div className="ml-4">
                    <p className="text-sm font-medium text-gray-600">Total Users</p>
                    <p className="text-2xl font-bold text-gray-900">{stats.totalUsers.toLocaleString()}</p>
                  </div>
                </div>
              </Card>

              <Card className="p-6">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center">
                      <span className="text-green-600 font-semibold">💰</span>
                    </div>
                  </div>
                  <div className="ml-4">
                    <p className="text-sm font-medium text-gray-600">Total Savings</p>
                    <p className="text-2xl font-bold text-gray-900">${stats.totalSavings.toLocaleString()}</p>
                  </div>
                </div>
              </Card>

              <Card className="p-6">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <div className="w-8 h-8 bg-purple-100 rounded-full flex items-center justify-center">
                      <span className="text-purple-600 font-semibold">🎯</span>
                    </div>
                  </div>
                  <div className="ml-4">
                    <p className="text-sm font-medium text-gray-600">Active Challenges</p>
                    <p className="text-2xl font-bold text-gray-900">{stats.activeChallenges}</p>
                  </div>
                </div>
              </Card>

              <Card className="p-6">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <div className="w-8 h-8 bg-yellow-100 rounded-full flex items-center justify-center">
                      <span className="text-yellow-600 font-semibold">🏆</span>
                    </div>
                  </div>
                  <div className="ml-4">
                    <p className="text-sm font-medium text-gray-600">Achievements</p>
                    <p className="text-2xl font-bold text-gray-900">{stats.achievementsUnlocked}</p>
                  </div>
                </div>
              </Card>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card className="p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Recent Activity</h3>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-600">New user registrations</span>
                    <span className="text-sm font-medium text-gray-900">+12 today</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-600">Transactions processed</span>
                    <span className="text-sm font-medium text-gray-900">+{stats.totalTransactions} total</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-600">Challenges completed</span>
                    <span className="text-sm font-medium text-gray-900">+3 this week</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-600">Active users (24h)</span>
                    <span className="text-sm font-medium text-gray-900">{stats.activeUsers}</span>
                  </div>
                </div>
              </Card>

              <Card className="p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">System Status</h3>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-600">API Response Time</span>
                    <Badge className="bg-green-100 text-green-800">142ms avg</Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-600">Database Performance</span>
                    <Badge className="bg-green-100 text-green-800">Optimal</Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-600">Blockchain Sync</span>
                    <Badge className="bg-green-100 text-green-800">Synced</Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-600">External APIs</span>
                    <Badge className="bg-green-100 text-green-800">All Online</Badge>
                  </div>
                </div>
              </Card>
            </div>
          </div>
        )}

        {activeTab === 'demo' && (
          <div className="space-y-6">
            <div className="flex justify-between items-center">
              <div>
                <h2 className="text-2xl font-bold text-gray-900">Demo Controls</h2>
                <p className="text-gray-600">Manage demo data and scenarios for hackathon presentation</p>
              </div>
              <Button
                onClick={resetDemoData}
                className="bg-red-600 hover:bg-red-700 text-white"
              >
                Reset All Demo Data
              </Button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {demoControls.map((control) => (
                <Card key={control.id} className="p-6">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <h3 className="text-lg font-semibold text-gray-900">{control.name}</h3>
                      <p className="text-sm text-gray-600 mt-1">{control.description}</p>
                    </div>
                    <Badge className={getStatusColor(control.status)}>
                      {control.status}
                    </Badge>
                  </div>
                  <div className="mt-4">
                    <Button
                      onClick={() => executeDemoAction(control.id, control.action)}
                      disabled={control.status === 'running'}
                      className="w-full"
                    >
                      {control.status === 'running' ? 'Running...' : 'Execute'}
                    </Button>
                  </div>
                </Card>
              ))}
            </div>

            <Card className="p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Demo User Accounts</h3>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Username
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Email
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Scenario
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Level
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Total Saved
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    <tr>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">SarahSaver</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">sarah.saver@demo.com</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">Power User</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">15</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">$2,847.50</td>
                    </tr>
                    <tr>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">MikeNewbie</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">mike.newbie@demo.com</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">New User</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">2</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">$23.75</td>
                    </tr>
                    <tr>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">AlexSocial</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">alex.social@demo.com</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">Social Leader</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">8</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">$1,156.25</td>
                    </tr>
                    <tr>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">EmmaConsistent</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">emma.consistent@demo.com</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">Steady Saver</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">12</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">$3,421.80</td>
                    </tr>
                  </tbody>
                </table>
              </div>
              <div className="mt-4 text-sm text-gray-600">
                <p><strong>Password for all demo accounts:</strong> Demo123!</p>
              </div>
            </Card>
          </div>
        )}

        {activeTab === 'monitoring' && <MonitoringDashboard />}
        {activeTab === 'security' && <SecurityDashboard />}
      </div>
    </div>
  );
};

export default AdminDashboard;