import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { faker } from '@faker-js/faker';

export async function POST(request: NextRequest) {
  try {
    // Get active challenges
    const activeChallenges = await prisma.challenge.findMany({
      where: {
        status: 'active'
      },
      include: {
        participants: {
          include: {
            user: true
          }
        }
      }
    });

    if (activeChallenges.length === 0) {
      return NextResponse.json(
        { error: 'No active challenges found.' },
        { status: 400 }
      );
    }

    const updatedChallenges = [];

    for (const challenge of activeChallenges) {
      const updatedParticipants = [];

      for (const participant of challenge.participants) {
        // Simulate progress updates
        const progressIncrease = faker.number.float({ 
          min: 0, 
          max: (challenge.targetAmount || 50) * 0.1,
          fractionDigits: 2 
        });

        const newProgress = Math.min(
          participant.currentProgress + progressIncrease,
          challenge.targetAmount || 100
        );

        await prisma.challengeParticipant.update({
          where: { id: participant.id },
          data: {
            currentProgress: newProgress,
            updatedAt: new Date()
          }
        });

        updatedParticipants.push({
          user: participant.user.username,
          oldProgress: participant.currentProgress,
          newProgress,
          increase: progressIncrease
        });
      }

      // Sort participants by progress to update rankings
      const sortedParticipants = await prisma.challengeParticipant.findMany({
        where: { challengeId: challenge.id },
        include: { user: true },
        orderBy: { currentProgress: 'desc' }
      });

      // Update rankings
      for (let i = 0; i < sortedParticipants.length; i++) {
        await prisma.challengeParticipant.update({
          where: { id: sortedParticipants[i].id },
          data: { rank: i + 1 }
        });
      }

      updatedChallenges.push({
        challenge: challenge.title,
        participants: updatedParticipants,
        leaderboard: sortedParticipants.map((p, index) => ({
          rank: index + 1,
          user: p.user.username,
          progress: p.currentProgress,
          target: challenge.targetAmount
        }))
      });
    }

    return NextResponse.json({
      success: true,
      message: `Updated leaderboards for ${activeChallenges.length} challenges`,
      challenges: updatedChallenges,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error updating leaderboards:', error);
    return NextResponse.json(
      { 
        success: false,
        error: 'Failed to update leaderboards',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}