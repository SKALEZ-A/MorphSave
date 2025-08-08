import { prisma } from '../db/prisma';
import { EmailService } from './EmailService';
import { PushNotificationService } from './PushNotificationService';
import { wsIntegration } from '../websocket/integration';

export interface NotificationData {
  userId: string;
  type: 'achievement' | 'challenge' | 'friend' | 'transaction' | 'system' | 'savings_milestone';
  title: string;
  message: string;
  data?: Record<string, any>;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  channels: ('in_app' | 'push' | 'email')[];
  scheduledFor?: Date;
  expiresAt?: Date;
}

export interface NotificationPreferences {
  userId: string;
  achievements: {
    inApp: boolean;
    push: boolean;
    email: boolean;
  };
  challenges: {
    inApp: boolean;
    push: boolean;
    email: boolean;
  };
  friends: {
    inApp: boolean;
    push: boolean;
    email: boolean;
  };
  transactions: {
    inApp: boolean;
    push: boolean;
    email: boolean;
  };
  savingsMilestones: {
    inApp: boolean;
    push: boolean;
    email: boolean;
  };
  system: {
    inApp: boolean;
    push: boolean;
    email: boolean;
  };
  quietHours: {
    enabled: boolean;
    startTime: string; // HH:MM format
    endTime: string;   // HH:MM format
    timezone: string;
  };
  frequency: {
    digest: 'never' | 'daily' | 'weekly';
    immediate: boolean;
  };
}

export class NotificationService {
  private emailService: EmailService;
  private pushService: PushNotificationService;

  constructor() {
    this.emailService = new EmailService();
    this.pushService = new PushNotificationService();
  }

  /**
   * Send a notification through specified channels
   */
  async sendNotification(notificationData: NotificationData): Promise<void> {
    try {
      // Get user preferences
      const preferences = await this.getUserPreferences(notificationData.userId);
      
      // Check if user wants this type of notification
      const typePrefs = this.getTypePreferences(preferences, notificationData.type);
      
      // Filter channels based on user preferences
      const allowedChannels = notificationData.channels.filter(channel => {
        switch (channel) {
          case 'in_app':
            return typePrefs.inApp;
          case 'push':
            return typePrefs.push && !this.isInQuietHours(preferences);
          case 'email':
            return typePrefs.email;
          default:
            return false;
        }
      });

      if (allowedChannels.length === 0) {
        console.log(`No allowed channels for notification to user ${notificationData.userId}`);
        return;
      }

      // Create notification record
      const notification = await prisma.notification.create({
        data: {
          userId: notificationData.userId,
          type: notificationData.type,
          title: notificationData.title,
          message: notificationData.message,
          data: notificationData.data || {},
          priority: notificationData.priority,
          channels: allowedChannels,
          scheduledFor: notificationData.scheduledFor || new Date(),
          expiresAt: notificationData.expiresAt,
          status: notificationData.scheduledFor ? 'scheduled' : 'sent',
          read: false
        }
      });

      // Send through each allowed channel
      const sendPromises = allowedChannels.map(async (channel) => {
        try {
          switch (channel) {
            case 'in_app':
              await this.sendInAppNotification(notification);
              break;
            case 'push':
              await this.sendPushNotification(notification);
              break;
            case 'email':
              await this.sendEmailNotification(notification);
              break;
          }
        } catch (error) {
          console.error(`Failed to send ${channel} notification:`, error);
          // Update notification status to indicate partial failure
          await prisma.notification.update({
            where: { id: notification.id },
            data: {
              status: 'partial_failure',
              error: `${channel} delivery failed: ${error instanceof Error ? error.message : 'Unknown error'}`
            }
          });
        }
      });

      await Promise.allSettled(sendPromises);

    } catch (error) {
      console.error('Failed to send notification:', error);
      throw error;
    }
  }

  /**
   * Send in-app notification via WebSocket
   */
  private async sendInAppNotification(notification: any): Promise<void> {
    const notificationData = {
      id: notification.id,
      type: notification.type,
      title: notification.title,
      message: notification.message,
      data: notification.data,
      createdAt: notification.createdAt,
      read: notification.read
    };

    wsIntegration.broadcastNotification(notification.userId, notificationData);
  }

  /**
   * Send push notification
   */
  private async sendPushNotification(notification: any): Promise<void> {
    await this.pushService.sendNotification({
      userId: notification.userId,
      title: notification.title,
      body: notification.message,
      data: notification.data,
      priority: notification.priority
    });
  }

  /**
   * Send email notification
   */
  private async sendEmailNotification(notification: any): Promise<void> {
    const user = await prisma.user.findUnique({
      where: { id: notification.userId },
      select: { email: true, username: true }
    });

    if (!user) {
      throw new Error('User not found');
    }

    await this.emailService.sendNotificationEmail({
      to: user.email,
      username: user.username,
      type: notification.type,
      title: notification.title,
      message: notification.message,
      data: notification.data
    });
  }

  /**
   * Get user notification preferences
   */
  async getUserPreferences(userId: string): Promise<NotificationPreferences> {
    const prefs = await prisma.notificationPreference.findUnique({
      where: { userId }
    });

    if (!prefs) {
      // Return default preferences
      return this.getDefaultPreferences(userId);
    }

    return {
      userId,
      achievements: prefs.achievements as any,
      challenges: prefs.challenges as any,
      friends: prefs.friends as any,
      transactions: prefs.transactions as any,
      savingsMilestones: prefs.savingsMilestones as any,
      system: prefs.system as any,
      quietHours: prefs.quietHours as any,
      frequency: prefs.frequency as any
    };
  }

  /**
   * Update user notification preferences
   */
  async updateUserPreferences(userId: string, preferences: Partial<NotificationPreferences>): Promise<void> {
    await prisma.notificationPreference.upsert({
      where: { userId },
      update: {
        achievements: preferences.achievements,
        challenges: preferences.challenges,
        friends: preferences.friends,
        transactions: preferences.transactions,
        savingsMilestones: preferences.savingsMilestones,
        system: preferences.system,
        quietHours: preferences.quietHours,
        frequency: preferences.frequency,
        updatedAt: new Date()
      },
      create: {
        userId,
        achievements: preferences.achievements || { inApp: true, push: true, email: false },
        challenges: preferences.challenges || { inApp: true, push: true, email: true },
        friends: preferences.friends || { inApp: true, push: true, email: false },
        transactions: preferences.transactions || { inApp: true, push: false, email: false },
        savingsMilestones: preferences.savingsMilestones || { inApp: true, push: true, email: true },
        system: preferences.system || { inApp: true, push: false, email: true },
        quietHours: preferences.quietHours || { enabled: false, startTime: '22:00', endTime: '08:00', timezone: 'UTC' },
        frequency: preferences.frequency || { digest: 'weekly', immediate: true }
      }
    });
  }

  /**
   * Mark notification as read
   */
  async markAsRead(notificationId: string, userId: string): Promise<void> {
    await prisma.notification.updateMany({
      where: {
        id: notificationId,
        userId
      },
      data: {
        read: true,
        readAt: new Date()
      }
    });
  }

  /**
   * Mark all notifications as read for a user
   */
  async markAllAsRead(userId: string): Promise<void> {
    await prisma.notification.updateMany({
      where: {
        userId,
        read: false
      },
      data: {
        read: true,
        readAt: new Date()
      }
    });
  }

  /**
   * Get user notifications with pagination
   */
  async getUserNotifications(
    userId: string, 
    options: {
      page?: number;
      limit?: number;
      type?: string;
      unreadOnly?: boolean;
    } = {}
  ): Promise<{ notifications: any[]; total: number; unreadCount: number }> {
    const { page = 1, limit = 20, type, unreadOnly = false } = options;
    const skip = (page - 1) * limit;

    const where = {
      userId,
      ...(type && { type }),
      ...(unreadOnly && { read: false }),
      expiresAt: {
        OR: [
          { equals: null },
          { gt: new Date() }
        ]
      }
    };

    const [notifications, total, unreadCount] = await Promise.all([
      prisma.notification.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit
      }),
      prisma.notification.count({ where }),
      prisma.notification.count({
        where: {
          userId,
          read: false,
          expiresAt: {
            OR: [
              { equals: null },
              { gt: new Date() }
            ]
          }
        }
      })
    ]);

    return { notifications, total, unreadCount };
  }

  /**
   * Delete old notifications
   */
  async cleanupOldNotifications(olderThanDays: number = 30): Promise<void> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - olderThanDays);

    await prisma.notification.deleteMany({
      where: {
        OR: [
          { createdAt: { lt: cutoffDate } },
          { expiresAt: { lt: new Date() } }
        ]
      }
    });
  }

  /**
   * Send scheduled notifications
   */
  async processScheduledNotifications(): Promise<void> {
    const scheduledNotifications = await prisma.notification.findMany({
      where: {
        status: 'scheduled',
        scheduledFor: { lte: new Date() }
      }
    });

    for (const notification of scheduledNotifications) {
      try {
        // Re-send the notification
        await this.sendNotification({
          userId: notification.userId,
          type: notification.type as any,
          title: notification.title,
          message: notification.message,
          data: notification.data as any,
          priority: notification.priority as any,
          channels: notification.channels as any
        });

        // Update status
        await prisma.notification.update({
          where: { id: notification.id },
          data: { status: 'sent' }
        });
      } catch (error) {
        console.error(`Failed to send scheduled notification ${notification.id}:`, error);
        await prisma.notification.update({
          where: { id: notification.id },
          data: { 
            status: 'failed',
            error: error instanceof Error ? error.message : 'Unknown error'
          }
        });
      }
    }
  }

  // Helper methods
  private getDefaultPreferences(userId: string): NotificationPreferences {
    return {
      userId,
      achievements: { inApp: true, push: true, email: false },
      challenges: { inApp: true, push: true, email: true },
      friends: { inApp: true, push: true, email: false },
      transactions: { inApp: true, push: false, email: false },
      savingsMilestones: { inApp: true, push: true, email: true },
      system: { inApp: true, push: false, email: true },
      quietHours: { enabled: false, startTime: '22:00', endTime: '08:00', timezone: 'UTC' },
      frequency: { digest: 'weekly', immediate: true }
    };
  }

  private getTypePreferences(preferences: NotificationPreferences, type: string) {
    switch (type) {
      case 'achievement':
        return preferences.achievements;
      case 'challenge':
        return preferences.challenges;
      case 'friend':
        return preferences.friends;
      case 'transaction':
        return preferences.transactions;
      case 'savings_milestone':
        return preferences.savingsMilestones;
      case 'system':
        return preferences.system;
      default:
        return { inApp: true, push: false, email: false };
    }
  }

  private isInQuietHours(preferences: NotificationPreferences): boolean {
    if (!preferences.quietHours.enabled) {
      return false;
    }

    const now = new Date();
    const currentTime = now.toLocaleTimeString('en-US', { 
      hour12: false, 
      hour: '2-digit', 
      minute: '2-digit',
      timeZone: preferences.quietHours.timezone 
    });

    const startTime = preferences.quietHours.startTime;
    const endTime = preferences.quietHours.endTime;

    // Handle overnight quiet hours (e.g., 22:00 to 08:00)
    if (startTime > endTime) {
      return currentTime >= startTime || currentTime <= endTime;
    } else {
      return currentTime >= startTime && currentTime <= endTime;
    }
  }
}

// Export singleton instance
export const notificationService = new NotificationService();