import { NextRequest, NextResponse } from 'next/server';
import { logoutUser } from '@/lib/db/session';

export async function POST(request: NextRequest) {
  try {
    const sessionToken = request.cookies.get('session_token')?.value;

    if (sessionToken) {
      await logoutUser(sessionToken);
    }

    const response = NextResponse.json({
      success: true,
      message: 'Logged out successfully'
    });

    // Clear session cookie
    response.cookies.delete('session_token');

    return response;

  } catch (error) {
    console.error('Logout error:', error);
    
    const response = NextResponse.json({
      success: true,
      message: 'Logged out successfully'
    });

    // Clear session cookie even if there was an error
    response.cookies.delete('session_token');

    return response;
  }
}