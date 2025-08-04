import { NextRequest, NextResponse } from 'next/server';
import { withAuth, AuthenticatedRequest } from '@/lib/middleware/auth';
import { getUserAchievements, getUserAchievementStats } from '@/lib/db/achievements';

export async function GET(request: NextRequest) {
  return withAuth(request, async (req: AuthenticatedRequest) => {
    try {
      const { searchParams } = new URL(req.url);
      const includeStats = searchParams.get('includeStats') === 'true';

      const userId = req.user!.id;

      // Get user achievements
      const achievements = await getUserAchievements(userId);

      let stats = null;
      if (includeStats) {
        stats = await getUserAchievementStats(userId);
      }

      return NextResponse.json({
        success: true,
        achievements: achievements.map(achievement => ({
          id: achievement.id,
          name: achievement.name,
          description: achievement.description,
          icon: achievement.icon,
          category: achievement.category,
          rarity: achievement.rarity,
          pointsReward: achievement.pointsReward,
          isUnlocked: achievement.isUnlocked,
          unlockedAt: achievement.unlockedAt,
          progress: achievement.progress,
          maxProgress: achievement.maxProgress
        })),
        stats
      });

    } catch (error) {
      console.error('Get achievements error:', error);
      
      return NextResponse.json(
        { error: 'Internal server error' },
        { status: 500 }
      );
    }
  });
}