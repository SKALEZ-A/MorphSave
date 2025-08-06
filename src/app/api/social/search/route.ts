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
    const { searchParams } = new URL(request.url);
    const query = searchParams.get('q');

    if (!query || query.trim().length < 2) {
      return NextResponse.json(
        { error: 'Search query must be at least 2 characters' },
        { status: 400 }
      );
    }

    // Get users that are blocked by or have blocked the current user
    const blockedUsers = await prisma.userBlock.findMany({
      where: {
        OR: [
          { blockerId: userId },
          { blockedId: userId }
        ]
      },
      select: {
        blockerId: true,
        blockedId: true
      }
    });

    const blockedUserIds = new Set([
      ...blockedUsers.map(b => b.blockerId),
      ...blockedUsers.map(b => b.blockedId)
    ]);

    // Search for users by username or email
    const users = await prisma.user.findMany({
      where: {
        AND: [
          {
            id: {
              not: userId, // Exclude current user
              notIn: Array.from(blockedUserIds) // Exclude blocked users
            }
          },
          {
            OR: [
              {
                username: {
                  contains: query,
                  mode: 'insensitive'
                }
              },
              {
                email: {
                  contains: query,
                  mode: 'insensitive'
                }
              }
            ]
          }
        ]
      },
      select: {
        id: true,
        username: true,
        email: true,
        profileImage: true,
        level: true,
        totalSaved: true,
        currentStreak: true
      },
      take: 20 // Limit results
    });

    // Get existing friendships and pending requests
    const existingRelationships = await prisma.friendship.findMany({
      where: {
        OR: [
          { userId: userId, friendId: { in: users.map(u => u.id) } },
          { userId: { in: users.map(u => u.id) }, friendId: userId }
        ]
      }
    });

    const friendshipMap = new Map();
    existingRelationships.forEach(rel => {
      const otherUserId = rel.userId === userId ? rel.friendId : rel.userId;
      friendshipMap.set(otherUserId, rel.status);
    });

    // Format search results
    const searchResults = users.map(user => ({
      id: user.id,
      username: user.username,
      email: user.email,
      profileImage: user.profileImage,
      level: user.level,
      totalSaved: user.totalSaved,
      currentStreak: user.currentStreak,
      mutualFriends: 0, // TODO: Calculate mutual friends
      isAlreadyFriend: friendshipMap.get(user.id) === 'ACCEPTED',
      hasPendingRequest: friendshipMap.get(user.id) === 'PENDING'
    }));

    return NextResponse.json({
      success: true,
      data: searchResults
    });
  } catch (error) {
    console.error('Error searching users:', error);
    return NextResponse.json(
      { error: 'Failed to search users' },
      { status: 500 }
    );
  }
}