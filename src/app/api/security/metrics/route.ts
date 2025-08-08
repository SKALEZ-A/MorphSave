import { NextRequest, NextResponse } from 'next/server';
import { withAdminAuth } from '@/lib/middleware/auth';
import { SecurityMonitor } from '../../../../../lib/security/SecurityMonitor';

const securityMonitor = new SecurityMonitor({
  enabled: true,
  alertThreshold: 10
});

// GET /api/security/metrics - Get security metrics (admin only)
export async function GET(request: NextRequest) {
  return withAdminAuth(request, async (req) => {
    try {
      const { searchParams } = new URL(req.url);
      const timeRange = parseInt(searchParams.get('timeRange') || '3600000'); // Default 1 hour

      const metrics = await securityMonitor.getSecurityMetrics(timeRange);

      return NextResponse.json({
        success: true,
        data: metrics
      });
    } catch (error) {
      console.error('Failed to get security metrics:', error);
      return NextResponse.json(
        { error: 'Failed to get security metrics' },
        { status: 500 }
      );
    }
  });
}