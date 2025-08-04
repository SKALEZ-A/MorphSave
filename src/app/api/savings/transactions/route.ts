import { NextRequest, NextResponse } from 'next/server';
import { withAuth, AuthenticatedRequest } from '@/lib/middleware/auth';
import { getUserTransactions } from '@/lib/db/savings';

export async function GET(request: NextRequest) {
  return withAuth(request, async (req: AuthenticatedRequest) => {
    try {
      const { searchParams } = new URL(req.url);
      const page = parseInt(searchParams.get('page') || '1');
      const limit = parseInt(searchParams.get('limit') || '20');
      const type = searchParams.get('type');
      const status = searchParams.get('status');
      const dateFrom = searchParams.get('dateFrom');
      const dateTo = searchParams.get('dateTo');
      const merchant = searchParams.get('merchant');
      const category = searchParams.get('category');

      // Validation
      if (page < 1 || limit < 1 || limit > 100) {
        return NextResponse.json(
          { error: 'Invalid pagination parameters' },
          { status: 400 }
        );
      }

      // Build filters
      const filters: any = {};
      if (type) filters.type = type;
      if (status) filters.status = status;
      if (dateFrom) filters.dateFrom = new Date(dateFrom);
      if (dateTo) filters.dateTo = new Date(dateTo);
      if (merchant) filters.merchant = merchant;
      if (category) filters.category = category;

      // Get user transactions
      const result = await getUserTransactions(req.user!.id, filters, page, limit);

      return NextResponse.json({
        success: true,
        transactions: result.transactions.map(transaction => ({
          id: transaction.id,
          type: transaction.type,
          amount: transaction.amount,
          currency: transaction.currency,
          status: transaction.status,
          blockchainTxHash: transaction.blockchainTxHash,
          originalTransactionAmount: transaction.originalTransactionAmount,
          merchant: transaction.merchant,
          category: transaction.category,
          yieldProtocol: transaction.yieldProtocol,
          apy: transaction.apy,
          createdAt: transaction.createdAt
        })),
        pagination: {
          page,
          limit,
          total: result.total,
          hasMore: result.hasMore,
          totalPages: Math.ceil(result.total / limit)
        }
      });

    } catch (error) {
      console.error('Get transactions error:', error);
      
      return NextResponse.json(
        { error: 'Internal server error' },
        { status: 500 }
      );
    }
  });
}