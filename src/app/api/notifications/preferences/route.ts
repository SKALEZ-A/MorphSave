import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/middleware/auth';
import { notificationService } from '../../../../../lib/notifications/NotificationService';

// GET /api/notifications/preferences - Get user notification preferences
export async function GET(request: NextRequest) {
  return withAuth(request, async (req) => {
    try {
      const preferences = await notificationService.getUserPreferences(req.user!.id);

      return NextResponse.json({
        success: true,
        data: preferences
      });
    } catch (error) {
      console.error('Failed to get notification preferences:', error);
      return NextResponse.json(
        { error: 'Failed to get notification preferences' },
        { status: 500 }
      );
    }
  });
}

// PUT /api/notifications/preferences - Update user notification preferences
export async function PUT(request: NextRequest) {
  return withAuth(request, async (req) => {
    try {
      const body = await req.json();
      
      await notificationService.updateUserPreferences(req.user!.id, body);

      return NextResponse.json({
        success: true,
        message: 'Notification preferences updated successfully'
      });
    } catch (error) {
      console.error('Failed to update notification preferences:', error);
      return NextResponse.json(
        { error: 'Failed to update notification preferences' },
        { status: 500 }
      );
    }
  });
}