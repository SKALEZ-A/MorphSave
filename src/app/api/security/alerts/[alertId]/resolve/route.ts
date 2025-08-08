import { NextRequest, NextResponse } from 'next/server';
import { withAdminAuth } from '@/lib/middleware/auth';
import { SecurityMonitor } from '../../../../../../../lib/security/SecurityMonitor';

const securityMonitor = new SecurityMonitor({
  enabled: true,
  alertThreshold: 10
});

// PUT /api/security/alerts/[alertId]/resolve - Resolve security alert (admin only)
export async function PUT(
  request: NextRequest,
  { params }: { params: { alertId: string } }
) {
  return withAdminAuth(request, async (req) => {
    try {
      const { alertId } = params;
      const resolvedBy = req.user!.username;

      await securityMonitor.resolveAlert(alertId, resolvedBy);

      return NextResponse.json({
        success: true,
        message: 'Alert resolved successfully'
      });
    } catch (error) {
      console.error('Failed to resolve security alert:', error);
      return NextResponse.json(
        { error: 'Failed to resolve security alert' },
        { status: 500 }
      );
    }
  });
}