import { getWebSocketServer } from './server';
import { prisma } from '../db/prisma';

// Integration functions to broadcast updates from various services

export class WebSocketIntegration {
  private static instance: WebSocketIntegration;
  
  public static getInstance(): WebSocketIntegration {
    if (!WebSocketIntegration.instance) {
      WebSocketIntegration.instance = new WebSocketIntegration();
    }
    return WebSocketIntegration.instance;
  }

  // Balance and transaction updates
  async broadcastBalanceUpdate(userId: string) {
    try {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        include: {
          savingsTransactions: {
            where: { status: 'confirmed' },
            orderBy: { createdAt: 'desc' }
          }
        }
      });

      if (!user) return;

      const totalSaved = user.savingsTransactions
        .filter(tx => tx.type !== 'withdrawal')
        .reduce((sum, tx) => sum + tx.amount, 0);

      const totalWithdrawn = user.savingsTransactions
        .filter(tx => tx.type === 'withdrawal')
        .reduce((sum, tx) => sum + tx.amount, 0);

      const yieldEarned = user.savingsTransactions
        .filter(tx => tx.type === 'yield')
        .reduce((sum, tx) => sum + tx.amount, 0);

      const balanceData = {
        totalBalance: totalSaved - totalWithdrawn,
        availableBalance: totalSaved - totalWithdrawn,
        yieldEarned,
        totalSaved,
        currentAPY: 4.5, // This would come from yield manager
        lastUpdated: new Date()
      };

      getWebSocketServer().broadcastBalanceUpdate(userId, balanceData);
    } catch (error) {
      console.error('Error broadcasting balance update:', error);
    }
  }

  async broadcastTransactionUpdate(userId: string, transactionId: string) {
    try {
      const transaction = await prisma.savingsTransaction.findUnique({
        where: { id: transactionId }
      });

      if (!transaction) return;

      getWebSocketServer().broadcastTransactionUpdate(userId, {
        id: transaction.id,
        type: transaction.type as any,
        amount: transaction.amount,
        status: transaction.status as any,
        blockchainTxHash: transaction.blockchainTxHash || undefined,
        timestamp: transaction.createdAt
      });
    } catch (error) {
      console.error('Error broadcasting transaction update:', error);
    }
  }

  // Challenge and gamification updates
  async broadcastChallengeProgress(challengeId: string) {
    try {
      const challenge = await prisma.challenge.findUnique({
        where: { id: challengeId },
        include: {
          participants: {
            include: {
              user: {
                select: { id: true, username: true }
              }
            },
            orderBy: { currentProgress: 'desc' }
          }
        }
      });

      if (!challenge) return;

      const progressData = {
        challengeId,
        participants: challenge.participants.map((p, index) => ({
          userId: p.userId,
          username: p.user.username,
          progress: p.currentProgress,
          rank: index + 1
        })),
        totalProgress: challenge.participants.reduce((sum, p) => sum + p.currentProgress, 0),
        timeRemaining: Math.max(0, challenge.endDate.getTime() - Date.now())
      };

      getWebSocketServer().broadcastChallengeProgress(challengeId, progressData);
    } catch (error) {
      console.error('Error broadcasting challenge progress:', error);
    }
  }

  async broadcastLeaderboardUpdate(challengeId: string) {
    try {
      const participants = await prisma.challengeParticipant.findMany({
        where: { challengeId },
        include: {
          user: {
            select: { id: true, username: true, profileImage: true }
          }
        },
        orderBy: { currentProgress: 'desc' },
        take: 10
      });

      const leaderboardData = {
        challengeId,
        leaderboard: participants.map((p, index) => ({
          rank: index + 1,
          userId: p.userId,
          username: p.user.username,
          score: p.currentProgress,
          avatar: p.user.profileImage || undefined
        })),
        lastUpdated: new Date()
      };

      getWebSocketServer().broadcastLeaderboardUpdate(challengeId, leaderboardData);
    } catch (error) {
      console.error('Error broadcasting leaderboard update:', error);
    }
  }

  async broadcastAchievementUnlocked(userId: string, achievementId: string) {
    try {
      const userAchievement = await prisma.userAchievement.findFirst({
        where: { userId, achievementId },
        include: {
          achievement: true
        }
      });

      if (!userAchievement) return;

      const achievementData = {
        id: userAchievement.achievement.id,
        name: userAchievement.achievement.name,
        description: userAchievement.achievement.description,
        icon: userAchievement.achievement.icon,
        category: userAchievement.achievement.category,
        rarity: userAchievement.achievement.rarity as any,
        points: userAchievement.achievement.points,
        unlockedAt: userAchievement.unlockedAt
      };

      getWebSocketServer().broadcastAchievementUnlocked(userId, achievementData);
    } catch (error) {
      console.error('Error broadcasting achievement unlock:', error);
    }
  }

  async broadcastStreakUpdate(userId: string) {
    try {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: {
          currentStreak: true,
          longestStreak: true,
          totalPoints: true
        }
      });

      if (!user) return;

      const streakData = {
        currentStreak: user.currentStreak,
        longestStreak: user.longestStreak,
        streakType: 'daily_save' as const,
        nextMilestone: Math.ceil((user.currentStreak + 1) / 7) * 7, // Next weekly milestone
        streakBonus: Math.floor(user.currentStreak / 7) * 10 // 10 points per week
      };

      getWebSocketServer().broadcastStreakUpdate(userId, streakData);
    } catch (error) {
      console.error('Error broadcasting streak update:', error);
    }
  }

  // Social features
  async broadcastChallengeInvite(userId: string, challengeId: string, inviterId: string) {
    try {
      const challenge = await prisma.challenge.findUnique({
        where: { id: challengeId },
        select: { title: true }
      });

      const inviter = await prisma.user.findUnique({
        where: { id: inviterId },
        select: { username: true }
      });

      if (!challenge || !inviter) return;

      const inviteData = {
        challengeId,
        challengeName: challenge.title,
        inviterUsername: inviter.username,
        inviterId,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 days
      };

      getWebSocketServer().broadcastChallengeInvite(userId, inviteData);
    } catch (error) {
      console.error('Error broadcasting challenge invite:', error);
    }
  }

  async broadcastFriendRequest(userId: string, requestId: string) {
    try {
      const friendRequest = await prisma.friendRequest.findUnique({
        where: { id: requestId },
        include: {
          fromUser: {
            select: { id: true, username: true, profileImage: true }
          }
        }
      });

      if (!friendRequest) return;

      const requestData = {
        requestId,
        fromUserId: friendRequest.fromUserId,
        fromUsername: friendRequest.fromUser.username,
        fromAvatar: friendRequest.fromUser.profileImage || undefined,
        message: friendRequest.message || undefined,
        createdAt: friendRequest.createdAt
      };

      getWebSocketServer().broadcastFriendRequest(userId, requestData);
    } catch (error) {
      console.error('Error broadcasting friend request:', error);
    }
  }

  async broadcastNotification(userId: string, notificationData: any) {
    try {
      getWebSocketServer().broadcastNotification(userId, notificationData);
    } catch (error) {
      console.error('Error broadcasting notification:', error);
    }
  }

  // Utility methods
  isUserOnline(userId: string): boolean {
    return getWebSocketServer().isUserOnline(userId);
  }

  getOnlineUsers(): string[] {
    return getWebSocketServer().getOnlineUsers();
  }

  getConnectedSocketsCount(): number {
    return getWebSocketServer().getConnectedSocketsCount();
  }
}

// Export singleton instance
export const wsIntegration = WebSocketIntegration.getInstance();