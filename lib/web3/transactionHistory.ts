import { ethers } from 'ethers';
import { prisma } from '../db/prisma';
import { getBlockchainTransaction, isValidTransactionHash, isValidAddress } from '../blockchain/transactionTracker';

export interface TransactionHistoryEntry {
  id: string;
  hash: string;
  from: string;
  to: string;
  value: string;
  gasUsed: string;
  gasPrice: string;
  blockNumber: number;
  timestamp: Date;
  status: 'success' | 'failed' | 'pending';
  type: 'deposit' | 'withdrawal' | 'transfer' | 'contract_interaction';
  description?: string;
  contractAddress?: string;
  methodName?: string;
  tokenTransfers?: TokenTransfer[];
}

export interface TokenTransfer {
  tokenAddress: string;
  tokenSymbol: string;
  tokenName: string;
  from: string;
  to: string;
  value: string;
  decimals: number;
}

export interface TransactionFilter {
  address?: string;
  fromBlock?: number;
  toBlock?: number;
  type?: string[];
  status?: string[];
  minValue?: string;
  maxValue?: string;
  limit?: number;
  offset?: number;
}

/**
 * Get transaction history for a user's wallet
 */
export async function getUserTransactionHistory(
  userId: string,
  filter?: TransactionFilter
): Promise<{
  transactions: TransactionHistoryEntry[];
  total: number;
  hasMore: boolean;
}> {
  try {
    // Get user's wallet address
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { walletAddress: true }
    });

    if (!user?.walletAddress) {
      return { transactions: [], total: 0, hasMore: false };
    }

    // Build query conditions
    const whereConditions: any = {
      OR: [
        { fromAddress: user.walletAddress },
        { toAddress: user.walletAddress }
      ]
    };

    // Apply filters
    if (filter?.type && filter.type.length > 0) {
      whereConditions.type = { in: filter.type };
    }

    if (filter?.status && filter.status.length > 0) {
      whereConditions.status = { in: filter.status };
    }

    if (filter?.fromBlock || filter?.toBlock) {
      whereConditions.blockNumber = {};
      if (filter.fromBlock) {
        whereConditions.blockNumber.gte = filter.fromBlock;
      }
      if (filter.toBlock) {
        whereConditions.blockNumber.lte = filter.toBlock;
      }
    }

    // Get total count
    const total = await prisma.transactionHistory.count({
      where: whereConditions
    });

    // Get transactions with pagination
    const limit = filter?.limit || 50;
    const offset = filter?.offset || 0;

    const dbTransactions = await prisma.transactionHistory.findMany({
      where: whereConditions,
      orderBy: { timestamp: 'desc' },
      take: limit,
      skip: offset,
      include: {
        tokenTransfers: true
      }
    });

    // Convert to TransactionHistoryEntry format
    const transactions: TransactionHistoryEntry[] = dbTransactions.map(tx => ({
      id: tx.id,
      hash: tx.hash,
      from: tx.fromAddress,
      to: tx.toAddress,
      value: tx.value,
      gasUsed: tx.gasUsed,
      gasPrice: tx.gasPrice,
      blockNumber: tx.blockNumber,
      timestamp: tx.timestamp,
      status: tx.status as 'success' | 'failed' | 'pending',
      type: tx.type as 'deposit' | 'withdrawal' | 'transfer' | 'contract_interaction',
      description: tx.description || undefined,
      contractAddress: tx.contractAddress || undefined,
      methodName: tx.methodName || undefined,
      tokenTransfers: tx.tokenTransfers.map(tt => ({
        tokenAddress: tt.tokenAddress,
        tokenSymbol: tt.tokenSymbol,
        tokenName: tt.tokenName,
        from: tt.fromAddress,
        to: tt.toAddress,
        value: tt.value,
        decimals: tt.decimals
      }))
    }));

    return {
      transactions,
      total,
      hasMore: offset + limit < total
    };
  } catch (error) {
    console.error('Error getting user transaction history:', error);
    return { transactions: [], total: 0, hasMore: false };
  }
}

/**
 * Add transaction to history
 */
export async function addTransactionToHistory(
  transaction: {
    hash: string;
    from: string;
    to: string;
    value: string;
    gasUsed?: string;
    gasPrice?: string;
    blockNumber?: number;
    status: 'success' | 'failed' | 'pending';
    type: 'deposit' | 'withdrawal' | 'transfer' | 'contract_interaction';
    description?: string;
    contractAddress?: string;
    methodName?: string;
  }
): Promise<string | null> {
  try {
    // Validate transaction hash and addresses
    if (!isValidTransactionHash(transaction.hash)) {
      throw new Error('Invalid transaction hash');
    }

    if (!isValidAddress(transaction.from) || !isValidAddress(transaction.to)) {
      throw new Error('Invalid address');
    }

    // Check if transaction already exists
    const existing = await prisma.transactionHistory.findUnique({
      where: { hash: transaction.hash }
    });

    if (existing) {
      return existing.id;
    }

    // Create new transaction history entry
    const historyEntry = await prisma.transactionHistory.create({
      data: {
        hash: transaction.hash,
        fromAddress: transaction.from,
        toAddress: transaction.to,
        value: transaction.value,
        gasUsed: transaction.gasUsed || '0',
        gasPrice: transaction.gasPrice || '0',
        blockNumber: transaction.blockNumber || 0,
        timestamp: new Date(),
        status: transaction.status,
        type: transaction.type,
        description: transaction.description,
        contractAddress: transaction.contractAddress,
        methodName: transaction.methodName
      }
    });

    return historyEntry.id;
  } catch (error) {
    console.error('Error adding transaction to history:', error);
    return null;
  }
}

/**
 * Update transaction status in history
 */
export async function updateTransactionHistoryStatus(
  hash: string,
  status: 'success' | 'failed' | 'pending',
  blockNumber?: number,
  gasUsed?: string
): Promise<boolean> {
  try {
    await prisma.transactionHistory.update({
      where: { hash },
      data: {
        status,
        blockNumber: blockNumber || undefined,
        gasUsed: gasUsed || undefined,
        updatedAt: new Date()
      }
    });

    return true;
  } catch (error) {
    console.error('Error updating transaction history status:', error);
    return false;
  }
}

/**
 * Sync transaction history from blockchain
 */
export async function syncTransactionHistoryFromBlockchain(
  address: string,
  fromBlock: number = 0,
  toBlock: number | 'latest' = 'latest'
): Promise<{
  synced: number;
  errors: number;
}> {
  let synced = 0;
  let errors = 0;

  try {
    if (!isValidAddress(address)) {
      throw new Error('Invalid address');
    }

    const provider = new ethers.JsonRpcProvider(
      process.env.MORPH_RPC_URL || 'https://rpc-quicknode-holesky.morphl2.io'
    );

    // Get current block number if toBlock is 'latest'
    const currentBlock = toBlock === 'latest' ? await provider.getBlockNumber() : toBlock;

    // Process blocks in batches to avoid rate limiting
    const batchSize = 1000;
    for (let startBlock = fromBlock; startBlock <= currentBlock; startBlock += batchSize) {
      const endBlock = Math.min(startBlock + batchSize - 1, currentBlock);

      try {
        // Get transaction history for this block range
        // Note: This is a simplified implementation
        // In production, you'd use event logs or an indexing service
        
        console.log(`Syncing blocks ${startBlock} to ${endBlock} for address ${address}`);
        
        // For now, we'll skip the actual blockchain sync
        // In a real implementation, you would:
        // 1. Query blockchain for transactions involving this address
        // 2. Parse transaction data and extract relevant information
        // 3. Add new transactions to the database
        
        synced += 0; // Placeholder
      } catch (error) {
        console.error(`Error syncing blocks ${startBlock}-${endBlock}:`, error);
        errors++;
      }

      // Small delay between batches
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  } catch (error) {
    console.error('Error syncing transaction history:', error);
    errors++;
  }

  return { synced, errors };
}

/**
 * Get transaction details with verification
 */
export async function getTransactionDetails(
  hash: string,
  forceRefresh: boolean = false
): Promise<TransactionHistoryEntry | null> {
  try {
    if (!isValidTransactionHash(hash)) {
      throw new Error('Invalid transaction hash');
    }

    // Check database first (unless force refresh)
    if (!forceRefresh) {
      const dbTransaction = await prisma.transactionHistory.findUnique({
        where: { hash },
        include: { tokenTransfers: true }
      });

      if (dbTransaction) {
        return {
          id: dbTransaction.id,
          hash: dbTransaction.hash,
          from: dbTransaction.fromAddress,
          to: dbTransaction.toAddress,
          value: dbTransaction.value,
          gasUsed: dbTransaction.gasUsed,
          gasPrice: dbTransaction.gasPrice,
          blockNumber: dbTransaction.blockNumber,
          timestamp: dbTransaction.timestamp,
          status: dbTransaction.status as 'success' | 'failed' | 'pending',
          type: dbTransaction.type as 'deposit' | 'withdrawal' | 'transfer' | 'contract_interaction',
          description: dbTransaction.description || undefined,
          contractAddress: dbTransaction.contractAddress || undefined,
          methodName: dbTransaction.methodName || undefined,
          tokenTransfers: dbTransaction.tokenTransfers.map(tt => ({
            tokenAddress: tt.tokenAddress,
            tokenSymbol: tt.tokenSymbol,
            tokenName: tt.tokenName,
            from: tt.fromAddress,
            to: tt.toAddress,
            value: tt.value,
            decimals: tt.decimals
          }))
        };
      }
    }

    // Fetch from blockchain
    const blockchainTx = await getBlockchainTransaction(hash);
    if (!blockchainTx) {
      return null;
    }

    // Determine transaction type
    const type = determineTransactionType(blockchainTx);

    // Add to database
    const historyId = await addTransactionToHistory({
      hash: blockchainTx.hash,
      from: blockchainTx.from,
      to: blockchainTx.to,
      value: ethers.formatEther(blockchainTx.value),
      gasUsed: blockchainTx.gasUsed,
      gasPrice: blockchainTx.gasPrice,
      blockNumber: blockchainTx.blockNumber,
      status: blockchainTx.status,
      type
    });

    if (!historyId) {
      return null;
    }

    // Return the transaction details
    return {
      id: historyId,
      hash: blockchainTx.hash,
      from: blockchainTx.from,
      to: blockchainTx.to,
      value: ethers.formatEther(blockchainTx.value),
      gasUsed: blockchainTx.gasUsed,
      gasPrice: blockchainTx.gasPrice,
      blockNumber: blockchainTx.blockNumber,
      timestamp: new Date(blockchainTx.timestamp * 1000),
      status: blockchainTx.status,
      type
    };
  } catch (error) {
    console.error('Error getting transaction details:', error);
    return null;
  }
}

/**
 * Determine transaction type based on transaction data
 */
function determineTransactionType(transaction: any): 'deposit' | 'withdrawal' | 'transfer' | 'contract_interaction' {
  // Check if it's a contract interaction
  if (transaction.to && transaction.to !== '0x0000000000000000000000000000000000000000') {
    // This would need to be enhanced to check if the 'to' address is a contract
    // For now, assume it's a transfer if value > 0, otherwise contract interaction
    if (parseFloat(ethers.formatEther(transaction.value)) > 0) {
      return 'transfer';
    } else {
      return 'contract_interaction';
    }
  }

  // Contract creation
  if (!transaction.to || transaction.to === '0x0000000000000000000000000000000000000000') {
    return 'contract_interaction';
  }

  return 'transfer';
}

/**
 * Get transaction statistics for a user
 */
export async function getUserTransactionStats(
  userId: string,
  timeframe: 'day' | 'week' | 'month' | 'year' = 'month'
): Promise<{
  totalTransactions: number;
  totalValue: string;
  totalGasUsed: string;
  averageGasPrice: string;
  successRate: number;
  transactionsByType: Record<string, number>;
  transactionsByDay: Array<{ date: string; count: number; value: string }>;
}> {
  try {
    // Get user's wallet address
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { walletAddress: true }
    });

    if (!user?.walletAddress) {
      return {
        totalTransactions: 0,
        totalValue: '0',
        totalGasUsed: '0',
        averageGasPrice: '0',
        successRate: 0,
        transactionsByType: {},
        transactionsByDay: []
      };
    }

    // Calculate date range
    const now = new Date();
    const startDate = new Date();
    
    switch (timeframe) {
      case 'day':
        startDate.setDate(now.getDate() - 1);
        break;
      case 'week':
        startDate.setDate(now.getDate() - 7);
        break;
      case 'month':
        startDate.setMonth(now.getMonth() - 1);
        break;
      case 'year':
        startDate.setFullYear(now.getFullYear() - 1);
        break;
    }

    // Get transactions in timeframe
    const transactions = await prisma.transactionHistory.findMany({
      where: {
        OR: [
          { fromAddress: user.walletAddress },
          { toAddress: user.walletAddress }
        ],
        timestamp: {
          gte: startDate,
          lte: now
        }
      },
      orderBy: { timestamp: 'asc' }
    });

    // Calculate statistics
    const totalTransactions = transactions.length;
    const successfulTransactions = transactions.filter(tx => tx.status === 'success').length;
    const successRate = totalTransactions > 0 ? (successfulTransactions / totalTransactions) * 100 : 0;

    let totalValue = ethers.parseEther('0');
    let totalGasUsed = BigInt(0);
    let totalGasPrice = BigInt(0);
    const transactionsByType: Record<string, number> = {};

    transactions.forEach(tx => {
      // Only count outgoing transactions for value calculation
      if (tx.fromAddress.toLowerCase() === user.walletAddress.toLowerCase()) {
        totalValue += ethers.parseEther(tx.value);
      }
      
      totalGasUsed += BigInt(tx.gasUsed);
      totalGasPrice += BigInt(tx.gasPrice);
      
      transactionsByType[tx.type] = (transactionsByType[tx.type] || 0) + 1;
    });

    const averageGasPrice = totalTransactions > 0 
      ? (totalGasPrice / BigInt(totalTransactions)).toString()
      : '0';

    // Group transactions by day
    const transactionsByDay: Array<{ date: string; count: number; value: string }> = [];
    const dailyGroups = new Map<string, { count: number; value: bigint }>();

    transactions.forEach(tx => {
      const date = tx.timestamp.toISOString().split('T')[0];
      const existing = dailyGroups.get(date) || { count: 0, value: BigInt(0) };
      
      existing.count++;
      if (tx.fromAddress.toLowerCase() === user.walletAddress.toLowerCase()) {
        existing.value += ethers.parseEther(tx.value);
      }
      
      dailyGroups.set(date, existing);
    });

    dailyGroups.forEach((data, date) => {
      transactionsByDay.push({
        date,
        count: data.count,
        value: ethers.formatEther(data.value)
      });
    });

    return {
      totalTransactions,
      totalValue: ethers.formatEther(totalValue),
      totalGasUsed: totalGasUsed.toString(),
      averageGasPrice,
      successRate,
      transactionsByType,
      transactionsByDay
    };
  } catch (error) {
    console.error('Error getting user transaction stats:', error);
    return {
      totalTransactions: 0,
      totalValue: '0',
      totalGasUsed: '0',
      averageGasPrice: '0',
      successRate: 0,
      transactionsByType: {},
      transactionsByDay: []
    };
  }
}

/**
 * Export transaction history to CSV
 */
export async function exportTransactionHistoryToCSV(
  userId: string,
  filter?: TransactionFilter
): Promise<string | null> {
  try {
    const { transactions } = await getUserTransactionHistory(userId, filter);
    
    if (transactions.length === 0) {
      return null;
    }

    // CSV headers
    const headers = [
      'Date',
      'Hash',
      'From',
      'To',
      'Value (ETH)',
      'Gas Used',
      'Gas Price',
      'Block Number',
      'Status',
      'Type',
      'Description'
    ];

    // Convert transactions to CSV rows
    const rows = transactions.map(tx => [
      tx.timestamp.toISOString(),
      tx.hash,
      tx.from,
      tx.to,
      tx.value,
      tx.gasUsed,
      tx.gasPrice,
      tx.blockNumber.toString(),
      tx.status,
      tx.type,
      tx.description || ''
    ]);

    // Combine headers and rows
    const csvContent = [headers, ...rows]
      .map(row => row.map(field => `"${field}"`).join(','))
      .join('\n');

    return csvContent;
  } catch (error) {
    console.error('Error exporting transaction history to CSV:', error);
    return null;
  }
}