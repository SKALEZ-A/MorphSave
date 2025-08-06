import { NextRequest, NextResponse } from 'next/server';
import { withAuth, AuthenticatedRequest } from '@/lib/middleware/auth';
import { createChallenge, getActiveChallenges } from '@/lib/db/challenges';

export async function GET(request: NextRequest) {
  return withAuth(request, async (req: AuthenticatedRequest) => {
    try {
      const { searchParams } = new URL(req.url);
      const page = parseInt(searchParams.get('page') || '1');
      const limit = parseInt(searchParams.get('limit') || '20');

      if (page < 1 || limit < 1 || limit > 50) {
        return NextResponse.json(
          { error: 'Invalid pagination parameters' },
          { status: 400 }
        );
      }

      const result = await getActiveChallenges(page, limit, req.user!.id);

      return NextResponse.json({
        success: true,
        challenges: result.challenges.map(challenge => ({
          id: challenge.id,
          title: challenge.title,
          description: challenge.description,
          type: challenge.type,
          targetAmount: challenge.targetAmount,
          duration: challenge.duration,
          startDate: challenge.startDate,
          endDate: challenge.endDate,
          status: challenge.status,
          creator: challenge.creator,
          participantCount: challenge.participantCount,
          isParticipating: challenge.isParticipating,
          userProgress: challenge.userProgress,
          topParticipants: challenge.participants.slice(0, 3).map(p => ({
   