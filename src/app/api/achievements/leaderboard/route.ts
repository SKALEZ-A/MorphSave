import { NextRequest, NextResponse } from 'next/server';
import { withOptionalAuth, AuthenticatedRequest } from '@/lib/middleware/auth';
import { getAchievementLeaderboard } from '@/lib/db/achievements';

export async function GET(request: NextRequest) {
  return withOptionalAuth(request, async (req: AuthenticatedRequest) => {
    try {
      const { searchParams } = new URL(req.url);
      const limit = parseInt(searchParams.get('limit') || '10');

      if (limit < 1 || limit > 50) {
        return NextResponse.json(
          { error: 'Limit must be between 1 and 50' },
          { status: 400 }
        );
      }

      const leaderboard = await getAchievementLeaderboard(limit);

      return NextResponse.json({
        success: true,
        leaderboard: leaderboard.map((entry, index) => ({
          rank: index + 1,
          userId: entry.userId,
          username: entry.username,
          firstName: entry.firstName,
          lastName: entry.lastName,
          profileImage: entry.profileImage,
          achievementCount: entry.achievementCount,
          totalPoints: entry.totalPoints,
          isCurrentUser: req.user?.id === entry.userId
        }))
      });

    } catch (error) {
      console.error('Get achievement leaderboard error:', error);
      
      return NextResponse.json(
        { error: 'Internal server error' },
        { status: 500 }
      );
    }
  });
}