import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/middleware/auth';
import { notificationService } from '../../../../lib/notifications/NotificationService';

// GET /api/notifications - Get user notifications
export async function GET(request: NextRequest) {
  return withAuth(request, async (req) => {
    try {
      const { searchParams } = new URL(req.url);
      const page = parseInt(searchParams.get('page') || '1');
      const limit = parseInt(searchParams.get('limit') || '20');
      const type = searchParams.get('type') || undefined;
      const unreadOnly = searchParams.get('unreadOnly') === 'true';

      const result = await notificationService.getUserNotifications(
        req.user!.id,
        { page, limit, type, unreadOnly }
      );

      return NextResponse.json({
        success: true,
        data: result
      });
    } catch (error) {
      console.error('Failed to get notifications:', error);
      return NextResponse.json(
        { error: 'Failed to get notifications' },
        { status: 500 }
      );
    }
  });
}

// POST /api/notifications - Send a notification (admin only)
export async function POST(request: NextRequest) {
  return withAuth(request, async (req) => {
    try {
      const body = await req.json();
      const {
        userId,
        type,
        title,
        message,
        data,
        priority = 'medium',
        channels = ['in_app'],
        scheduledFor,
        expiresAt
      } = body;

      // Basic validation
      if (!userId || !type || !title || !message) {
        return NextResponse.json(
          { error: 'Missing required fields' },
          { status: 400 }
        );
      }

      await notificationService.sendNotification({
        userId,
        type,
        title,
        message,
        data,
        priority,
        channels,
        scheduledFor: scheduledFor ? new Date(scheduledFor) : undefined,
        expiresAt: expiresAt ? new Date(expiresAt) : undefined
      });

      return NextResponse.json({
        success: true,
        message: 'Notification sent successfully'
      });
    } catch (error) {
      console.error('Failed to send notification:', error);
      return NextResponse.json(
        { error: 'Failed to send notification' },
        { status: 500 }
      );
    }
  });
}