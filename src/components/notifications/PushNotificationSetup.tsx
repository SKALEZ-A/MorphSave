'use client';

import React, { useState, useEffect } from 'react';
import { Bell, BellOff, Smartphone, AlertCircle } from 'lucide-react';
import { Button } from '../ui/Button';
import { Card } from '../ui/Card';

interface PushNotificationSetupProps {
  onSubscriptionChange?: (subscribed: boolean) => void;
}

export const PushNotificationSetup: React.FC<PushNotificationSetupProps> = ({
  onSubscriptionChange
}) => {
  const [isSupported, setIsSupported] = useState(false);
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [permission, setPermission] = useState<NotificationPermission>('default');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    checkPushSupport();
    checkSubscriptionStatus();
  }, []);

  const checkPushSupport = () => {
    const supported = 'serviceWorker' in navigator && 'PushManager' in window;
    setIsSupported(supported);
    
    if (supported) {
      setPermission(Notification.permission);
    }
  };

  const checkSubscriptionStatus = async () => {
    if (!isSupported) return;

    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();
      setIsSubscribed(!!subscription);
    } catch (error) {
      console.error('Failed to check subscription status:', error);
    }
  };

  const requestPermission = async (): Promise<boolean> => {
    if (!isSupported) return false;

    try {
      const permission = await Notification.requestPermission();
      setPermission(permission);
      return permission === 'granted';
    } catch (error) {
      console.error('Failed to request notification permission:', error);
      return false;
    }
  };

  const subscribeToPush = async () => {
    if (!isSupported) {
      setError('Push notifications are not supported in this browser');
      return;
    }

    try {
      setLoading(true);
      setError(null);

      // Request permission if not granted
      if (permission !== 'granted') {
        const granted = await requestPermission();
        if (!granted) {
          setError('Notification permission denied');
          return;
        }
      }

      // Get VAPID public key
      const keyResponse = await fetch('/api/notifications/push/subscribe');
      const keyResult = await keyResponse.json();
      
      if (!keyResult.success) {
        throw new Error('Failed to get VAPID public key');
      }

      // Register service worker
      const registration = await navigator.serviceWorker.register('/sw.js');
      await navigator.serviceWorker.ready;

      // Subscribe to push notifications
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(keyResult.data.publicKey)
      });

      // Send subscription to server
      const subscribeResponse = await fetch('/api/notifications/push/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subscription: subscription.toJSON(),
          userAgent: navigator.userAgent,
          deviceType: getDeviceType()
        })
      });

      const subscribeResult = await subscribeResponse.json();
      
      if (subscribeResult.success) {
        setIsSubscribed(true);
        onSubscriptionChange?.(true);
      } else {
        throw new Error(subscribeResult.error || 'Failed to subscribe');
      }

    } catch (error) {
      console.error('Failed to subscribe to push notifications:', error);
      setError(error instanceof Error ? error.message : 'Failed to subscribe');
    } finally {
      setLoading(false);
    }
  };

  const unsubscribeFromPush = async () => {
    if (!isSupported) return;

    try {
      setLoading(true);
      setError(null);

      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();

      if (subscription) {
        // Unsubscribe from browser
        await subscription.unsubscribe();

        // Notify server
        await fetch('/api/notifications/push/unsubscribe', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            endpoint: subscription.endpoint
          })
        });
      }

      setIsSubscribed(false);
      onSubscriptionChange?.(false);

    } catch (error) {
      console.error('Failed to unsubscribe from push notifications:', error);
      setError(error instanceof Error ? error.message : 'Failed to unsubscribe');
    } finally {
      setLoading(false);
    }
  };

  const getDeviceType = (): 'mobile' | 'desktop' | 'tablet' => {
    const userAgent = navigator.userAgent.toLowerCase();
    
    if (/mobile|android|iphone|ipod|blackberry|iemobile|opera mini/i.test(userAgent)) {
      return 'mobile';
    } else if (/tablet|ipad/i.test(userAgent)) {
      return 'tablet';
    } else {
      return 'desktop';
    }
  };

  const urlBase64ToUint8Array = (base64String: string): Uint8Array => {
    const padding = '='.repeat((4 - base64String.length % 4) % 4);
    const base64 = (base64String + padding)
      .replace(/-/g, '+')
      .replace(/_/g, '/');

    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);

    for (let i = 0; i < rawData.length; ++i) {
      outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
  };

  if (!isSupported) {
    return (
      <Card className="p-6">
        <div className="flex items-center space-x-3 text-gray-500">
          <BellOff className="w-6 h-6" />
          <div>
            <h3 className="font-medium">Push Notifications Not Supported</h3>
            <p className="text-sm">Your browser doesn't support push notifications.</p>
          </div>
        </div>
      </Card>
    );
  }

  return (
    <Card className="p-6">
      <div className="flex items-start justify-between">
        <div className="flex items-center space-x-3">
          <div className={`p-2 rounded-full ${isSubscribed ? 'bg-green-100' : 'bg-gray-100'}`}>
            {isSubscribed ? (
              <Bell className="w-6 h-6 text-green-600" />
            ) : (
              <BellOff className="w-6 h-6 text-gray-600" />
            )}
          </div>
          <div>
            <h3 className="font-medium">Push Notifications</h3>
            <p className="text-sm text-gray-600">
              {isSubscribed 
                ? 'You\'ll receive push notifications for important updates'
                : 'Get notified instantly about achievements, challenges, and more'
              }
            </p>
            {permission === 'denied' && (
              <div className="flex items-center space-x-1 mt-2 text-amber-600">
                <AlertCircle className="w-4 h-4" />
                <span className="text-sm">
                  Notifications are blocked. Please enable them in your browser settings.
                </span>
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center space-x-2">
          {isSubscribed ? (
            <Button
              variant="outline"
              size="sm"
              onClick={unsubscribeFromPush}
              disabled={loading}
            >
              {loading ? 'Unsubscribing...' : 'Disable'}
            </Button>
          ) : (
            <Button
              onClick={subscribeToPush}
              disabled={loading || permission === 'denied'}
              size="sm"
            >
              <Smartphone className="w-4 h-4 mr-2" />
              {loading ? 'Enabling...' : 'Enable'}
            </Button>
          )}
        </div>
      </div>

      {error && (
        <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-md">
          <div className="flex items-center space-x-2 text-red-700">
            <AlertCircle className="w-4 h-4" />
            <span className="text-sm">{error}</span>
          </div>
        </div>
      )}

      {permission === 'default' && !isSubscribed && (
        <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-md">
          <p className="text-sm text-blue-700">
            Click "Enable" to allow push notifications. You can change this setting anytime.
          </p>
        </div>
      )}
    </Card>
  );
};