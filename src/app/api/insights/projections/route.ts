import { NextRequest, NextResponse } from 'next/server';
import { aiInsightsService } from '../../../../lib/ai/insights';
import { verifyAuth } from '../../../../lib/middleware/auth';

export async function GET(request: NextRequest) {
  try {
    // Verify authentication
    const authResult = await verifyAuth(request);
    if (!authResult.success) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = authResult.userId!;

    // Generate savings projections
    const projections = await aiInsightsService.predictSavingsGoals(userId);

    return NextResponse.json({
      success: true,
      data: projections
    });
  } catch (error) {
    console.error('Error in projections API:', error);
    return NextResponse.json(
      { error: 'Failed to generate savings projections' },
      { status: 500 }
    );
  }
}