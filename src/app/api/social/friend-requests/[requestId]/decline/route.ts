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
        { error: 'Unauthorized to decline this request' },
        { status: 403 }
      );
    }

    // Delete the friend request
    await prisma.friendship.delete({
      where: {
        id: requestId
      }
    });

    return NextResponse.json({
      success: true,
      message: 'Friend request declined'
    });
  } catch (error) {
    console.error('Error declining friend request:', error);
    return NextResponse.json(
      { error: 'Failed to decline friend request' },
      { status: 500 }
    );
  }
}