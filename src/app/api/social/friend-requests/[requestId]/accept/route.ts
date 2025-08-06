import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '../../../../../../lib/db/prisma';
import { verifyAuth } from '../../../../../../lib/middleware/auth';

export async function POST(
  request: NextRequest,
  { params }: { params: { requestId: string } }
) {
  try {
    // Verify authentication
    const authResult = await verifyAuth(request);
    if (!authResult.success) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = authResult.userId!;
    const { requestId } = params;

    // Find the friend request
    const friendRequest = await prisma.friendship.findUnique({
      where: {
        id: requestId
      }
    });

    if (!friendRequest) {
      return NextResponse.json(
        { error: 'Friend request not found' },
        { status: 404 }
      );
    }

    // Verify the request is for this user
    if (friendRequest.friendId !== userId) {
      return NextResponse.json(
        { error: 'Unauthorized to accept this request' },
        { status: 403 }
      );
    }

    // Update the request status to accepted
    await prisma.friendship.update({
      where: {
        id: requestId
      },
      data: {
        status: 'ACCEPTED',
        acceptedAt: new Date()
      }
    });

    // Create the reverse friendship for bidirectional relationship
    await prisma.friendship.create({
      data: {
        userId: userId,
        friendId: friendRequest.userId,
        status: 'ACCEPTED',
        acceptedAt: new Date()
      }
    });

    // TODO: Send notification to the requester
    // TODO: Award friendship achievement points

    return NextResponse.json({
      success: true,
      message: 'Friend request accepted'
    });
  } catch (error) {
    console.error('Error accepting friend request:', error);
    return NextResponse.json(
      { error: 'Failed to accept friend request' },
      { status: 500 }
    );
  }
}