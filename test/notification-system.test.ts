import { NotificationService } from '../lib/notifications/NotificationService';
import { EmailService } from '../lib/notifications/EmailService';
import { PushNotificationService } from '../lib/notifications/PushNotificationService';
import { prisma } from '../lib/db/prisma';

// Mock dependencies
jest.mock('../lib/db/prisma', () => ({
  prisma: {
    notification: {
      create: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
      deleteMany: jest.fn()
    },
    notificationPreference: {
      findUnique: jest.fn(),
      upsert: jest.fn()
    },
    user: {
      findUnique: jest.fn()
    },
    pushSubscription: {
      findMany: jest.fn(),
      upsert: jest.fn(),
      updateMany: jest.fn(),
      deleteMany: jest.fn(),
      count: jest.fn(),
      groupBy: jest.fn()
    }
  }
}));

jest.mock('../lib/websocket/integration', () => ({
  wsIntegration: {
    broadcastNotification: jest.fn()
  }
}));

jest.mock('nodemailer', () => ({
  createTransporter: jest.fn(() => ({
    sendMail: jest.fn(),
    verify: jest.fn()
  }))
}));

describe('NotificationService', () => {
  let notificationService: NotificationService;
  let mockUser: any;

  beforeEach(() => {
    notificationService = new NotificationService();
    mockUser = {
      id: 'user-123',
      email: 'test@example.com',
      username: 'testuser'
    };

    jest.clearAllMocks();
  });

  describe('sendNotification', () => {
    it('should send notification through allowed channels', async () => {
      const mockPreferences = {
        userId: 'user-123',
        achievements: { inApp: true, push: true, email: false },
        quietHours: { enabled: false }
      };

      const mockNotification = {
        id: 'notification-123',
        userId: 'user-123',
        type: 'achievement',
        title: 'Test Achievement',
        message: 'You unlocked a test achievement!',
        createdAt: new Date()
      };

      (prisma.notificationPreference.findUnique as jest.Mock).mockResolvedValue(mockPreferences);
      (prisma.notification.create as jest.Mock).mockResolvedValue(mockNotification);

      await notificationService.sendNotification({
        userId: 'user-123',
        type: 'achievement',
        title: 'Test Achievement',
        message: 'You unlocked a test achievement!',
        priority: 'medium',
        channels: ['in_app', 'push', 'email']
      });

      expect(prisma.notification.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          userId: 'user-123',
          type: 'achievement',
          title: 'Test Achievement',
          message: 'You unlocked a test achievement!',
          priority: 'medium',
          channels: ['in_app', 'push'], // email filtered out by preferences
          status: 'sent'
        })
      });
    });

    it('should respect quiet hours for push notifications', async () => {
      const mockPreferences = {
        userId: 'user-123',
        achievements: { inApp: true, push: true, email: false },
        quietHours: { 
          enabled: true, 
          startTime: '22:00', 
          endTime: '08:00',
          timezone: 'UTC'
        }
      };

      (prisma.notificationPreference.findUnique as jest.Mock).mockResolvedValue(mockPreferences);
      
      // Mock current time to be within quiet hours
      const originalDate = Date;
      global.Date = jest.fn(() => ({
        toLocaleTimeString: () => '23:30'
      })) as any;

      await notificationService.sendNotification({
        userId: 'user-123',
        type: 'achievement',
        title: 'Test Achievement',
        message: 'You unlocked a test achievement!',
        priority: 'medium',
        channels: ['in_app', 'push']
      });

      expect(prisma.notification.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          channels: ['in_app'] // push filtered out due to quiet hours
        })
      });

      global.Date = originalDate;
    });

    it('should handle scheduled notifications', async () => {
      const futureDate = new Date(Date.now() + 3600000); // 1 hour from now
      
      await notificationService.sendNotification({
        userId: 'user-123',
        type: 'system',
        title: 'Scheduled Notification',
        message: 'This is a scheduled notification',
        priority: 'low',
        channels: ['in_app'],
        scheduledFor: futureDate
      });

      expect(prisma.notification.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          scheduledFor: futureDate,
          status: 'scheduled'
        })
      });
    });
  });

  describe('getUserNotifications', () => {
    it('should return paginated notifications', async () => {
      const mockNotifications = [
        { id: '1', title: 'Notification 1', read: false },
        { id: '2', title: 'Notification 2', read: true }
      ];

      (prisma.notification.findMany as jest.Mock).mockResolvedValue(mockNotifications);
      (prisma.notification.count as jest.Mock)
        .mockResolvedValueOnce(10) // total count
        .mockResolvedValueOnce(3); // unread count

      const result = await notificationService.getUserNotifications('user-123', {
        page: 1,
        limit: 20
      });

      expect(result).toEqual({
        notifications: mockNotifications,
        total: 10,
        unreadCount: 3
      });

      expect(prisma.notification.findMany).toHaveBeenCalledWith({
        where: expect.objectContaining({
          userId: 'user-123'
        }),
        orderBy: { createdAt: 'desc' },
        skip: 0,
        take: 20
      });
    });

    it('should filter by type when specified', async () => {
      await notificationService.getUserNotifications('user-123', {
        type: 'achievement'
      });

      expect(prisma.notification.findMany).toHaveBeenCalledWith({
        where: expect.objectContaining({
          userId: 'user-123',
          type: 'achievement'
        }),
        orderBy: { createdAt: 'desc' },
        skip: 0,
        take: 20
      });
    });
  });

  describe('markAsRead', () => {
    it('should mark notification as read', async () => {
      await notificationService.markAsRead('notification-123', 'user-123');

      expect(prisma.notification.updateMany).toHaveBeenCalledWith({
        where: {
          id: 'notification-123',
          userId: 'user-123'
        },
        data: {
          read: true,
          readAt: expect.any(Date)
        }
      });
    });
  });

  describe('markAllAsRead', () => {
    it('should mark all unread notifications as read', async () => {
      await notificationService.markAllAsRead('user-123');

      expect(prisma.notification.updateMany).toHaveBeenCalledWith({
        where: {
          userId: 'user-123',
          read: false
        },
        data: {
          read: true,
          readAt: expect.any(Date)
        }
      });
    });
  });

  describe('processScheduledNotifications', () => {
    it('should process and send scheduled notifications', async () => {
      const mockScheduledNotifications = [
        {
          id: 'scheduled-1',
          userId: 'user-123',
          type: 'system',
          title: 'Scheduled Notification',
          message: 'This was scheduled',
          data: {},
          priority: 'medium',
          channels: ['in_app'],
          status: 'scheduled'
        }
      ];

      (prisma.notification.findMany as jest.Mock).mockResolvedValue(mockScheduledNotifications);
      (prisma.notification.update as jest.Mock).mockResolvedValue({});

      await notificationService.processScheduledNotifications();

      expect(prisma.notification.findMany).toHaveBeenCalledWith({
        where: {
          status: 'scheduled',
          scheduledFor: { lte: expect.any(Date) }
        }
      });

      expect(prisma.notification.update).toHaveBeenCalledWith({
        where: { id: 'scheduled-1' },
        data: { status: 'sent' }
      });
    });
  });
});

describe('EmailService', () => {
  let emailService: EmailService;

  beforeEach(() => {
    emailService = new EmailService();
    jest.clearAllMocks();
  });

  describe('sendNotificationEmail', () => {
    it('should send achievement notification email', async () => {
      const mockTransporter = {
        sendMail: jest.fn().mockResolvedValue({}),
        verify: jest.fn().mockResolvedValue(true)
      };

      // Mock nodemailer
      const nodemailer = require('nodemailer');
      nodemailer.createTransporter.mockReturnValue(mockTransporter);

      await emailService.sendNotificationEmail({
        to: 'test@example.com',
        username: 'testuser',
        type: 'achievement',
        title: 'First Save Achievement',
        message: 'You made your first save!',
        data: { points: 10, icon: '🏆' }
      });

      expect(mockTransporter.sendMail).toHaveBeenCalledWith({
        from: expect.any(String),
        to: 'test@example.com',
        subject: '🏆 Achievement Unlocked: First Save Achievement',
        html: expect.stringContaining('You made your first save!'),
        text: expect.any(String)
      });
    });
  });

  describe('sendWelcomeEmail', () => {
    it('should send welcome email to new users', async () => {
      const mockTransporter = {
        sendMail: jest.fn().mockResolvedValue({}),
        verify: jest.fn().mockResolvedValue(true)
      };

      const nodemailer = require('nodemailer');
      nodemailer.createTransporter.mockReturnValue(mockTransporter);

      await emailService.sendWelcomeEmail('test@example.com', 'testuser');

      expect(mockTransporter.sendMail).toHaveBeenCalledWith({
        from: expect.any(String),
        to: 'test@example.com',
        subject: 'Welcome to MorphSave! 🎉',
        html: expect.stringContaining('Welcome to MorphSave'),
        text: expect.any(String)
      });
    });
  });
});

describe('PushNotificationService', () => {
  let pushService: PushNotificationService;

  beforeEach(() => {
    pushService = new PushNotificationService();
    jest.clearAllMocks();
  });

  describe('subscribe', () => {
    it('should save push subscription', async () => {
      const subscriptionData = {
        userId: 'user-123',
        endpoint: 'https://fcm.googleapis.com/fcm/send/test',
        keys: {
          p256dh: 'test-p256dh-key',
          auth: 'test-auth-key'
        },
        userAgent: 'Mozilla/5.0...',
        deviceType: 'desktop' as const
      };

      await pushService.subscribe(subscriptionData);

      expect(prisma.pushSubscription.upsert).toHaveBeenCalledWith({
        where: {
          userId_endpoint: {
            userId: 'user-123',
            endpoint: 'https://fcm.googleapis.com/fcm/send/test'
          }
        },
        update: expect.objectContaining({
          keys: subscriptionData.keys,
          userAgent: subscriptionData.userAgent,
          deviceType: subscriptionData.deviceType
        }),
        create: expect.objectContaining({
          userId: 'user-123',
          endpoint: 'https://fcm.googleapis.com/fcm/send/test',
          keys: subscriptionData.keys,
          isActive: true
        })
      });
    });
  });

  describe('unsubscribe', () => {
    it('should deactivate push subscription', async () => {
      await pushService.unsubscribe('user-123', 'https://fcm.googleapis.com/fcm/send/test');

      expect(prisma.pushSubscription.updateMany).toHaveBeenCalledWith({
        where: {
          userId: 'user-123',
          endpoint: 'https://fcm.googleapis.com/fcm/send/test'
        },
        data: {
          isActive: false,
          updatedAt: expect.any(Date)
        }
      });
    });
  });

  describe('sendBroadcast', () => {
    it('should send notification to all eligible users', async () => {
      const mockUsers = [
        { id: 'user-1' },
        { id: 'user-2' },
        { id: 'user-3' }
      ];

      (prisma.user.findMany as jest.Mock).mockResolvedValue(mockUsers);

      // Mock the sendNotification method
      const sendNotificationSpy = jest.spyOn(pushService, 'sendNotification').mockResolvedValue();

      await pushService.sendBroadcast(
        'System Update',
        'MorphSave has been updated with new features!',
        { version: '2.0.0' }
      );

      expect(prisma.user.findMany).toHaveBeenCalledWith({
        where: expect.objectContaining({
          isActive: true,
          pushSubscriptions: {
            some: { isActive: true }
          }
        }),
        select: { id: true }
      });

      expect(sendNotificationSpy).toHaveBeenCalledTimes(3);
    });
  });
});

describe('Integration Tests', () => {
  it('should handle complete notification flow', async () => {
    const notificationService = new NotificationService();
    
    // Mock all dependencies
    const mockPreferences = {
      userId: 'user-123',
      achievements: { inApp: true, push: true, email: true },
      quietHours: { enabled: false }
    };

    (prisma.notificationPreference.findUnique as jest.Mock).mockResolvedValue(mockPreferences);
    (prisma.notification.create as jest.Mock).mockResolvedValue({
      id: 'notification-123',
      userId: 'user-123',
      type: 'achievement',
      title: 'Test Achievement',
      message: 'You unlocked a test achievement!'
    });

    await notificationService.sendNotification({
      userId: 'user-123',
      type: 'achievement',
      title: 'Test Achievement',
      message: 'You unlocked a test achievement!',
      priority: 'medium',
      channels: ['in_app', 'push', 'email'],
      data: { points: 10 }
    });

    // Verify notification was created
    expect(prisma.notification.create).toHaveBeenCalled();
  });
});