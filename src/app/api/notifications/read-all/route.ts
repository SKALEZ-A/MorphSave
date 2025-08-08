import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/middleware/auth';
import { notificationService } from '../../../../../lib/notifications/NotificationService';

// PUT /api/notifications/read-all - Mark all notifications as read
export async function PUT(request: NextRequest) {
  return withAuth(request, async (req) => {
    try {
      await notificationService.markAllAsRead(req.user!.id);

      return NextResponse.json({
        success: true,
        message: 'All notifications marked as read'
      });
    } catch (error) {
      console.error('Failed to mark all notifications as read:', error);
      return NextResponse.json(
        { error: 'Failed to mark all notifications as read' },
        { status: 500 }
      );
    }
  });
}