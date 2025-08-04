import { prisma } from './prisma';
import { SavingsTransaction, TransactionType, TransactionStatus, Prisma } from '@prisma/client';
import { calculateRoundUp } from '../utils/helpers';

export interface CreateSavingsTransactionInput {
  userId: string;
  type: TransactionType;
  amount: number;
  currency?: string;
  blockchainTxHash?: string;
  status?: TransactionStatus;
  
  // Round-up specific fields
  originalTransactionAmount?: number;
  merchant?: string;
  category?: string;
  
  // Yield specific fields
  yieldProtocol?: string;
  apy?: number;
}

export interface TransactionFilters {
  userId?: string;
  type?: TransactionType;
  status?: TransactionStatus;
  dateFrom?: Date;
  dateTo?: Date;
  minAmount?: number;
  maxAmount?: number;
  merchant?: string;
  category?: string;
}

export interface TransactionStats {
  totalAmount: number;
  totalTransactions: number;
  averageAmount: number;
  byType: Record<TransactionType, { count: number; amount: number }>;
  byStatus: Record<TransactionStatus, { count: number; amount: number }>;
  byCategory: Record<string, { count: number; amount: number }>;
  monthlyTrend: Array<{ month: string; amount: number; count: number }>;
}

/**
 * Create a new savings transaction
 */
export async function createSavingsTransaction(
  input: CreateSavingsTransactionInput
): Promise<SavingsTransaction> {
  const transaction = await prisma.savingsTransaction.create({
    data: {
      userId: input.userId,
      type: input.type,
      amount: input.amount,
      currency: input.currency || 'USD',
      blockchainTxHash: input.blockchainTxHash,
      status: input.status || TransactionStatus.PENDING,
      originalTransactionAmount: input.originalTransactionAmount,
      merchant: input.merchant,
      category: input.category,
      yieldProtocol: input.yieldProtocol,
      apy: input.apy
    }
  });

  // Update user's total saved amount if transaction is confirmed
  if (transaction.status === TransactionStatus.CONFIRMED && 
      (transaction.type === TransactionType.ROUNDUP || 
       transaction.type === TransactionType.MANUAL ||
       transaction.type === TransactionType.DEPOSIT)) {
    await updateUserTotalSaved(input.userId);
  }

  return transaction;
}

/**
 * Process a round-up transaction
 */
export async function processRoundUp(
  userId: string,
  originalAmount: number,
  merchant: string,
  category: string,
  roundUpTo: number = 1.0
): Promise<SavingsTransaction> {
  const roundUpAmount = calculateRoundUp(originalAmount, roundUpTo);
  
  if (roundUpAmount === 0) {
    throw new Error('No round-up needed for this transaction');
  }

  return createSavingsTransaction({
    userId,
    type: TransactionType.ROUNDUP,
    amount: roundUpAmount,
    originalTransactionAmount: originalAmount,
    merchant,
    category,
    status: TransactionStatus.PENDING
  });
}

/**
 * Get transaction by ID
 */
export async function getTransactionById(id: string): Promise<SavingsTransaction | null> {
  return prisma.savingsTransaction.findUnique({
    where: { id },
    include: {
      user: {
        select: {
          id: true,
          username: true,
          firstName: true,
          lastName: true
        }
      }
    }
  });
}

/**
 * Get user's transactions with filtering and pagination
 */
export async function getUserTransactions(
  userId: string,
  filters: Omit<TransactionFilters, 'userId'> = {},
  page: number = 1,
  limit: number = 20
): Promise<{
  transactions: SavingsTransaction[];
  total: number;
  hasMore: boolean;
}> {
  const where: Prisma.SavingsTransactionWhereInput = {
    userId,
    ...(filters.type && { type: filters.type }),
    ...(filters.status && { status: filters.status }),
    ...(filters.dateFrom || filters.dateTo) && {
      createdAt: {
        ...(filters.dateFrom && { gte: filters.dateFrom }),
        ...(filters.dateTo && { lte: filters.dateTo })
      }
    },
    ...(filters.minAmount || filters.maxAmount) && {
      amount: {
        ...(filters.minAmount && { gte: filters.minAmount }),
        ...(filters.maxAmount && { lte: filters.maxAmount })
      }
    },
    ...(filters.merchant && { 
      merchant: { contains: filters.merchant, mode: 'insensitive' } 
    }),
    ...(filters.category && { 
      category: { contains: filters.category, mode: 'insensitive' } 
    })
  };

  const [transactions, total] = await Promise.all([
    prisma.savingsTransaction.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit
    }),
    prisma.savingsTransaction.count({ where })
  ]);

  return {
    transactions,
    total,
    hasMore: total > page * limit
  };
}

/**
 * Update transaction status
 */
export async function updateTransactionStatus(
  id: string,
  status: TransactionStatus,
  blockchainTxHash?: string
): Promise<SavingsTransaction> {
  const transaction = await prisma.savingsTransaction.update({
    where: { id },
    data: {
      status,
      ...(blockchainTxHash && { blockchainTxHash })
    }
  });

  // Update user's total saved if transaction was confirmed
  if (status === TransactionStatus.CONFIRMED && 
      (transaction.type === TransactionType.ROUNDUP || 
       transaction.type === TransactionType.MANUAL ||
       transaction.type === TransactionType.DEPOSIT)) {
    await updateUserTotalSaved(transaction.userId);
  }

  return transaction;
}

/**
 * Get user's transaction statistics
 */
export async function getUserTransactionStats(
  userId: string,
  dateFrom?: Date,
  dateTo?: Date
): Promise<TransactionStats> {
  const where: Prisma.SavingsTransactionWhereInput = {
    userId,
    status: TransactionStatus.CONFIRMED,
    ...(dateFrom || dateTo) && {
      createdAt: {
        ...(dateFrom && { gte: dateFrom }),
        ...(dateTo && { lte: dateTo })
      }
    }
  };

  const transactions = await prisma.savingsTransaction.findMany({
    where,
    select: {
      amount: true,
      type: true,
      status: true,
      category: true,
      createdAt: true
    }
  });

  const totalAmount = transactions.reduce((sum, t) => sum + t.amount, 0);
  const totalTransactions = transactions.length;
  const averageAmount = totalTransactions > 0 ? totalAmount / totalTransactions : 0;

  // Group by type
  const byType = transactions.reduce((acc, t) => {
    if (!acc[t.type]) {
      acc[t.type] = { count: 0, amount: 0 };
    }
    acc[t.type].count++;
    acc[t.type].amount += t.amount;
    return acc;
  }, {} as Record<TransactionType, { count: number; amount: number }>);

  // Group by status
  const byStatus = transactions.reduce((acc, t) => {
    if (!acc[t.status]) {
      acc[t.status] = { count: 0, amount: 0 };
    }
    acc[t.status].count++;
    acc[t.status].amount += t.amount;
    return acc;
  }, {} as Record<TransactionStatus, { count: number; amount: number }>);

  // Group by category
  const byCategory = transactions.reduce((acc, t) => {
    const category = t.category || 'Other';
    if (!acc[category]) {
      acc[category] = { count: 0, amount: 0 };
    }
    acc[category].count++;
    acc[category].amount += t.amount;
    return acc;
  }, {} as Record<string, { count: number; amount: number }>);

  // Monthly trend (last 12 months)
  const monthlyTrend = [];
  const now = new Date();
  for (let i = 11; i >= 0; i--) {
    const monthStart = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const monthEnd = new Date(now.getFullYear(), now.getMonth() - i + 1, 0);
    
    const monthTransactions = transactions.filter(t => 
      t.createdAt >= monthStart && t.createdAt <= monthEnd
    );
    
    monthlyTrend.push({
      month: monthStart.toISOString().substring(0, 7), // YYYY-MM format
      amount: monthTransactions.reduce((sum, t) => sum + t.amount, 0),
      count: monthTransactions.length
    });
  }

  return {
    totalAmount,
    totalTransactions,
    averageAmount,
    byType,
    byStatus,
    byCategory,
    monthlyTrend
  };
}

/**
 * Get pending transactions for processing
 */
export async function getPendingTransactions(
  limit: number = 100
): Promise<SavingsTransaction[]> {
  return prisma.savingsTransaction.findMany({
    where: { status: TransactionStatus.PENDING },
    orderBy: { createdAt: 'asc' },
    take: limit,
    include: {
      user: {
        select: {
          id: true,
          walletAddress: true,
          autoInvestEnabled: true
        }
      }
    }
  });
}

/**
 * Get transactions by blockchain hash
 */
export async function getTransactionByBlockchainHash(
  blockchainTxHash: string
): Promise<SavingsTransaction | null> {
  return prisma.savingsTransaction.findFirst({
    where: { blockchainTxHash },
    include: {
      user: {
        select: {
          id: true,
          username: true,
          walletAddress: true
        }
      }
    }
  });
}

/**
 * Update user's total saved amount
 */
async function updateUserTotalSaved(userId: string): Promise<void> {
  const result = await prisma.savingsTransaction.aggregate({
    where: {
      userId,
      status: TransactionStatus.CONFIRMED,
      type: {
        in: [TransactionType.ROUNDUP, TransactionType.MANUAL, TransactionType.DEPOSIT]
      }
    },
    _sum: {
      amount: true
    }
  });

  const totalSaved = result._sum.amount || 0;

  await prisma.user.update({
    where: { id: userId },
    data: { totalSaved }
  });
}

/**
 * Get user's savings summary
 */
export async function getUserSavingsSummary(userId: string) {
  const [
    totalSaved,
    totalYield,
    totalWithdrawn,
    recentTransactions,
    monthlyStats
  ] = await Promise.all([
    // Total saved (deposits and round-ups)
    prisma.savingsTransaction.aggregate({
      where: {
        userId,
        status: TransactionStatus.CONFIRMED,
        type: { in: [TransactionType.ROUNDUP, TransactionType.MANUAL, TransactionType.DEPOSIT] }
      },
      _sum: { amount: true }
    }),
    
    // Total yield earned
    prisma.savingsTransaction.aggregate({
      where: {
        userId,
        status: TransactionStatus.CONFIRMED,
        type: TransactionType.YIELD
      },
      _sum: { amount: true }
    }),
    
    // Total withdrawn
    prisma.savingsTransaction.aggregate({
      where: {
        userId,
        status: TransactionStatus.CONFIRMED,
        type: TransactionType.WITHDRAWAL
      },
      _sum: { amount: true }
    }),
    
    // Recent transactions
    prisma.savingsTransaction.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 5,
      select: {
        id: true,
        type: true,
        amount: true,
        status: true,
        merchant: true,
        createdAt: true
      }
    }),
    
    // This month's stats
    getUserTransactionStats(
      userId,
      new Date(new Date().getFullYear(), new Date().getMonth(), 1),
      new Date()
    )
  ]);

  const currentBalance = (totalSaved._sum.amount || 0) + 
                        (totalYield._sum.amount || 0) - 
                        (totalWithdrawn._sum.amount || 0);

  return {
    currentBalance,
    totalSaved: totalSaved._sum.amount || 0,
    totalYield: totalYield._sum.amount || 0,
    totalWithdrawn: totalWithdrawn._sum.amount || 0,
    recentTransactions,
    thisMonth: {
      saved: monthlyStats.totalAmount,
      transactions: monthlyStats.totalTransactions
    }
  };
}

/**
 * Get top categories for user spending
 */
export async function getUserTopCategories(
  userId: string,
  limit: number = 10
): Promise<Array<{ category: string; amount: number; count: number }>> {
  const result = await prisma.savingsTransaction.groupBy({
    by: ['category'],
    where: {
      userId,
      status: TransactionStatus.CONFIRMED,
      type: TransactionType.ROUNDUP,
      category: { not: null }
    },
    _sum: { amount: true },
    _count: { id: true },
    orderBy: { _sum: { amount: 'desc' } },
    take: limit
  });

  return result.map(item => ({
    category: item.category || 'Other',
    amount: item._sum.amount || 0,
    count: item._count.id
  }));
}

/**
 * Get user's round-up statistics
 */
export async function getUserRoundUpStats(userId: string) {
  const [roundUpStats, merchantStats] = await Promise.all([
    prisma.savingsTransaction.aggregate({
      where: {
        userId,
        type: TransactionType.ROUNDUP,
        status: TransactionStatus.CONFIRMED
      },
      _sum: { amount: true },
      _count: { id: true },
      _avg: { amount: true }
    }),
    
    prisma.savingsTransaction.groupBy({
      by: ['merchant'],
      where: {
        userId,
        type: TransactionType.ROUNDUP,
        status: TransactionStatus.CONFIRMED,
        merchant: { not: null }
      },
      _sum: { amount: true },
      _count: { id: true },
      orderBy: { _sum: { amount: 'desc' } },
      take: 5
    })
  ]);

  return {
    totalRoundUps: roundUpStats._sum.amount || 0,
    totalTransactions: roundUpStats._count.id,
    averageRoundUp: roundUpStats._avg.amount || 0,
    topMerchants: merchantStats.map(item => ({
      merchant: item.merchant || 'Unknown',
      amount: item._sum.amount || 0,
      count: item._count.id
    }))
  };
}

/**
 * Batch update transaction statuses
 */
export async function batchUpdateTransactionStatus(
  transactionIds: string[],
  status: TransactionStatus,
  blockchainTxHashes?: string[]
): Promise<number> {
  const updateData: Prisma.SavingsTransactionUpdateManyArgs['data'] = { status };
  
  // If blockchain hashes provided, we need to update individually
  if (blockchainTxHashes && blockchainTxHashes.length === transactionIds.length) {
    let updatedCount = 0;
    for (let i = 0; i < transactionIds.length; i++) {
      await prisma.savingsTransaction.update({
        where: { id: transactionIds[i] },
        data: {
          status,
          blockchainTxHash: blockchainTxHashes[i]
        }
      });
      updatedCount++;
    }
    return updatedCount;
  }

  // Batch update without blockchain hashes
  const result = await prisma.savingsTransaction.updateMany({
    where: { id: { in: transactionIds } },
    data: updateData
  });

  return result.count;
}

/**
 * Delete old failed transactions (cleanup)
 */
export async function cleanupFailedTransactions(olderThanDays: number = 30): Promise<number> {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - olderThanDays);

  const result = await prisma.savingsTransaction.deleteMany({
    where: {
      status: TransactionStatus.FAILED,
      createdAt: { lt: cutoffDate }
    }
  });

  return result.count;
}