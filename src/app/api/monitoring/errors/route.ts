import { NextRequest, NextResponse } from 'next/server';
import { withAuth, withAdminAuth } from '@/lib/middleware/auth';
import { errorTracker } from '../../../../../lib/monitoring/ErrorTracker';

// POST /api/monitoring/errors - Track error
export async function POST(request: NextRequest) {
  return withAuth(request, async (req) => {
    try {
      const body = await req.json();
      const {
        name,
        message,
        stack,
        url,
        lineNumber,
        columnNumber,
        additionalContext
      } = body;

      if (!name || !message) {
        return NextResponse.json(
          { error: 'name and message are required' },
          { status: 400 }
        );
      }

      const error = new Error(message);
      error.name = name;
      error.stack = stack;

      const sessionId = req.headers.get('x-session-id') || `session_${Date.now()}`;
      const clientIp = req.headers.get('x-forwarded-for') || 
                       req.headers.get('x-real-ip') || 
                       'unknown';
      const userAgent = req.headers.get('user-agent') || 'unknown';

      const errorId = await errorTracker.trackError(error, {
        userId: req.user?.id,
        sessionId,
        url,
        userAgent,
        clientIp,
        additionalContext: {
          ...additionalContext,
          lineNumber,
          columnNumber
        }
      });

      return NextResponse.json({
        success: true,
        errorId
      });
    } catch (error) {
      console.error('Failed to track error:', error);
      return NextResponse.json(
        { error: 'Failed to track error' },
        { status: 500 }
      );
    }
  });
}

// GET /api/monitoring/errors - Get error statistics (admin only)
export async function GET(request: NextRequest) {
  return withAdminAuth(request, async (req) => {
    try {
      const { searchParams } = new URL(req.url);
      const timeRange = parseInt(searchParams.get('timeRange') || '86400000'); // Default 24 hours

      const stats = await errorTracker.getErrorStats(timeRange);

      return NextResponse.json({
        success: true,
        data: stats
      });
    } catch (error) {
      console.error('Failed to get error stats:', error);
      return NextResponse.json(
        { error: 'Failed to get error stats' },
        { status: 500 }
      );
    }
  });
}