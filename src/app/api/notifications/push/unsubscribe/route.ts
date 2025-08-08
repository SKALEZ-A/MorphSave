import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/middleware/auth';
import { PushNotificationService } from '../../../../../../lib/notifications/PushNotificationService';

const pushService = new PushNotificationService();

// POST /api/notifications/push/unsubscribe - Unsubscribe from push notifications
export async function POST(request: NextRequest) {
  return withAuth(request, async (req) => {
    try {
      const body = await req.json();
      const { endpoint } = body;

      if (!endpoint) {
        return NextResponse.json(
          { error: 'Endpoint is required' },
          { status: 400 }
        );
      }

      await pushService.unsubscribe(req.user!.id, endpoint);

      return NextResponse.json({
        success: true,
        message: 'Successfully unsubscribed from push notifications'
      });
    } catch (error) {
      console.error('Failed to unsubscribe from push notifications:', error);
      return NextResponse.json(
        { error: 'Failed to unsubscribe from push notifications' },
        { status: 500 }
      );
    }
  });
}