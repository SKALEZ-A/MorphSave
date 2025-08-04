import { NextRequest, NextResponse } from 'next/server';
import { withAuth, AuthenticatedRequest } from '@/lib/middleware/auth';
import { processRoundUp } from '@/lib/db/savings';
import { checkAndUnlockAchievements } from '@/lib/db/achievements';

export async function POST(request: NextRequest) {
  return withAuth(request, async (req: AuthenticatedRequest) => {
    try {
      const body = await req.json();
      const { originalAmount, merchant, category, roundUpTo } = body;

      // Validation
      if (!originalAmount || originalAmount <= 0) {
        return NextResponse.json(
          { error: 'Original amount must be greater than 0' },
          { status: 400 }
        );
      }

      if (!merchant) {
        return NextResponse.json(
          { error: 'Merchant is required' },
          { status: 400 }
        );
      }

      const roundUpAmount = roundUpTo || 1.0;
      if (roundUpAmount < 0.5 || roundUpAmount > 5.0) {
        return NextResponse.json(
          { error: 'Round up amount must be between $0.50 and $5.00' },
          { status: 400 }
        );
      }

      // Process round-up transaction
      const transaction = await processRoundUp(
        req.user!.id,
        originalAmount,
        merchant,
        category || 'Other',
        roundUpAmount
      );

      // Check for achievements
      const newAchievements = await checkAndUnlockAchievements(
        req.user!.id,
        'savings',
        { transactionAmount: transaction.amount }
      );

      return NextResponse.json({
        success: true,
        transaction: {
          id: transaction.id,
          amount: transaction.amount,
          originalAmount: transaction.originalTransactionAmount,
          merchant: transaction.merchant,
          category: transaction.category,
          status: transaction.status,
          createdAt: transaction.createdAt
        },
        newAchievements: newAchievements.map(ua => ({
          id: ua.achievement.id,
          name: ua.achievement.name,
          pointsReward: ua.achievement.pointsReward
        })),
        message: `Round-up of $${transaction.amount.toFixed(2)} processed successfully`
      });

    } catch (error) {
      console.error('Round-up processing error:', error);
      
      if (error instanceof Error) {
        return NextResponse.json(
          { error: error.message },
          { status: 400 }
        );
      }

      return NextResponse.json(
        { error: 'Internal server error' },
        { status: 500 }
      );
    }
  });
}