import { NextRequest, NextResponse } from 'next/server';
import { withAuth, AuthenticatedRequest } from '@/lib/middleware/auth';
import { getUserSavingsSummary, getUserTransactionStats, getUserTopCategories, getUserRoundUpStats } from '@/lib/db/savings';

export async function GET(request: NextRequest) {
  return withAuth(request, async (req: AuthenticatedRequest) => {
    try {
      const userId = req.user!.id;

      // Get comprehensive savings data
      const [
        savingsSummary,
        transactionStats,
        topCategories,
        roundUpStats
      ] = await Promise.all([
        getUserSavingsSummary(userId),
        getUserTransactionStats(userId),
        getUserTopCategories(userId, 5),
        getUserRoundUpStats(userId)
      ]);

      const summary = {
        balance: {
          current: savingsSummary.currentBalance,
          totalSaved: savingsSummary.totalSaved,
          totalYield: savingsSummary.totalYield,
          totalWithdrawn: savingsSummary.totalWithdrawn
        },
        thisMonth: {
          saved: savingsSummary.thisMonth.saved,
          transactions: savingsSummary.thisMonth.transactions
        },
        recentTransactions: savingsSummary.recentTransactions,
        statistics: {
          totalAmount: transactionStats.totalAmount,
          totalTransactions: transactionStats.totalTransactions,
          averageAmount: transactionStats.averageAmount,
          byType: transactionStats.byType,
          byStatus: transactionStats.byStatus,
          monthlyTrend: transactionStats.monthlyTrend
        },
        categories: {
          top: topCategories,
          breakdown: transactionStats.byCategory
        },
        roundUps: {
          total: roundUpStats.totalRoundUps,
          transactions: roundUpStats.totalTransactions,
          average: roundUpStats.averageRoundUp,
          topMerchants: roundUpStats.topMerchants
        }
      };

      return NextResponse.json({
        success: true,
        summary
      });

    } catch (error) {
      console.error('Get savings summary error:', error);
      
      return NextResponse.json(
        { error: 'Internal server error' },
        { status: 500 }
      );
    }
  });
}