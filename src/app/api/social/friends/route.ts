import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '../../../../lib/db/prisma';
import { verifyAuth } from '../../../../lib/middleware/auth';

export async function GET(request: NextRequest) {
  try {
    // Verify authentication
    const authResult = await verifyAuth(request);
    if (!authResult.success) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = authResult.userId!;

    // Get user's friends
    const friendships = await prisma.friendship.findMany({
      where: {
        OR: [
          { userId: userId, status: 'ACCEPTED' },
          { friendId: userId, status: 'ACCEPTED' }
        ]
      },
      include: {
        user: {
          select: {
            id: true,
            username: true,
            email: true,
            profileImage: true,
            level: true,
            totalSaved: true,
            currentStreak: true,
            lastActiveAt: true,
            createdAt: true
          }
        },
        friend: {
          select: {
            id: true,
            username: true,
            email: true,
            profileImage: true,
            level: true,
            totalSaved: true,
            currentStreak: true,
            lastActiveAt: true,
            createdAt: true
          }
        }
      }
    });

    // Format friends data
    const friends = friendships.map(friendship => {
      const friend = friendship.userId === userId ? friendship.friend : friendship.user;
      
      return {
        id: friend.id,
        username: friend.username,
        email: friend.email,
        profileImage: friend.profileImage,
        status: 'active',
        totalSaved: friend.totalSaved,
        currentStreak: friend.currentStreak,
        level: friend.level,
        mutualFriends: 0, // TODO: Calculate mutual friends
        joinedAt: friend.createdAt,
        lastActive: friend.lastActiveAt || friend.createdAt
      };
    });

    return NextResponse.json({
      success: true,
      data: friends
    });
  } catch (error) {
    console.error('Error fetching friends:', error);
    return NextResponse.json(
      { error: 'Failed to fetch friends' },
      { status: 500 }
    );
  }
}