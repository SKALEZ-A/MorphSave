import { NextRequest, NextResponse } from 'next/server';
import { createUser, getUserByEmail, getUserByWalletAddress } from '@/lib/db/user';
import { createSession } from '@/lib/db/session';
import { generateSecureToken } from '@/lib/utils/encryption';
import { isValidAddress } from '@/lib/blockchain/transactionTracker';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, username, firstName, lastName, password, walletAddress, walletProvider } = body;

    // Validation
    if (!email || !walletAddress) {
      return NextResponse.json(
        { error: 'Email and wallet address are required' },
        { status: 400 }
      );
    }

    if (!isValidAddress(walletAddress)) {
      return NextResponse.json(
        { error: 'Invalid wallet address format' },
        { status: 400 }
      );
    }

    // Check if user already exists
    const [existingEmailUser, existingWalletUser] = await Promise.all([
      getUserByEmail(email),
      getUserByWalletAddress(walletAddress)
    ]);

    if (existingEmailUser) {
      return NextResponse.json(
        { error: 'User with this email already exists' },
        { status: 409 }
      );
    }

    if (existingWalletUser) {
      return NextResponse.json(
        { error: 'User with this wallet address already exists' },
        { status: 409 }
      );
    }

    // Generate encrypted private key (placeholder - in production, user would provide this)
    const privateKeyEncrypted = generateSecureToken(64);

    // Create user
    const user = await createUser({
      email,
      username,
      firstName,
      lastName,
      password,
      walletAddress,
      privateKeyEncrypted,
      walletProvider: walletProvider || 'METAMASK'
    });

    // Create session
    const session = await createSession({
      userId: user.id,
      deviceInfo: request.headers.get('user-agent') || undefined,
      ipAddress: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || undefined
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
      isVerified: user.isVerified
    };

    const response = NextResponse.json({
      success: true,
      user: userData,
      message: 'User registered successfully'
    }, { status: 201 });

    // Set session cookie
    response.cookies.set('session_token', session.sessionToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 30 * 24 * 60 * 60 // 30 days
    });

    return response;

  } catch (error) {
    console.error('Registration error:', error);
    
    if (error instanceof Error) {
      return NextResponse.json(
        { error: error.message },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}