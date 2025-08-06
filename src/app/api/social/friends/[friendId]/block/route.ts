import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '../../../../../../lib/db/prisma';
import { verifyAuth } from '../../../../../../lib/middleware/auth';

export async function POST(
  request: NextRequest,
  { params }: { params: { friendId: string } }
) {
  try {
    // Verify authentication
    const authResult = await verifyAuth(request);
    if (!authResult.success) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = authResult.userId!;
    const { friendId } = params;

    // Remove existing friendship
    await prisma.friendship.deleteMany({
      where: {
        OR: [
          { userId: userId, friendId: friendId },
          { userId: friendId, friendId: userId }
        ]
      }
    });

    // Create block relationship
    await prisma.userBlock.create({
      data: {
        blockerId: userId,
        blockedId: friendId
      }
    });

    return NextResponse.json({
      success: true,
      message: 'User blocked successfully'
    });
  } catch (error) {
    console.error('Error blocking user:', error);
    return NextResponse.json(
      { error: 'Failed to block user' },
      { status: 500 }
    );
  }
}