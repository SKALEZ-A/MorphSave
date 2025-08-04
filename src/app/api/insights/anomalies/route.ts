import { NextRequest, NextResponse } from 'next/server';
import { aiInsightsService } from '../../../../lib/ai/insights';
import { prisma } from '../../../../lib/db/prisma';
import { verifyAuth } from '../../../../lib/middleware/auth';

export async function POST(request: NextRequest) {
  try {
    // Verify authentication
    const authResult = await verifyAuth(request);
    if (!authResult.success) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = authResult.userId!;
    const body = await request.json();
    
    const { transactionId } = body;
    
    if (!transactionId) {
      return NextResponse.json(
        { error: 'Transaction ID is required' },
        { status: 400 }
      );
    }

    // Get the transaction
    const transaction = await prisma.savingsTransaction.findUnique({
      where: { id: transactionId }
    });

    if (!transaction || transaction.userId !== userId) {
      return NextResponse.json(
        { error: 'Transaction not found' },
        { status: 404 }
      );
    }

    // Check for anomalies
    const anomaly = await aiInsightsService.detectAnomalies(userId, transaction);

    return NextResponse.json({
      success: true,
      data: anomaly
    });
  } catch (error) {
    console.error('Error in anomaly detection API:', error);
    return NextResponse.json(
      { error: 'Failed to detect anomalies' },
      { status: 500 }
    );
  }
}