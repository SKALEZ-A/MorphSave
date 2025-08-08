import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/middleware/auth';
import { PushNotificationService } from '../../../../../../lib/notifications/PushNotificationService';

const pushService = new PushNotificationService();

// POST /api/notifications/push/subscribe - Subscribe to push notifications
export async function POST(request: NextRequest) {
  return withAuth(request, async (req) => {
    try {
      const body = await req.json();
      const { subscription, userAgent, deviceType } = body;

      if (!subscription || !subscription.endpoint || !subscription.keys) {
        return NextResponse.json(
          { error: 'Invalid subscription data' },
          { status: 400 }
        );
      }

      await pushService.subscribe({
        userId: req.user!.id,
        endpoint: subscription.endpoint,
        keys: subscription.keys,
        userAgent,
        deviceType
      });

      return NextResponse.json({
        success: true,
        message: 'Successfully subscribed to push notifications'
      });
    } catch (error) {
      console.error('Failed to subscribe to push notifications:', error);
      return NextResponse.json(
        { error: 'Failed to subscribe to push notifications' },
        { status: 500 }
      );
    }
  });
}

// GET /api/notifications/push/subscribe - Get VAPID public key
export async function GET() {
  try {
    const publicKey = pushService.getVapidPublicKey();

    return NextResponse.json({
      success: true,
      data: { publicKey }
    });
  } catch (error) {
    console.error('Failed to get VAPID public key:', error);
    return NextResponse.json(
      { error: 'Failed to get VAPID public key' },
      { status: 500 }
    );
  }
}