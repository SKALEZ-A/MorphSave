import { NextRequest, NextResponse } from 'next/server';
import { withAuth, AuthenticatedRequest } from '@/lib/middleware/auth';
import { getUserStatsSummary } from '@/lib/db/user';
import { getUserSavingsSummary } from '@/lib/db/savings';
import { getUserAchievementStats } from '@/lib/db/achievements';
import { getUserSocialStats } from '@/lib/db/social';

export async function GET(request: NextRequest) {
  return withAuth(request, async (req: AuthenticatedRequest) => {
    try {
      const userId = req.user!.id;

      // Get comprehensive user statistics
      const [
        userStats,
        savingsStats,
        achievementStats,
        socialStats
      ] = await Promise.all([
        getUserStatsSummary(userId),
        getUserSavingsSummary(userId),
        getUserAchievementStats(userId),
        getUserSocialStats(userId)
      ]);

      const stats = {
        user: userStats,
        savings: {
          currentBalance: savingsStats.currentBalance,
          totalSaved: savingsStats.totalSaved,
          totalYield: savingsStats.totalYield,
          totalWithdrawn: savingsStats.totalWithdrawn,
          thisMonth: savingsStats.thisMonth,
          recentTransactions: savingsStats.recentTransactions.length
        },
        achievements: {
          totalAchievements: achievementStats.totalAchievements,
          unlockedAchievements: achievementStats.unlockedAchievements,
          completionRate: achievementStats.completionRate,
          totalPointsEarned: achievementStats.totalPointsEarned,
          byCategory: achievementStats.byCategory,
          byRarity: achievementStats.byRarity,
          recentUnlocks: achievementStats.recentUnlocks.length
        },
        social: {
          totalFriends: socialStats.totalFriends,
          pendingRequests: socialStats.pendingRequests,
          sentRequests: socialStats.sentRequests,
          mutualFriends: socialStats.mutualFriends,
          friendsThisMonth: socialStats.friendsThisMonth,
          topFriends: socialStats.topFriends
        }
      };

      return NextResponse.json({
        success: true,
        stats
      });

    } catch (error) {
      console.error('User stats error:', error);
      
      return NextResponse.json(
        { error: 'Internal server error' },
        { status: 500 }
      );
    }
  });
}