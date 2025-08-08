#!/usr/bin/env tsx

/**
 * Scheduled notification processor
 * This script should be run periodically (e.g., every minute) to process scheduled notifications
 * and send digest emails.
 */

import { notificationService } from '../lib/notifications/NotificationService';
import { EmailService } from '../lib/notifications/EmailService';
import { prisma } from '../lib/db/prisma';

const emailService = new EmailService();

async function processScheduledNotifications() {
  console.log('Processing scheduled notifications...');
  
  try {
    await notificationService.processScheduledNotifications();
    console.log('Scheduled notifications processed successfully');
  } catch (error) {
    console.error('Failed to process scheduled notifications:', error);
  }
}

async function sendDigestEmails() {
  console.log('Processing digest emails...');
  
  try {
    const now = new Date();
    const currentHour = now.getHours();
    const currentDay = now.getDay(); // 0 = Sunday, 1 = Monday, etc.

    // Send daily digests at 8 AM
    if (currentHour === 8) {
      await sendDailyDigests();
    }

    // Send weekly digests on Monday at 9 AM
    if (currentDay === 1 && currentHour === 9) {
      await sendWeeklyDigests();
    }

    console.log('Digest emails processed successfully');
  } catch (error) {
    console.error('Failed to process digest emails:', error);
  }
}

async function sendDailyDigests() {
  console.log('Sending daily digest emails...');

  const users = await prisma.user.findMany({
    where: {
      isActive: true,
      notificationPreferences: {
        frequency: {
          path: ['digest'],
          equals: 'daily'
        }
      }
    },
    include: {
      savingsTransactions: {
        where: {
          createdAt: {
            gte: new Date(Date.now() - 24 * 60 * 60 * 1000) // Last 24 hours
          }
        }
      },
      userAchievements: {
        where: {
          unlockedAt: {
            gte: new Date(Date.now() - 24 * 60 * 60 * 1000)
          }
        }
      },
      challengeParticipants: {
        where: {
          challenge: {
            status: 'active',
            updatedAt: {
              gte: new Date(Date.now() - 24 * 60 * 60 * 1000)
            }
          }
        }
      }
    }
  });

  for (const user of users) {
    try {
      const totalSaved = user.savingsTransactions
        .filter(tx => tx.type !== 'withdrawal')
        .reduce((sum, tx) => sum + tx.amount, 0);

      const yieldEarned = user.savingsTransactions
        .filter(tx => tx.type === 'yield')
        .reduce((sum, tx) => sum + tx.amount, 0);

      const digestData = {
        totalSaved,
        achievementsUnlocked: user.userAchievements.length,
        challengesCompleted: user.challengeParticipants.filter(p => 
          p.challenge?.status === 'completed'
        ).length,
        yieldEarned,
        streakDays: user.currentStreak
      };

      // Only send if there's activity
      if (totalSaved > 0 || digestData.achievementsUnlocked > 0) {
        await emailService.sendWeeklyDigest(user.email, user.username, digestData);
      }
    } catch (error) {
      console.error(`Failed to send daily digest to ${user.email}:`, error);
    }
  }
}

async function sendWeeklyDigests() {
  console.log('Sending weekly digest emails...');

  const users = await prisma.user.findMany({
    where: {
      isActive: true,
      notificationPreferences: {
        frequency: {
          path: ['digest'],
          equals: 'weekly'
        }
      }
    },
    include: {
      savingsTransactions: {
        where: {
          createdAt: {
            gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) // Last 7 days
          }
        }
      },
      userAchievements: {
        where: {
          unlockedAt: {
            gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
          }
        }
      },
      challengeParticipants: {
        where: {
          challenge: {
            status: 'active',
            updatedAt: {
              gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
            }
          }
        }
      }
    }
  });

  for (const user of users) {
    try {
      const totalSaved = user.savingsTransactions
        .filter(tx => tx.type !== 'withdrawal')
        .reduce((sum, tx) => sum + tx.amount, 0);

      const yieldEarned = user.savingsTransactions
        .filter(tx => tx.type === 'yield')
        .reduce((sum, tx) => sum + tx.amount, 0);

      const digestData = {
        totalSaved,
        achievementsUnlocked: user.userAchievements.length,
        challengesCompleted: user.challengeParticipants.filter(p => 
          p.challenge?.status === 'completed'
        ).length,
        yieldEarned,
        streakDays: user.currentStreak
      };

      await emailService.sendWeeklyDigest(user.email, user.username, digestData);
    } catch (error) {
      console.error(`Failed to send weekly digest to ${user.email}:`, error);
    }
  }
}

async function cleanupOldData() {
  console.log('Cleaning up old notification data...');
  
  try {
    // Clean up old notifications (older than 30 days)
    await notificationService.cleanupOldNotifications(30);
    
    // Clean up old push subscriptions (older than 90 days)
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - 90);
    
    await prisma.pushSubscription.deleteMany({
      where: {
        OR: [
          { updatedAt: { lt: cutoffDate } },
          { isActive: false }
        ]
      }
    });

    console.log('Old data cleanup completed');
  } catch (error) {
    console.error('Failed to cleanup old data:', error);
  }
}

async function main() {
  console.log('Starting notification processor...');
  
  try {
    // Process scheduled notifications
    await processScheduledNotifications();
    
    // Send digest emails if it's the right time
    await sendDigestEmails();
    
    // Clean up old data (run once per day at midnight)
    const currentHour = new Date().getHours();
    if (currentHour === 0) {
      await cleanupOldData();
    }
    
    console.log('Notification processor completed successfully');
  } catch (error) {
    console.error('Notification processor failed:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the processor
if (require.main === module) {
  main();
}

export { main as processNotifications };