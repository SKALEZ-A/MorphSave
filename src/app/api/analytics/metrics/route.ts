import { NextRequest, NextResponse } from 'next/server';
import { withAdminAuth } from '@/lib/middleware/auth';
import { analyticsService } from '../../../../../lib/analytics/AnalyticsService';

// GET /api/analytics/metrics - Get analytics metrics (admin only)
export async function GET(request: NextRequest) {
  return withAdminAuth(request, async (req) => {
    try {
      const { searchParams } = new URL(req.url);
      const timeRange = parseInt(searchParams.get('timeRange') || '86400000'); // Default 24 hours
      const type = searchParams.get('type') || 'behavior';

      let metrics;

      switch (type) {
        case 'behavior':
          metrics = await analyticsService.getUserBehaviorMetrics(timeRange);
          break;
        case 'performance':
          metrics = await analyticsService.getPerformanceMetrics(timeRange);
          break;
        case 'business':
          metrics = await analyticsService.getBusinessMetrics(timeRange);
          break;
        case 'realtime':
          metrics = await analyticsService.getRealTimeMetrics();
          break;
        default:
          return NextResponse.json(
            { error: 'Invalid metrics type' },
            { status: 400 }
          );
      }

      return NextResponse.json({
        success: true,
        data: metrics
      });
    } catch (error) {
      console.error('Failed to get analytics metrics:', error);
      return NextResponse.json(
        { error: 'Failed to get metrics' },
        { status: 500 }
      );
    }
  });
}