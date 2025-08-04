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

    // Generate personalized recommendations
    const recommendations = await aiInsightsService.generateRecommendations(userId);

    return NextResponse.json({
      success: true,
      data: recommendations
    });
  } catch (error) {
    console.error('Error in recommendations API:', error);
    return NextResponse.json(
      { error: 'Failed to generate recommendations' },
      { status: 500 }
    );
  }
}