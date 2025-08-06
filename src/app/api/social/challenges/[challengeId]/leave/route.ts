import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '../../../../../../lib/db/prisma';
import { verifyAuth } from '../../../../../../lib/middleware/auth';

export async function POST(
  request: NextRequest,
  { params }: { params: { challengeId: string } }
) {
  try {
    // Verify authentication
    const authResult = await verifyAuth(request);
    if (!authResult.success) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = authResult.userId!;
    const { challengeId } = params;

    // Check if challenge exists
    const challenge = await prisma.challenge.findUnique({
      where: { id: challengeId }
    });

    if (!challenge) {
      return NextResponse.json(
        { error: 'Challenge not found' },
        { status: 404 }
      );
    }

    // Check if user is the creator (creators cannot leave their own challenges)
    if (challenge.creatorId === userId) {
      return NextResponse.json(
        { error: 'Challenge creators cannot leave their own challenges' },
        { status: 400 }
      );
    }

    // Find and remove participation
    const participation = await prisma.challengeParticipant.findFirst({
      where: {
        challengeId: challengeId,
        userId: userId
      }
    });

    if (!participation) {
      return NextResponse.json(
        { error: 'Not participating in this challenge' },
        { status: 400 }
      );
    }

    // Remove participation
    await prisma.challengeParticipant.delete({
      where: {
        id: participation.id
      }
    });

    return NextResponse.json({
      success: true,
      message: 'Successfully left the challenge'
    });
  } catch (error) {
    console.error('Error leaving challenge:', error);
    return NextResponse.json(
      { error: 'Failed to leave challenge' },
      { status: 500 }
    );
  }
}