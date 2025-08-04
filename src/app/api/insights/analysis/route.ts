import { NextRequest, NextResponse } from 'next/server';
import { aiInsightsService } from '../../../../lib/ai/insights';
import { prisma } from '../../../../lib/db/prisma';
import { verifyAuth } from '../../../../lib/middleware/auth';

export async function GET(request: NextRequest) {
  try {
    // Verify authentication
    const authResult = await verifyAuth(request);
    if (!authResult.success) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = authResult.userId!;

    // Get user's recent transactions for analysis
    const transactions = await prisma.savingsTransaction.findMany({
      where: {
        userId,
        createdAt: {
          gte: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000) // Last 90 days
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    // Analyze spending patterns
    const analysis = await aiInsightsService.analyzeSpending(userId, transactions);

    return NextResponse.json({
      success: true,
      data: analysis
    });
  } catch (error) {
    console.error('Error in spending analysis API:', error);
    return NextResponse.json(
      { error: 'Failed to analyze spending patterns' },
      { status: 500 }
    );
  }
}