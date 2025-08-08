import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/middleware/auth';
import { notificationService } from '../../../../../../lib/notifications/NotificationService';

// PUT /api/notifications/[notificationId]/read - Mark notification as read
export async function PUT(
  request: NextRequest,
  { params }: { params: { notificationId: string } }
) {
  return withAuth(request, async (req) => {
    try {
      const { notificationId } = params;

      await notificationService.markAsRead(notificationId, req.user!.id);

      return NextResponse.json({
        success: true,
        message: 'Notification marked as read'
      });
    } catch (error) {
      console.error('Failed to mark notification as read:', error);
      return NextResponse.json(
        { error: 'Failed to mark notification as read' },
        { status: 500 }
      );
    }
  });
}