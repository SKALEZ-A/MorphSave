import { prisma } from './prisma';
import { Notification, NotificationType, Prisma } from '@prisma/client';

export interface CreateNotificationInput {
  userId: string;
  type: NotificationType;
  title: string;
  message: string;
  data?: any;
}

export interface NotificationFilters {
  type?: NotificationType;
  read?: boolean;
  dateFrom?: Date;
  dateTo?: Date;
}

export interface NotificationStats {
  total: number;
  unread: number;
  byType: Record<NotificationType, number>;
  recentActivity: number; // Last 24 hours
}

/**
 * Create a new notification
 */
export async function createNotification(
  input: CreateNotificationInput
): Promise<Notification> {
  return prisma.notification.create({
    data: {
      userId: input.userId,
      type: input.type,
      title: input.title,
      message: input.message,
      data: input.data || {}
    }
  });
}

/**
 * Create bulk notifications
 */
export async function createBulkNotifications(
  notifications: CreateNotificationInput[]
): Promise<number> {
  const result = await prisma.notification.createMany({
    data: notifications.map(notif => ({
      userId: notif.userId,
      type: notif.type,
      title: notif.title,
      message: notif.message,
      data: notif.data || {}
    }))
  });

  return result.count;
}

/**
 * Get user notifications with pagination
 */
export async function getUserNotifications(
  userId: string,
  filters: NotificationFilters = {},
  page: number = 1,
  limit: number = 20
): Promise<{
  notifications: Notification[];
  total: number;
  unread: number;
  hasMore: boolean;
}> {
  const where: Prisma.NotificationWhereInput = {
    userId,
    ...(filters.type && { type: filters.type }),
    ...(filters.read !== undefined && { read: filters.read }),
    ...(filters.dateFrom || filters.dateTo) && {
      createdAt: {
        ...(filters.dateFrom && { gte: filters.dateFrom }),
        ...(filters.dateTo && { lte: filters.dateTo })
      }
    }
  };

  const [notifications, total, unread] = await Promise.all([
    prisma.notification.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit
    }),
    prisma.notification.count({ where }),
    prisma.notification.count({
      where: { userId, read: false }
    })
  ]);

  return {
    notifications,
    total,
    unread,
    hasMore: total > page * limit
  };
}

/**
 * Mark notification as read
 */
export async function markNotificationAsRead(
  notificationId: string,
  userId: string
): Promise<Notification> {
  return prisma.notification.update({
    where: {
      id: notificationId,
      userId // Ensure user owns the notification
    },
    data: { read: true }
  });
}

/**
 * Mark all notifications as read for user
 */
export async function markAllNotificationsAsRead(userId: string): Promise<number> {
  const result = await prisma.notification.updateMany({
    where: {
      userId,
      read: false
    },
    data: { read: true }
  });

  return result.count;
}

/**
 * Mark notifications as read by type
 */
export async function markNotificationsByTypeAsRead(
  userId: string,
  type: NotificationType
): Promise<number> {
  const result = await prisma.notification.updateMany({
    where: {
      userId,
      type,
      read: false
    },
    data: { read: true }
  });

  return result.count;
}

/**
 * Delete notification
 */
export async function deleteNotification(
  notificationId: string,
  userId: string
): Promise<Notification> {
  return prisma.notification.delete({
    where: {
      id: notificationId,
      userId
    }
  });
}

/**
 * Delete all notifications for user
 */
export async function deleteAllUserNotifications(userId: string): Promise<number> {
  const result = await prisma.notification.deleteMany({
    where: { userId }
  });

  return result.count;
}

/**
 * Delete old notifications (cleanup)
 */
export async function deleteOldNotifications(olderThanDays: number = 30): Promise<number> {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - olderThanDays);

  const result = await prisma.notification.deleteMany({
    where: {
      createdAt: { lt: cutoffDate },
      read: true // Only delete read notifications
    }
  });

  return result.count;
}

/**
 * Get notification statistics for user
 */
export async function getUserNotificationStats(userId: string): Promise<NotificationStats> {
  const [total, unread, byType, recentActivity] = await Promise.all([
    prisma.notification.count({ where: { userId } }),
    prisma.notification.count({ where: { userId, read: false } }),
    
    prisma.notification.groupBy({
      by: ['type'],
      where: { userId },
      _count: { id: true }
    }),
    
    prisma.notification.count({
      where: {
        userId,
        createdAt: {
          gte: new Date(Date.now() - 24 * 60 * 60 * 1000) // Last 24 hours
        }
      }
    })
  ]);

  const byTypeMap = byType.reduce((acc, item) => {
    acc[item.type] = item._count.id;
    return acc;
  }, {} as Record<NotificationType, number>);

  return {
    total,
    unread,
    byType: byTypeMap,
    recentActivity
  };
}

/**
 * Get unread notification count
 */
export async function getUnreadNotificationCount(userId: string): Promise<number> {
  return prisma.notification.count({
    where: {
      userId,
      read: false
    }
  });
}

/**
 * Create achievement notification
 */
export async function createAchievementNotification(
  userId: string,
  achievementName: string,
  pointsEarned: number
): Promise<Notification> {
  return createNotification({
    userId,
    type: NotificationType.ACHIEVEMENT,
    title: 'Achievement Unlocked! 🏆',
    message: `Congratulations! You've unlocked "${achievementName}" and earned ${pointsEarned} points!`,
    data: {
      achievementName,
      pointsEarned
    }
  });
}

/**
 * Create savings milestone notification
 */
export async function createSavingsMilestoneNotification(
  userId: string,
  milestone: number,
  totalSaved: number
): Promise<Notification> {
  return createNotification({
    userId,
    type: NotificationType.SAVINGS,
    title: `Savings Milestone Reached! 💰`,
    message: `Amazing! You've saved $${milestone}! Your total savings is now $${totalSaved.toFixed(2)}.`,
    data: {
      milestone,
      totalSaved
    }
  });
}

/**
 * Create challenge notification
 */
export async function createChallengeNotification(
  userId: string,
  challengeTitle: string,
  notificationType: 'joined' | 'completed' | 'won' | 'new_participant',
  additionalData?: any
): Promise<Notification> {
  const messages = {
    joined: `You've joined the challenge "${challengeTitle}". Good luck!`,
    completed: `The challenge "${challengeTitle}" has ended. Check your results!`,
    won: `🎉 Congratulations! You won the challenge "${challengeTitle}"!`,
    new_participant: `Someone new joined your challenge "${challengeTitle}"`
  };

  return createNotification({
    userId,
    type: NotificationType.CHALLENGE,
    title: 'Challenge Update',
    message: messages[notificationType],
    data: {
      challengeTitle,
      notificationType,
      ...additionalData
    }
  });
}

/**
 * Create social notification
 */
export async function createSocialNotification(
  userId: string,
  fromUsername: string,
  notificationType: 'friend_request' | 'friend_accepted' | 'friend_activity',
  additionalData?: any
): Promise<Notification> {
  const messages = {
    friend_request: `${fromUsername} sent you a friend request`,
    friend_accepted: `${fromUsername} accepted your friend request`,
    friend_activity: `${fromUsername} ${additionalData?.activity || 'had some activity'}`
  };

  const titles = {
    friend_request: 'New Friend Request',
    friend_accepted: 'Friend Request Accepted',
    friend_activity: 'Friend Activity'
  };

  return createNotification({
    userId,
    type: NotificationType.SOCIAL,
    title: titles[notificationType],
    message: messages[notificationType],
    data: {
      fromUsername,
      notificationType,
      ...additionalData
    }
  });
}

/**
 * Create system notification
 */
export async function createSystemNotification(
  userId: string,
  title: string,
  message: string,
  additionalData?: any
): Promise<Notification> {
  return createNotification({
    userId,
    type: NotificationType.SYSTEM,
    title,
    message,
    data: additionalData
  });
}

/**
 * Create security notification
 */
export async function createSecurityNotification(
  userId: string,
  securityEvent: 'login' | 'password_change' | 'wallet_change' | 'suspicious_activity',
  additionalData?: any
): Promise<Notification> {
  const messages = {
    login: 'New login detected from a different device or location',
    password_change: 'Your password has been successfully changed',
    wallet_change: 'Your wallet address has been updated',
    suspicious_activity: 'Suspicious activity detected on your account'
  };

  const titles = {
    login: 'New Login Detected',
    password_change: 'Password Changed',
    wallet_change: 'Wallet Updated',
    suspicious_activity: 'Security Alert'
  };

  return createNotification({
    userId,
    type: NotificationType.SECURITY,
    title: titles[securityEvent],
    message: messages[securityEvent],
    data: {
      securityEvent,
      timestamp: new Date(),
      ...additionalData
    }
  });
}

/**
 * Send notification to multiple users
 */
export async function sendBulkNotification(
  userIds: string[],
  type: NotificationType,
  title: string,
  message: string,
  data?: any
): Promise<number> {
  const notifications = userIds.map(userId => ({
    userId,
    type,
    title,
    message,
    data: data || {}
  }));

  return createBulkNotifications(notifications);
}

/**
 * Get recent notifications for dashboard
 */
export async function getRecentNotifications(
  userId: string,
  limit: number = 5
): Promise<Notification[]> {
  return prisma.notification.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    take: limit
  });
}

/**
 * Get notification preferences (placeholder for future implementation)
 */
export async function getNotificationPreferences(userId: string) {
  // This would be implemented when user preferences are added
  return {
    achievements: true,
    challenges: true,
    savings: true,
    social: true,
    system: true,
    security: true,
    email: true,
    push: true
  };
}

/**
 * Update notification preferences (placeholder for future implementation)
 */
export async function updateNotificationPreferences(
  userId: string,
  preferences: Record<string, boolean>
) {
  // This would be implemented when user preferences are added
  return preferences;
}

/**
 * Get global notification statistics (admin)
 */
export async function getGlobalNotificationStats() {
  const [
    totalNotifications,
    unreadNotifications,
    notificationsByType,
    notificationsToday
  ] = await Promise.all([
    prisma.notification.count(),
    prisma.notification.count({ where: { read: false } }),
    
    prisma.notification.groupBy({
      by: ['type'],
      _count: { id: true }
    }),
    
    prisma.notification.count({
      where: {
        createdAt: {
          gte: new Date(new Date().setHours(0, 0, 0, 0))
        }
      }
    })
  ]);

  const byType = notificationsByType.reduce((acc, item) => {
    acc[item.type] = item._count.id;
    return acc;
  }, {} as Record<NotificationType, number>);

  return {
    totalNotifications,
    unreadNotifications,
    readRate: totalNotifications > 0 ? ((totalNotifications - unreadNotifications) / totalNotifications) * 100 : 0,
    byType,
    notificationsToday
  };
}