import { NextRequest, NextResponse } from 'next/server';
import { validateSessionAndGetUser } from '@/lib/db/session';
import { getUserWithStats } from '@/lib/db/user';

export async function GET(request: NextRequest) {
  try {
    const sessionToken = request.cookies.get('session_token')?.value;

    if (!sessionToken) {
      return NextResponse.json(
        { error: 'No session token provided' },
        { status: 401 }
      );
    }

    // Validate session and get user
    const user = await validateSessionAndGetUser(sessionToken);

    if (!user) {
      return NextResponse.json(
        { error: 'Invalid or expired session' },
        { status: 401 }
      );
    }

    // Get detailed user stats
    const userWithStats = await getUserWithStats(user.id);

    if (!userWithStats) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    // Return user data (excluding sensitive information)
    const userData = {
      id: userWithStats.id,
      email: userWithStats.email,
      username: userWithStats.username,
      firstName: userWithStats.firstName,
      lastName: userWithStats.lastName,
      profileImage: userWithStats.profileImage,
      bio: userWithStats.bio,
      walletAddress: userWithStats.walletAddress,
      level: userWithStats.level,
      totalPoints: userWithStats.totalPoints,
      currentStreak: userWithStats.currentStreak,
      longestStreak: userWithStats.longestStreak,
      totalSaved: userWithStats.totalSaved,
      totalYieldEarned: userWithStats.totalYieldEarned,
      savingsGoal: userWithStats.savingsGoal,
      isVerified: userWithStats.isVerified,
      createdAt: userWithStats.createdAt,
      lastLoginAt: userWithStats.lastLoginAt,
      stats: {
        totalTransactions: userWithStats._count.savingsTransactions,
        totalAchievements: userWithStats._count.achievements,
        challengesCreated: userWithStats._count.challengesCreated,
        challengeParticipations: userWithStats._count.challengeParticipations,
        totalFriends: userWithStats._count.friendships
      }
    };

    return NextResponse.json({
      success: true,
      user: userData
    });

  } catch (error) {
    console.error('Get user error:', error);
    
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}