'use client';

import React, { useState, useEffect } from 'react';
import { Bell, Mail, Smartphone, Clock, Save } from 'lucide-react';
import { Button } from '../ui/Button';
import { Card } from '../ui/Card';
import { Input } from '../ui/Input';

interface NotificationPreferences {
  achievements: { inApp: boolean; push: boolean; email: boolean };
  challenges: { inApp: boolean; push: boolean; email: boolean };
  friends: { inApp: boolean; push: boolean; email: boolean };
  transactions: { inApp: boolean; push: boolean; email: boolean };
  savingsMilestones: { inApp: boolean; push: boolean; email: boolean };
  system: { inApp: boolean; push: boolean; email: boolean };
  quietHours: {
    enabled: boolean;
    startTime: string;
    endTime: string;
    timezone: string;
  };
  frequency: {
    digest: 'never' | 'daily' | 'weekly';
    immediate: boolean;
  };
}

export const NotificationPreferences: React.FC = () => {
  const [preferences, setPreferences] = useState<NotificationPreferences | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [pushSupported, setPushSupported] = useState(false);

  useEffect(() => {
    loadPreferences();
    checkPushSupport();
  }, []);

  const loadPreferences = async () => {
    try {
      const response = await fetch('/api/notifications/preferences');
      const result = await response.json();

      if (result.success) {
        setPreferences(result.data);
      }
    } catch (error) {
      console.error('Failed to load preferences:', error);
    } finally {
      setLoading(false);
    }
  };

  const checkPushSupport = () => {
    setPushSupported('serviceWorker' in navigator && 'PushManager' in window);
  };

  const savePreferences = async () => {
    if (!preferences) return;

    try {
      setSaving(true);
      const response = await fetch('/api/notifications/preferences', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(preferences)
      });

      if (response.ok) {
        // Show success message
        console.log('Preferences saved successfully');
      }
    } catch (error) {
      console.error('Failed to save preferences:', error);
    } finally {
      setSaving(false);
    }
  };

  const updateTypePreference = (
    type: keyof Omit<NotificationPreferences, 'quietHours' | 'frequency'>,
    channel: 'inApp' | 'push' | 'email',
    value: boolean
  ) => {
    if (!preferences) return;

    setPreferences(prev => ({
      ...prev!,
      [type]: {
        ...prev![type],
        [channel]: value
      }
    }));
  };

  const updateQuietHours = (field: keyof NotificationPreferences['quietHours'], value: any) => {
    if (!preferences) return;

    setPreferences(prev => ({
      ...prev!,
      quietHours: {
        ...prev!.quietHours,
        [field]: value
      }
    }));
  };

  const updateFrequency = (field: keyof NotificationPreferences['frequency'], value: any) => {
    if (!preferences) return;

    setPreferences(prev => ({
      ...prev!,
      frequency: {
        ...prev!.frequency,
        [field]: value
      }
    }));
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  if (!preferences) {
    return (
      <div className="text-center py-8 text-red-500">
        Failed to load notification preferences
      </div>
    );
  }

  const notificationTypes = [
    {
      key: 'achievements' as const,
      title: 'Achievements',
      description: 'When you unlock new achievements and milestones',
      icon: '🏆'
    },
    {
      key: 'challenges' as const,
      title: 'Challenges',
      description: 'Challenge invites, updates, and completions',
      icon: '🎯'
    },
    {
      key: 'friends' as const,
      title: 'Friends',
      description: 'Friend requests and social interactions',
      icon: '👥'
    },
    {
      key: 'transactions' as const,
      title: 'Transactions',
      description: 'Savings deposits, withdrawals, and yield updates',
      icon: '💰'
    },
    {
      key: 'savingsMilestones' as const,
      title: 'Savings Milestones',
      description: 'Important savings goals and milestones',
      icon: '🎉'
    },
    {
      key: 'system' as const,
      title: 'System',
      description: 'Important system updates and announcements',
      icon: '⚙️'
    }
  ];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold mb-2">Notification Preferences</h2>
        <p className="text-gray-600">
          Customize how and when you receive notifications from MorphSave.
        </p>
      </div>

      {/* Notification Types */}
      <Card className="p-6">
        <h3 className="text-lg font-semibold mb-4">Notification Types</h3>
        <div className="space-y-6">
          {notificationTypes.map((type) => (
            <div key={type.key} className="border-b border-gray-200 pb-4 last:border-b-0">
              <div className="flex items-start space-x-3 mb-3">
                <span className="text-2xl">{type.icon}</span>
                <div>
                  <h4 className="font-medium">{type.title}</h4>
                  <p className="text-sm text-gray-600">{type.description}</p>
                </div>
              </div>
              <div className="flex items-center space-x-6 ml-11">
                <label className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    checked={preferences[type.key].inApp}
                    onChange={(e) => updateTypePreference(type.key, 'inApp', e.target.checked)}
                    className="rounded border-gray-300"
                  />
                  <Bell className="w-4 h-4" />
                  <span className="text-sm">In-app</span>
                </label>
                <label className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    checked={preferences[type.key].push}
                    onChange={(e) => updateTypePreference(type.key, 'push', e.target.checked)}
                    disabled={!pushSupported}
                    className="rounded border-gray-300"
                  />
                  <Smartphone className="w-4 h-4" />
                  <span className="text-sm">Push</span>
                  {!pushSupported && (
                    <span className="text-xs text-gray-400">(Not supported)</span>
                  )}
                </label>
                <label className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    checked={preferences[type.key].email}
                    onChange={(e) => updateTypePreference(type.key, 'email', e.target.checked)}
                    className="rounded border-gray-300"
                  />
                  <Mail className="w-4 h-4" />
                  <span className="text-sm">Email</span>
                </label>
              </div>
            </div>
          ))}
        </div>
      </Card>

      {/* Quiet Hours */}
      <Card className="p-6">
        <h3 className="text-lg font-semibold mb-4 flex items-center">
          <Clock className="w-5 h-5 mr-2" />
          Quiet Hours
        </h3>
        <div className="space-y-4">
          <label className="flex items-center space-x-2">
            <input
              type="checkbox"
              checked={preferences.quietHours.enabled}
              onChange={(e) => updateQuietHours('enabled', e.target.checked)}
              className="rounded border-gray-300"
            />
            <span>Enable quiet hours (no push notifications during this time)</span>
          </label>
          
          {preferences.quietHours.enabled && (
            <div className="grid grid-cols-2 gap-4 ml-6">
              <div>
                <label className="block text-sm font-medium mb-1">Start Time</label>
                <Input
                  type="time"
                  value={preferences.quietHours.startTime}
                  onChange={(e) => updateQuietHours('startTime', e.target.value)}
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">End Time</label>
                <Input
                  type="time"
                  value={preferences.quietHours.endTime}
                  onChange={(e) => updateQuietHours('endTime', e.target.value)}
                />
              </div>
            </div>
          )}
        </div>
      </Card>

      {/* Frequency Settings */}
      <Card className="p-6">
        <h3 className="text-lg font-semibold mb-4">Frequency Settings</h3>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-2">Email Digest</label>
            <select
              value={preferences.frequency.digest}
              onChange={(e) => updateFrequency('digest', e.target.value)}
              className="w-full p-2 border border-gray-300 rounded-md"
            >
              <option value="never">Never</option>
              <option value="daily">Daily</option>
              <option value="weekly">Weekly</option>
            </select>
          </div>
          
          <label className="flex items-center space-x-2">
            <input
              type="checkbox"
              checked={preferences.frequency.immediate}
              onChange={(e) => updateFrequency('immediate', e.target.checked)}
              className="rounded border-gray-300"
            />
            <span>Receive immediate notifications for important events</span>
          </label>
        </div>
      </Card>

      {/* Save Button */}
      <div className="flex justify-end">
        <Button
          onClick={savePreferences}
          disabled={saving}
          className="flex items-center space-x-2"
        >
          <Save className="w-4 h-4" />
          <span>{saving ? 'Saving...' : 'Save Preferences'}</span>
        </Button>
      </div>
    </div>
  );
};