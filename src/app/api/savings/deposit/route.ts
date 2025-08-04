import { NextRequest, NextResponse } from 'next/server';
import { withAuth, AuthenticatedRequest } from '@/lib/middleware/auth';
import { createSavingsTransaction } from '@/lib/db/savings';
import { checkAndUnlockAchievements } from '@/lib/db/achievements';

export async function POST(request: NextRequest) {
  return withAuth(request, async (req: AuthenticatedRequest) => {
    try {
      const body = await req.json();
      const { amount, type = 'MANUAL' } = body;

      // Validation
      if (!amount || amount <= 0) {
        return NextResponse.json(
          { error: 'Amount must be greater than 0' },
          { status: 400 }
        );
      }

      if (amount > 10000) {
        return NextResponse.json(
          { error: 'Amount cannot exceed $10,000 per transaction' },
          { status: 400 }
        );
      }

      if (!['MANUAL', 'DEPOSIT'].includes(type)) {
        return NextResponse.json(
          { error: 'Invalid transaction type' },
          { status: 400 }
        );
      }

      // Create savings transaction
      const transaction = await createSavingsTransaction({
        userId: req.user!.id,
        type: type as 'MANUAL' | 'DEPOSIT',
        amount,
        status: 'PENDING' // Will be confirmed after blockchain transaction
      });

      // Check for achievements
      const newAchievements = await checkAndUnlockAchievements(
        req.user!.id,
        'savings',
        { transactionAmount: amount }
      );

      return NextResponse.json({
        success: true,
        transaction: {
          id: transaction.id,
          amount: transaction.amount,
          type: transaction.type,
          status: transaction.status,
          createdAt: transaction.createdAt
        },
        newAchievements: newAchievements.map(ua => ({
          id: ua.achievement.id,
          name: ua.achievement.name,
          pointsReward: ua.achievement.pointsReward
        })),
        message: `${type === 'MANUAL' ? 'Manual deposit' : 'Deposit'} of $${amount.toFixed(2)} initiated successfully`
      });

    } catch (error) {
      console.error('Deposit processing error:', error);
      
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