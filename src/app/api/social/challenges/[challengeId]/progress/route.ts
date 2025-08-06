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
    const body = await request.json();
    const { amount } = body;

    if (!amount || amount <= 0) {
      return NextResponse.json(
        { error: 'Valid amount is required' },
        { status: 400 }
      );
    }

    // Check if user is participating in the challenge
    const participation = await prisma.challengeParticipant.findFirst({
      where: {
        challengeId: challengeId,
        userId: userId
      },
      include: {
        challenge: true
      }
    });

    if (!participation) {
      return NextResponse.json(
        { error: 'Not participating in this challenge' },
        { status: 400 }
      );
    }

    // Check if challenge is active
    if (participation.challenge.status !== 'ACTIVE') {
      return NextResponse.json(
        { error: 'Challenge is not active' },
        { status: 400 }
      );
    }

    // Update progress
    const newProgress = participation.currentProgress + amount;
    const isCompleted = participation.challenge.targetAmount 
      ? newProgress >= participation.challenge.targetAmount
      : false;

    const updatedParticipation = await prisma.challengeParticipant.update({
      where: {
        id: participation.id
      },
      data: {
        currentProgress: newProgress,
        isCompleted: isCompleted,
        lastProgressUpdate: new Date()
      }
    });

    // Record daily progress
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    await prisma.challengeDailyProgress.upsert({
      where: {
        participantId_date: {
          participantId: participation.id,
          date: today
        }
      },
      update: {
        amount: {
          increment: amount
        }
      },
      create: {
        participantId: participation.id,
        date: today,
        amount: amount
      }
    });

    // Check if this completes the challenge for the user
    if (isCompleted && !participation.isCompleted) {
      // TODO: Award completion achievement points
      // TODO: Send completion notification
    }

    // Update leaderboard rankings
    await updateChallengeRankings(challengeId);

    return NextResponse.json({
      success: true,
      data: {
        currentProgress: newProgress,
        isCompleted: isCompleted,
        progressAdded: amount
      }
    });
  } catch (error) {
    console.error('Error updating challenge progress:', error);
    return NextResponse.json(
      { error: 'Failed to update progress' },
      { status: 500 }
    );
  }
}

// Helper function to update challenge rankings
async function updateChallengeRankings(challengeId: string) {
  const participants = await prisma.challengeParticipant.findMany({
    where: { challengeId },
    orderBy: { currentProgress: 'desc' }
  });

  // Update ranks
  for (let i = 0; i < participants.length; i++) {
    await prisma.challengeParticipant.update({
      where: { id: participants[i].id },
      data: { rank: i + 1 }
    });
  }
}