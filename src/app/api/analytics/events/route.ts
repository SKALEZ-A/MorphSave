import { NextRequest, NextResponse } from 'next/server';
import { withOptionalAuth } from '@/lib/middleware/auth';
import { analyticsService } from '../../../../../lib/analytics/AnalyticsService';

// POST /api/analytics/events - Track analytics event
export async function POST(request: NextRequest) {
  return withOptionalAuth(request, async (req) => {
    try {
      const body = await req.json();
      const {
        eventType,
        eventName,
        properties = {},
        url,
        referrer
      } = body;

      if (!eventType || !eventName) {
        return NextResponse.json(
          { error: 'eventType and eventName are required' },
          { status: 400 }
        );
      }

      const sessionId = req.headers.get('x-session-id') || `session_${Date.now()}`;
      const clientIp = req.headers.get('x-forwarded-for') || 
                       req.headers.get('x-real-ip') || 
                       'unknown';
      const userAgent = req.headers.get('user-agent') || 'unknown';

      await analyticsService.trackEvent({
        userId: req.user?.id,
        sessionId,
        eventType,
        eventName,
        properties,
        clientIp,
        userAgent,
        url,
        referrer
      });

      return NextResponse.json({ success: true });
    } catch (error) {
      console.error('Failed to track analytics event:', error);
      return NextResponse.json(
        { error: 'Failed to track event' },
        { status: 500 }
      );
    }
  });
}