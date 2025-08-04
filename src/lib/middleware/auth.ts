import { NextRequest, NextResponse } from 'next/server';
import { validateSessionAndGetUser } from '@/lib/db/session';

export interface AuthenticatedRequest extends NextRequest {
  user?: {
    id: string;
    email: string;
    username: string;
    firstName?: string;
    lastName?: string;
    profileImage?: string;
    isActive: boolean;
    isVerified: boolean;
  };
}

/**
 * Middleware to authenticate requests
 */
export async function withAuth(
  request: NextRequest,
  handler: (req: AuthenticatedRequest) => Promise<NextResponse>
): Promise<NextResponse> {
  try {
    const sessionToken = request.cookies.get('session_token')?.value;

    if (!sessionToken) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    const user = await validateSessionAndGetUser(sessionToken);

    if (!user) {
      return NextResponse.json(
        { error: 'Invalid or expired session' },
        { status: 401 }
      );
    }

    if (!user.isActive) {
      return NextResponse.json(
        { error: 'Account is deactivated' },
        { status: 403 }
      );
    }

    // Add user to request
    (request as AuthenticatedRequest).user = user;

    return handler(request as AuthenticatedRequest);

  } catch (error) {
    console.error('Authentication middleware error:', error);
    
    return NextResponse.json(
      { error: 'Authentication failed' },
      { status: 401 }
    );
  }
}

/**
 * Optional authentication middleware (doesn't fail if no auth)
 */
export async function withOptionalAuth(
  request: NextRequest,
  handler: (req: AuthenticatedRequest) => Promise<NextResponse>
): Promise<NextResponse> {
  try {
    const sessionToken = request.cookies.get('session_token')?.value;

    if (sessionToken) {
      const user = await validateSessionAndGetUser(sessionToken);
      if (user && user.isActive) {
        (request as AuthenticatedRequest).user = user;
      }
    }

    return handler(request as AuthenticatedRequest);

  } catch (error) {
    console.error('Optional authentication middleware error:', error);
    // Continue without authentication
    return handler(request as AuthenticatedRequest);
  }
}

/**
 * Admin-only authentication middleware
 */
export async function withAdminAuth(
  request: NextRequest,
  handler: (req: AuthenticatedRequest) => Promise<NextResponse>
): Promise<NextResponse> {
  try {
    const sessionToken = request.cookies.get('session_token')?.value;

    if (!sessionToken) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    const user = await validateSessionAndGetUser(sessionToken);

    if (!user) {
      return NextResponse.json(
        { error: 'Invalid or expired session' },
        { status: 401 }
      );
    }

    if (!user.isActive) {
      return NextResponse.json(
        { error: 'Account is deactivated' },
        { status: 403 }
      );
    }

    // Check if user is admin (you'd implement admin role checking here)
    // For now, we'll use a simple check - in production, you'd have proper role management
    const isAdmin = user.email.endsWith('@morphsave.com') || user.username === 'admin';
    
    if (!isAdmin) {
      return NextResponse.json(
        { error: 'Admin access required' },
        { status: 403 }
      );
    }

    (request as AuthenticatedRequest).user = user;

    return handler(request as AuthenticatedRequest);

  } catch (error) {
    console.error('Admin authentication middleware error:', error);
    
    return NextResponse.json(
      { error: 'Authentication failed' },
      { status: 401 }
    );
  }
}

/**
 * Rate limiting middleware
 */
const rateLimitMap = new Map<string, { count: number; resetTime: number }>();

export function withRateLimit(
  maxRequests: number = 100,
  windowMs: number = 15 * 60 * 1000 // 15 minutes
) {
  return async function(
    request: NextRequest,
    handler: (req: NextRequest) => Promise<NextResponse>
  ): Promise<NextResponse> {
    const ip = request.headers.get('x-forwarded-for') || 
               request.headers.get('x-real-ip') || 
               'unknown';
    
    const now = Date.now();
    const windowStart = now - windowMs;
    
    // Clean up old entries
    for (const [key, value] of rateLimitMap.entries()) {
      if (value.resetTime < windowStart) {
        rateLimitMap.delete(key);
      }
    }
    
    const current = rateLimitMap.get(ip) || { count: 0, resetTime: now + windowMs };
    
    if (current.count >= maxRequests && current.resetTime > now) {
      return NextResponse.json(
        { error: 'Too many requests' },
        { status: 429 }
      );
    }
    
    current.count++;
    rateLimitMap.set(ip, current);
    
    return handler(request);
  };
}

/**
 * CORS middleware
 */
export function withCORS(
  request: NextRequest,
  handler: (req: NextRequest) => Promise<NextResponse>
): Promise<NextResponse> {
  return handler(request).then(response => {
    // Add CORS headers
    response.headers.set('Access-Control-Allow-Origin', process.env.FRONTEND_URL || '*');
    response.headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    response.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    response.headers.set('Access-Control-Allow-Credentials', 'true');
    
    return response;
  });
}

/**
 * Request validation middleware
 */
export function withValidation<T>(
  schema: (data: any) => T,
  request: NextRequest,
  handler: (req: NextRequest, validatedData: T) => Promise<NextResponse>
): Promise<NextResponse> {
  return request.json().then(data => {
    try {
      const validatedData = schema(data);
      return handler(request, validatedData);
    } catch (error) {
      return NextResponse.json(
        { error: 'Invalid request data', details: error instanceof Error ? error.message : 'Unknown error' },
        { status: 400 }
      );
    }
  }).catch(() => {
    return NextResponse.json(
      { error: 'Invalid JSON in request body' },
      { status: 400 }
    );
  });
}