import { prisma } from '../db/prisma';

export interface PushNotificationData {
  userId: string;
  title: string;
  body: string;
  data?: Record<string, any>;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  icon?: string;
  badge?: number;
  sound?: string;
  clickAction?: string;
}

export interface PushSubscription {
  userId: string;
  endpoint: string;
  keys: {
    p256dh: string;
    auth: string;
  };
  userAgent?: string;
  deviceType?: 'mobile' | 'desktop' | 'tablet';
}

export class PushNotificationService {
  private vapidKeys: {
    publicKey: string;
    privateKey: string;
    subject: string;
  };

  constructor() {
    this.vapidKeys = {
      publicKey: process.env.VAPID_PUBLIC_KEY || '',
      privateKey: process.env.VAPID_PRIVATE_KEY || '',
      subject: process.env.VAPID_SUBJECT || 'mailto:support@morphsave.com'
    };
  }

  /**
   * Send push notification to a user
   */
  async sendNotification(data: PushNotificationData): Promise<void> {
    try {
      // Get user's push subscriptions
      const subscriptions = await this.getUserSubscriptions(data.userId);

      if (subscriptions.length === 0) {
        console.log(`No push subscriptions found for user ${data.userId}`);
        return;
      }

      // Send to all user's devices
      const sendPromises = subscriptions.map(subscription => 
        this.sendToSubscription(subscription, data)
      );

      const results = await Promise.allSettled(sendPromises);
      
      // Log results and clean up failed subscriptions
      results.forEach((result, index) => {
        if (result.status === 'rejected') {
          console.error(`Failed to send push notification to subscription ${index}:`, result.reason);
          // Remove invalid subscription
          this.removeSubscription(subscriptions[index].endpoint);
        }
      });

    } catch (error) {
      console.error('Failed to send push notification:', error);
      throw error;
    }
  }

  /**
   * Send notification to specific subscription
   */
  private async sendToSubscription(subscription: any, data: PushNotificationData): Promise<void> {
    const webpush = await import('web-push');
    
    webpush.setVapidDetails(
      this.vapidKeys.subject,
      this.vapidKeys.publicKey,
      this.vapidKeys.privateKey
    );

    const payload = JSON.stringify({
      title: data.title,
      body: data.body,
      icon: data.icon || '/icons/icon-192x192.png',
      badge: data.badge || '/icons/badge-72x72.png',
      data: {
        ...data.data,
        clickAction: data.clickAction || '/',
        timestamp: Date.now()
      },
      actions: this.getNotificationActions(data),
      requireInteraction: data.priority === 'urgent',
      silent: data.priority === 'low'
    });

    const options = {
      TTL: this.getTTL(data.priority),
      urgency: this.getUrgency(data.priority),
      headers: {}
    };

    await webpush.sendNotification(
      {
        endpoint: subscription.endpoint,
        keys: subscription.keys
      },
      payload,
      options
    );
  }

  /**
   * Subscribe user to push notifications
   */
  async subscribe(subscriptionData: PushSubscription): Promise<void> {
    try {
      await prisma.pushSubscription.upsert({
        where: {
          userId_endpoint: {
            userId: subscriptionData.userId,
            endpoint: subscriptionData.endpoint
          }
        },
        update: {
          keys: subscriptionData.keys,
          userAgent: subscriptionData.userAgent,
          deviceType: subscriptionData.deviceType,
          updatedAt: new Date()
        },
        create: {
          userId: subscriptionData.userId,
          endpoint: subscriptionData.endpoint,
          keys: subscriptionData.keys,
          userAgent: subscriptionData.userAgent,
          deviceType: subscriptionData.deviceType,
          isActive: true
        }
      });

      console.log(`Push subscription added for user ${subscriptionData.userId}`);
    } catch (error) {
      console.error('Failed to save push subscription:', error);
      throw error;
    }
  }

  /**
   * Unsubscribe user from push notifications
   */
  async unsubscribe(userId: string, endpoint: string): Promise<void> {
    try {
      await prisma.pushSubscription.updateMany({
        where: {
          userId,
          endpoint
        },
        data: {
          isActive: false,
          updatedAt: new Date()
        }
      });

      console.log(`Push subscription removed for user ${userId}`);
    } catch (error) {
      console.error('Failed to remove push subscription:', error);
      throw error;
    }
  }

  /**
   * Get user's active push subscriptions
   */
  private async getUserSubscriptions(userId: string): Promise<any[]> {
    return await prisma.pushSubscription.findMany({
      where: {
        userId,
        isActive: true
      }
    });
  }

  /**
   * Remove invalid subscription
   */
  private async removeSubscription(endpoint: string): Promise<void> {
    try {
      await prisma.pushSubscription.updateMany({
        where: { endpoint },
        data: { isActive: false }
      });
    } catch (error) {
      console.error('Failed to remove invalid subscription:', error);
    }
  }

  /**
   * Send bulk notifications
   */
  async sendBulkNotifications(notifications: PushNotificationData[]): Promise<void> {
    const batchSize = 100;
    
    for (let i = 0; i < notifications.length; i += batchSize) {
      const batch = notifications.slice(i, i + batchSize);
      const promises = batch.map(notification => this.sendNotification(notification));
      
      await Promise.allSettled(promises);
      
      // Add delay between batches to avoid rate limiting
      if (i + batchSize < notifications.length) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
  }

  /**
   * Send notification to all users (admin only)
   */
  async sendBroadcast(
    title: string, 
    body: string, 
    data?: Record<string, any>,
    userFilter?: { level?: number; hasActiveChallenge?: boolean }
  ): Promise<void> {
    try {
      let userQuery: any = {
        isActive: true,
        pushSubscriptions: {
          some: { isActive: true }
        }
      };

      // Apply filters
      if (userFilter?.level) {
        userQuery.level = { gte: userFilter.level };
      }

      if (userFilter?.hasActiveChallenge) {
        userQuery.challengeParticipants = {
          some: {
            challenge: {
              status: 'active',
              endDate: { gt: new Date() }
            }
          }
        };
      }

      const users = await prisma.user.findMany({
        where: userQuery,
        select: { id: true }
      });

      const notifications = users.map(user => ({
        userId: user.id,
        title,
        body,
        data,
        priority: 'medium' as const
      }));

      await this.sendBulkNotifications(notifications);
      console.log(`Broadcast sent to ${users.length} users`);
    } catch (error) {
      console.error('Failed to send broadcast notification:', error);
      throw error;
    }
  }

  /**
   * Get VAPID public key for client-side subscription
   */
  getVapidPublicKey(): string {
    return this.vapidKeys.publicKey;
  }

  /**
   * Test push notification
   */
  async sendTestNotification(userId: string): Promise<void> {
    await this.sendNotification({
      userId,
      title: 'MorphSave Test Notification',
      body: 'This is a test notification from MorphSave!',
      priority: 'medium',
      data: { test: true }
    });
  }

  /**
   * Get notification actions based on type
   */
  private getNotificationActions(data: PushNotificationData): any[] {
    const actions = [];

    // Add common actions
    actions.push({
      action: 'view',
      title: 'View',
      icon: '/icons/view.png'
    });

    // Add type-specific actions
    if (data.data?.type === 'challenge') {
      actions.push({
        action: 'join_challenge',
        title: 'Join',
        icon: '/icons/join.png'
      });
    }

    if (data.data?.type === 'friend') {
      actions.push({
        action: 'accept_friend',
        title: 'Accept',
        icon: '/icons/accept.png'
      });
    }

    return actions.slice(0, 2); // Limit to 2 actions
  }

  /**
   * Get TTL based on priority
   */
  private getTTL(priority: string): number {
    switch (priority) {
      case 'urgent':
        return 3600; // 1 hour
      case 'high':
        return 7200; // 2 hours
      case 'medium':
        return 86400; // 24 hours
      case 'low':
        return 604800; // 7 days
      default:
        return 86400;
    }
  }

  /**
   * Get urgency based on priority
   */
  private getUrgency(priority: string): 'very-low' | 'low' | 'normal' | 'high' {
    switch (priority) {
      case 'urgent':
        return 'high';
      case 'high':
        return 'high';
      case 'medium':
        return 'normal';
      case 'low':
        return 'low';
      default:
        return 'normal';
    }
  }

  /**
   * Clean up old subscriptions
   */
  async cleanupOldSubscriptions(olderThanDays: number = 90): Promise<void> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - olderThanDays);

    await prisma.pushSubscription.deleteMany({
      where: {
        OR: [
          { updatedAt: { lt: cutoffDate } },
          { isActive: false }
        ]
      }
    });
  }

  /**
   * Get subscription statistics
   */
  async getSubscriptionStats(): Promise<{
    total: number;
    active: number;
    byDevice: Record<string, number>;
  }> {
    const [total, active, byDevice] = await Promise.all([
      prisma.pushSubscription.count(),
      prisma.pushSubscription.count({ where: { isActive: true } }),
      prisma.pushSubscription.groupBy({
        by: ['deviceType'],
        where: { isActive: true },
        _count: true
      })
    ]);

    const deviceStats = byDevice.reduce((acc, item) => {
      acc[item.deviceType || 'unknown'] = item._count;
      return acc;
    }, {} as Record<string, number>);

    return {
      total,
      active,
      byDevice: deviceStats
    };
  }
}