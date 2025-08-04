import { NextRequest, NextResponse } from 'next/server';
import { withAuth, AuthenticatedRequest } from '@/lib/middleware/auth';
import { searchUsers } from '@/lib/db/user';

export async function GET(request: NextRequest) {
  return withAuth(request, async (req: AuthenticatedRequest) => {
    try {
      const { searchParams } = new URL(req.url);
      const query = searchParams.get('q');
      const limit = parseInt(searchParams.get('limit') || '10');

      if (!query || query.trim().length < 2) {
        return NextResponse.json(
          { error: 'Search query must be at least 2 characters long' },
          { status: 400 }
        );
      }

      if (limit > 50) {
        return NextResponse.json(
          { error: 'Limit cannot exceed 50' },
          { status: 400 }
        );
      }

      const users = await searchUsers(query.trim(), limit, req.user!.id);

      return NextResponse.json({
        success: true,
        users,
        query: query.trim(),
        count: users.length
      });

    } catch (error) {
      console.error('User search error:', error);
      
      return NextResponse.json(
        { error: 'Internal server error' },
        { status: 500 }
      );
    }
  });
}