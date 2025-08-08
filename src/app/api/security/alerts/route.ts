import { NextRequest, NextResponse } from 'next/server';
import { withAdminAuth } from '@/lib/middleware/auth';
import { SecurityMonitor } from '../../../../../lib/security/SecurityMonitor';

const securityMonitor = new SecurityMonitor({
  enabled: true,
  alertThreshold: 10
});

// GET /api/security/alerts - Get active security alerts (admin only)
export async function GET(request: NextRequest) {
  return withAdminAuth(request, async (req) => {
    try {
      const alerts = await securityMonitor.getActiveAlerts();

      return NextResponse.json({
        success: true,
        data: alerts
      });
    } catch (error) {
      console.error('Failed to get security alerts:', error);
      return NextResponse.json(
        { error: 'Failed to get security alerts' },
        { status: 500 }
      );
    }
  });
}