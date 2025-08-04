import { ethers } from 'ethers';
import { prisma } from '../db/prisma';
import { TransactionStatus } from '@prisma/client';
import { updateTransactionStatus } from '../db/savings';

export interface BlockchainTransaction {
  hash: string;
  from: string;
  to: string;
  value: string;
  gasUsed: string;
  gasPrice: string;
  blockNumber: number;
  timestamp: number;
  status: 'success' | 'failed';
}

export interface TransactionReceipt {
  transactionHash: string;
  blockNumber: number;
  gasUsed: bigint;
  status: number;
  confirmations: number;
}

/**
 * Initialize blockchain provider
 */
function getProvider(): ethers.JsonRpcProvider {
  const rpcUrl = process.env.MORPH_RPC_URL || 'https://rpc-quicknode-holesky.morphl2.io';
  return new ethers.JsonRpcProvider(rpcUrl);
}

/**
 * Get transaction details from blockchain
 */
export async function getBlockchainTransaction(
  txHash: string
): Promise<BlockchainTransaction | null> {
  try {
    const provider = getProvider();
    const tx = await provider.getTransaction(txHash);
    const receipt = await provider.getTransactionReceipt(txHash);
    
    if (!tx || !receipt) {
      return null;
    }

    const block = await provider.getBlock(receipt.blockNumber);
    
    return {
      hash: tx.hash,
      from: tx.from,
      to: tx.to || '',
      value: tx.value.toString(),
      gasUsed: receipt.gasUsed.toString(),
      gasPrice: tx.gasPrice?.toString() || '0',
      blockNumber: receipt.blockNumber,
      timestamp: block?.timestamp || 0,
      status: receipt.status === 1 ? 'success' : 'failed'
    };
  } catch (error) {
    console.error('Error fetching blockchain transaction:', error);
    return null;
  }
}

/**
 * Check transaction confirmation status
 */
export async function checkTransactionConfirmation(
  txHash: string,
  requiredConfirmations: number = 3
): Promise<{
  isConfirmed: boolean;
  confirmations: number;
  status: 'success' | 'failed' | 'pending';
}> {
  try {
    const provider = getProvider();
    const receipt = await provider.getTransactionReceipt(txHash);
    
    if (!receipt) {
      return {
        isConfirmed: false,
        confirmations: 0,
        status: 'pending'
      };
    }

    const currentBlock = await provider.getBlockNumber();
    const confirmations = currentBlock - receipt.blockNumber + 1;
    
    return {
      isConfirmed: confirmations >= requiredConfirmations,
      confirmations,
      status: receipt.status === 1 ? 'success' : 'failed'
    };
  } catch (error) {
    console.error('Error checking transaction confirmation:', error);
    return {
      isConfirmed: false,
      confirmations: 0,
      status: 'pending'
    };
  }
}

/**
 * Monitor pending transactions and update their status
 */
export async function monitorPendingTransactions(): Promise<{
  processed: number;
  confirmed: number;
  failed: number;
}> {
  const pendingTransactions = await prisma.savingsTransaction.findMany({
    where: {
      status: TransactionStatus.PENDING,
      blockchainTxHash: { not: null }
    },
    take: 50 // Process in batches
  });

  let processed = 0;
  let confirmed = 0;
  let failed = 0;

  for (const transaction of pendingTransactions) {
    if (!transaction.blockchainTxHash) continue;

    try {
      const confirmation = await checkTransactionConfirmation(transaction.blockchainTxHash);
      
      if (confirmation.isConfirmed) {
        const newStatus = confirmation.status === 'success' 
          ? TransactionStatus.CONFIRMED 
          : TransactionStatus.FAILED;
        
        await updateTransactionStatus(transaction.id, newStatus);
        
        if (newStatus === TransactionStatus.CONFIRMED) {
          confirmed++;
        } else {
          failed++;
        }
        processed++;
      }
    } catch (error) {
      console.error(`Error processing transaction ${transaction.id}:`, error);
    }
  }

  return { processed, confirmed, failed };
}

/**
 * Estimate gas for a transaction
 */
export async function estimateGas(
  to: string,
  value: string,
  data?: string
): Promise<{
  gasLimit: string;
  gasPrice: string;
  estimatedCost: string;
}> {
  try {
    const provider = getProvider();
    
    const gasLimit = await provider.estimateGas({
      to,
      value: ethers.parseEther(value),
      data: data || '0x'
    });

    const feeData = await provider.getFeeData();
    const gasPrice = feeData.gasPrice || ethers.parseUnits('20', 'gwei');
    
    const estimatedCost = gasLimit * gasPrice;

    return {
      gasLimit: gasLimit.toString(),
      gasPrice: gasPrice.toString(),
      estimatedCost: ethers.formatEther(estimatedCost)
    };
  } catch (error) {
    console.error('Error estimating gas:', error);
    throw new Error('Failed to estimate gas');
  }
}

/**
 * Get current network status
 */
export async function getNetworkStatus(): Promise<{
  chainId: number;
  blockNumber: number;
  gasPrice: string;
  isConnected: boolean;
}> {
  try {
    const provider = getProvider();
    
    const [network, blockNumber, feeData] = await Promise.all([
      provider.getNetwork(),
      provider.getBlockNumber(),
      provider.getFeeData()
    ]);

    return {
      chainId: Number(network.chainId),
      blockNumber,
      gasPrice: ethers.formatUnits(feeData.gasPrice || 0, 'gwei'),
      isConnected: true
    };
  } catch (error) {
    console.error('Error getting network status:', error);
    return {
      chainId: 0,
      blockNumber: 0,
      gasPrice: '0',
      isConnected: false
    };
  }
}

/**
 * Watch for new blocks and process transactions
 */
export function startBlockWatcher(callback?: (blockNumber: number) => void): void {
  const provider = getProvider();
  
  provider.on('block', async (blockNumber) => {
    console.log(`New block: ${blockNumber}`);
    
    // Process pending transactions
    try {
      const result = await monitorPendingTransactions();
      if (result.processed > 0) {
        console.log(`Processed ${result.processed} transactions: ${result.confirmed} confirmed, ${result.failed} failed`);
      }
    } catch (error) {
      console.error('Error processing transactions in block watcher:', error);
    }
    
    if (callback) {
      callback(blockNumber);
    }
  });
}

/**
 * Stop block watcher
 */
export function stopBlockWatcher(): void {
  const provider = getProvider();
  provider.removeAllListeners('block');
}

/**
 * Get transaction history for an address
 */
export async function getAddressTransactionHistory(
  address: string,
  fromBlock: number = 0,
  toBlock: number | 'latest' = 'latest'
): Promise<BlockchainTransaction[]> {
  try {
    const provider = getProvider();
    
    // Note: This is a simplified version. In production, you'd want to use
    // an indexing service or event logs for better performance
    const filter = {
      fromBlock,
      toBlock,
      address
    };

    // This would need to be implemented based on the specific blockchain
    // and available APIs. For now, return empty array
    console.log('Getting transaction history for:', address, filter);
    
    return [];
  } catch (error) {
    console.error('Error getting transaction history:', error);
    return [];
  }
}

/**
 * Validate transaction hash format
 */
export function isValidTransactionHash(hash: string): boolean {
  return /^0x[a-fA-F0-9]{64}$/.test(hash);
}

/**
 * Validate Ethereum address format
 */
export function isValidAddress(address: string): boolean {
  try {
    return ethers.isAddress(address);
  } catch {
    return false;
  }
}

/**
 * Format transaction hash for display
 */
export function formatTransactionHash(hash: string): string {
  if (!hash || hash.length < 10) return hash;
  return `${hash.slice(0, 6)}...${hash.slice(-4)}`;
}

/**
 * Get transaction explorer URL
 */
export function getTransactionExplorerUrl(txHash: string): string {
  const explorerUrl = process.env.MORPH_EXPLORER_URL || 'https://explorer-holesky.morphl2.io';
  return `${explorerUrl}/tx/${txHash}`;
}

/**
 * Get address explorer URL
 */
export function getAddressExplorerUrl(address: string): string {
  const explorerUrl = process.env.MORPH_EXPLORER_URL || 'https://explorer-holesky.morphl2.io';
  return `${explorerUrl}/address/${address}`;
}

/**
 * Batch check multiple transaction confirmations
 */
export async function batchCheckTransactionConfirmations(
  txHashes: string[],
  requiredConfirmations: number = 3
): Promise<Map<string, { isConfirmed: boolean; confirmations: number; status: string }>> {
  const results = new Map();
  
  // Process in batches to avoid rate limiting
  const batchSize = 10;
  for (let i = 0; i < txHashes.length; i += batchSize) {
    const batch = txHashes.slice(i, i + batchSize);
    
    const batchPromises = batch.map(async (txHash) => {
      const result = await checkTransactionConfirmation(txHash, requiredConfirmations);
      return { txHash, result };
    });
    
    const batchResults = await Promise.allSettled(batchPromises);
    
    batchResults.forEach((promiseResult) => {
      if (promiseResult.status === 'fulfilled') {
        const { txHash, result } = promiseResult.value;
        results.set(txHash, result);
      }
    });
    
    // Small delay between batches
    if (i + batchSize < txHashes.length) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }
  
  return results;
}