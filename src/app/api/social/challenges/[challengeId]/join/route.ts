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

    // Check if challenge exists and is joinable
    const challenge = await prisma.challenge.findUnique({
      where: { id: challengeId },
      include: {
        participants: true
      }
    });

    if (!challenge) {
      return NextResponse.json(
        { error: 'Challenge not found' },
        { status: 404 }
      );
    }

    // Check if challenge is active or upcoming
    if (challenge.status !== 'ACTIVE' && challenge.status !== 'UPCOMING') {
      return NextResponse.json(
        { error: 'Challenge is not available for joining' },
        { status: 400 }
      );
    }

    // Check if user is already participating
    const existingParticipation = challenge.participants.find(p => p.userId === userId);
    if (existingParticipation) {
      return NextResponse.json(
        { error: 'Already participating in this challenge' },
        { status: 400 }
      );
    }

    // Check max participants limit
    if (challenge.maxParticipants && challenge.participants.length >= challenge.maxParticipants) {
      return NextResponse.json(
        { error: 'Challenge is full' },
        { status: 400 }
      );
    }

    // Add user as participant
    const participation = await prisma.challengeParticipant.create({
      data: {
        challengeId: challengeId,
        userId: userId,
        currentProgress: 0,
        isCompleted: false
      }
    });

    // TODO: Send notification to challenge creator
    // TODO: Award participation achievement points

    return NextResponse.json({
      success: true,
      data: participation
    });
  } catch (error) {
    console.error('Error joining challenge:', error);
    return NextResponse.json(
      { error: 'Failed to join challenge' },
      { status: 500 }
    );
  }
}