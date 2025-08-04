import { NextRequest, NextResponse } from 'next/server';
import { verifyPassword, updateLastLogin } from '@/lib/db/user';
import { createLoginSession } from '@/lib/db/session';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, password } = body;

    // Validation
    if (!email || !password) {
      return NextResponse.json(
        { error: 'Email and password are required' },
        { status: 400 }
      );
    }

    // Verify credentials
    const user = await verifyPassword(email, password);
    
    if (!user) {
      return NextResponse.json(
        { error: 'Invalid email or password' },
        { status: 401 }
      );
    }

    if (!user.isActive) {
      return NextResponse.json(
        { error: 'Account is deactivated' },
        { status: 403 }
      );
    }

    // Update last login
    await updateLastLogin(user.id);

    // Create session
    const { session } = await createLoginSession(user.id, {
      ip: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || undefined,
      userAgent: request.headers.get('user-agent') || undefined,
      deviceInfo: request.headers.get('user-agent') || undefined
    });

    // Return user data (excluding sensitive information)
    const userData = {
      id: user.id,
      email: user.email,
      username: user.username,
      firstName: user.firstName,
      lastName: user.lastName,
      walletAddress: user.walletAddress,
      level: user.level,
      totalPoints: user.totalPoints,
      currentStreak: user.currentStreak,
      totalSaved: user.totalSaved,
      isVerified: user.isVerified,
      lastLoginAt: user.lastLoginAt
    };

    const response = NextResponse.json({
      success: true,
      user: userData,
      message: 'Login successful'
    });

    // Set session cookie
    response.cookies.set('session_token', session.sessionToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 30 * 24 * 60 * 60 // 30 days
    });

    return response;

  } catch (error) {
    console.error('Login error:', error);
    
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}