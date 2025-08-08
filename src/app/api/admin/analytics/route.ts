import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const timeRange = searchParams.get('timeRange') || '7d';
    
    // Calculate date range
    const now = new Date();
    let startDate: Date;
    
    switch (timeRange) {
      case '24h':
        startDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        break;
      case '7d':
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case '30d':
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        break;
      case '90d':
        startDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
        break;
      default:
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    }

    // User Metrics
    const totalUsers = await prisma.user.count();
    const activeUsers = await prisma.user.count({
      where: {
        updatedAt: { gte: startDate }
      }
    });
    const newUsersToday = await prisma.user.count({
      where: {
        createdAt: { gte: new Date(now.getTime() - 24 * 60 * 60 * 1000) }
      }
    });

    // Calculate retention rate (simplified)
    const usersFromPreviousPeriod = await prisma.user.count({
      where: {
        createdAt: { lt: startDate }
      }
    });
    const activeFromPreviousPeriod = await prisma.user.count({
      where: {
        createdAt: { lt: startDate },
        updatedAt: { gte: startDate }
      }
    });
    const retentionRate = usersFromPreviousPeriod > 0 ? activeFromPreviousPeriod / usersFromPreviousPeriod : 0;

    // Engagement Metrics
    const dailyActiveUsers = await prisma.user.count({
      where: {
        updatedAt: { gte: new Date(now.getTime() - 24 * 60 * 60 * 1000) }
      }
    });
    const weeklyActiveUsers = await prisma.user.count({
      where: {
        updatedAt: { gte: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000) }
      }
    });
    const monthlyActiveUsers = await prisma.user.count({
      where: {
        updatedAt: { gte: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000) }
      }
    });

    // Financial Metrics
    const savingsAgg = await prisma.savingsTransaction.aggregate({
      _sum: { amount: true },
      _count: { id: true },
      _avg: { amount: true },
      where: {
        status: 'confirmed',
        createdAt: { gte: startDate }
      }
    });

    const totalSavingsAllTime = await prisma.savingsTransaction.aggregate({
      _sum: { amount: true },
      where: { status: 'confirmed' }
    });

    const averageSavingsPerUser = totalUsers > 0 ? (totalSavingsAllTime._sum.amount || 0) / totalUsers : 0;

    // Calculate average transactions per user
    const averageTransactionsPerUser = totalUsers > 0 ? (savingsAgg._count.id || 0) / totalUsers : 0;

    // Achievement unlock rate
    const totalAchievements = await prisma.achievement.count();
    const totalUserAchievements = await prisma.userAchievement.count();
    const achievementUnlockRate = totalUsers > 0 && totalAchievements > 0 
      ? totalUserAchievements / (totalUsers * totalAchievements) 
      : 0;

    // Social Metrics
    const totalChallenges = await prisma.challenge.count();
    const activeChallenges = await prisma.challenge.count({
      where: { status: 'active' }
    });
    
    const challengeParticipants = await prisma.challengeParticipant.count();
    const challengeParticipationRate = totalUsers > 0 ? challengeParticipants / totalUsers : 0;

    const friendships = await prisma.friendship.count();
    const averageFriendsPerUser = totalUsers > 0 ? (friendships * 2) / totalUsers : 0; // Each friendship counts for both users

    // Generate time series data
    const days = timeRange === '24h' ? 24 : timeRange === '7d' ? 7 : timeRange === '30d' ? 30 : 90;
    const interval = timeRange === '24h' ? 'hour' : 'day';
    
    const timeSeriesData = {
      userGrowth: await generateTimeSeriesData('users', days, interval, startDate),
      savingsGrowth: await generateTimeSeriesData('savings', days, interval, startDate),
      transactionVolume: await generateTimeSeriesData('transactions', days, interval, startDate),
      engagementTrend: await generateTimeSeriesData('engagement', days, interval, startDate)
    };

    const analytics = {
      userMetrics: {
        totalUsers,
        activeUsers,
        newUsersToday,
        retentionRate,
        averageSessionTime: 512 // Mock data - would need session tracking
      },
      engagementMetrics: {
        dailyActiveUsers,
        weeklyActiveUsers,
        monthlyActiveUsers,
        averageTransactionsPerUser,
        achievementUnlockRate
      },
      financialMetrics: {
        totalSavings: totalSavingsAllTime._sum.amount || 0,
        averageSavingsPerUser,
        totalTransactions: savingsAgg._count.id || 0,
        averageTransactionAmount: savingsAgg._avg.amount || 0,
        yieldGenerated: (totalSavingsAllTime._sum.amount || 0) * 0.042 // Mock 4.2% yield
      },
      socialMetrics: {
        totalChallenges,
        activeChallenges,
        challengeParticipationRate,
        averageFriendsPerUser,
        socialShareRate: 0.23 // Mock data
      },
      technicalMetrics: {
        apiResponseTime: 142,
        errorRate: 0.002,
        uptime: 0.999,
        blockchainSyncStatus: 'synced',
        cacheHitRate: 0.87
      },
      timeSeriesData
    };

    return NextResponse.json(analytics);
  } catch (error) {
    console.error('Error fetching analytics:', error);
    return NextResponse.json(
      { error: 'Failed to fetch analytics data' },
      { status: 500 }
    );
  }
}

async function generateTimeSeriesData(
  type: 'users' | 'savings' | 'transactions' | 'engagement',
  days: number,
  interval: 'hour' | 'day',
  startDate: Date
) {
  const data = [];
  const now = new Date();
  
  for (let i = 0; i < days; i++) {
    const date = new Date(startDate.getTime() + i * (interval === 'hour' ? 60 * 60 * 1000 : 24 * 60 * 60 * 1000));
    const nextDate = new Date(date.getTime() + (interval === 'hour' ? 60 * 60 * 1000 : 24 * 60 * 60 * 1000));
    
    let value = 0;
    
    switch (type) {
      case 'users':
        value = await prisma.user.count({
          where: {
            createdAt: { gte: date, lt: nextDate }
          }
        });
        break;
      case 'savings':
        const savingsSum = await prisma.savingsTransaction.aggregate({
          _sum: { amount: true },
          where: {
            createdAt: { gte: date, lt: nextDate },
            status: 'confirmed'
          }
        });
        value = savingsSum._sum.amount || 0;
        break;
      case 'transactions':
        value = await prisma.savingsTransaction.count({
          where: {
            createdAt: { gte: date, lt: nextDate },
            status: 'confirmed'
          }
        });
        break;
      case 'engagement':
        value = await prisma.user.count({
          where: {
            updatedAt: { gte: date, lt: nextDate }
          }
        });
        break;
    }
    
    data.push({
      date: date.toISOString(),
      [type === 'users' ? 'users' : type === 'savings' ? 'amount' : type === 'transactions' ? 'count' : 'engagement']: value
    });
  }
  
  return data;
}