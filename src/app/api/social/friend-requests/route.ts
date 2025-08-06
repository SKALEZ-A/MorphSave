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

    // Get pending friend requests sent to this user
    const friendRequests = await prisma.friendship.findMany({
      where: {
        friendId: userId,
        status: 'PENDING'
      },
      include: {
        user: {
          select: {
            id: true,
            username: true,
            email: true,
            profileImage: true,
            level: true,
            totalSaved: true
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    const formattedRequests = friendRequests.map(request => ({
      id: request.id,
      fromUserId: request.userId,
      fromUser: request.user,
      createdAt: request.createdAt,
      message: request.message
    }));

    return NextResponse.json({
      success: true,
      data: formattedRequests
    });
  } catch (error) {
    console.error('Error fetching friend requests:', error);
    return NextResponse.json(
      { error: 'Failed to fetch friend requests' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    // Verify authentication
    const authResult = await verifyAuth(request);
    if (!authResult.success) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = authResult.userId!;
    const body = await request.json();
    const { toUserId, message } = body;

    if (!toUserId) {
      return NextResponse.json(
        { error: 'Target user ID is required' },
        { status: 400 }
      );
    }

    // Check if users are already friends or have pending request
    const existingRelationship = await prisma.friendship.findFirst({
      where: {
        OR: [
          { userId: userId, friendId: toUserId },
          { userId: toUserId, friendId: userId }
        ]
      }
    });

    if (existingRelationship) {
      return NextResponse.json(
        { error: 'Friend request already exists or users are already friends' },
        { status: 400 }
      );
    }

    // Check if user is blocked
    const isBlocked = await prisma.userBlock.findFirst({
      where: {
        OR: [
          { blockerId: userId, blockedId: toUserId },
          { blockerId: toUserId, blockedId: userId }
        ]
      }
    });

    if (isBlocked) {
      return NextResponse.json(
        { error: 'Cannot send friend request to this user' },
        { status: 400 }
      );
    }

    // Create friend request
    const friendRequest = await prisma.friendship.create({
      data: {
        userId: userId,
        friendId: toUserId,
        status: 'PENDING',
        message: message || null
      }
    });

    // TODO: Send notification to target user

    return NextResponse.json({
      success: true,
      data: friendRequest
    });
  } catch (error) {
    console.error('Error sending friend request:', error);
    return NextResponse.json(
      { error: 'Failed to send friend request' },
      { status: 500 }
    );
  }
}