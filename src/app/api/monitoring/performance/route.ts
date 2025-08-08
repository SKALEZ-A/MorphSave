import { NextRequest, NextResponse } from 'next/server';
import { withAdminAuth } from '@/lib/middleware/auth';
import { performanceMonitor } from '../../../../../lib/monitoring/PerformanceMonitor';

// GET /api/monitoring/performance - Get performance metrics (admin only)
export async function GET(request: NextRequest) {
  return withAdminAuth(request, async (req) => {
    try {
      const { searchParams } = new URL(req.url);
      const timeRange = parseInt(searchParams.get('timeRange') || '3600000'); // Default 1 hour
      const type = searchParams.get('type') || 'stats';

      let data;

      switch (type) {
        case 'stats':
          data = await performanceMonitor.getPerformanceStats(timeRange);
          break;
        case 'system':
          data = await performanceMonitor.getSystemMetrics();
          break;
        case 'realtime':
          data = await performanceMonitor.getRealTimeMetrics();
          break;
        default:
          return NextResponse.json(
            { error: 'Invalid performance metrics type' },
            { status: 400 }
          );
      }

      return NextResponse.json({
        success: true,
        data
      });
    } catch (error) {
      console.error('Failed to get performance metrics:', error);
      return NextResponse.json(
        { error: 'Failed to get performance metrics' },
        { status: 500 }
      );
    }
  });
}