import { prisma } from './prisma';
import { BankAccount, AccountType } from '@prisma/client';
import { encrypt, decrypt } from '../utils/encryption';

export interface CreateBankAccountInput {
  userId: string;
  plaidAccountId?: string;
  accountName: string;
  accountType: AccountType;
  bankName: string;
  accountNumber: string; // Will be encrypted
  routingNumber?: string; // Will be encrypted
  balance?: number;
  currency?: string;
}

export interface UpdateBankAccountInput {
  accountName?: string;
  balance?: number;
  isActive?: boolean;
  isVerified?: boolean;
}

export interface BankAccountWithDecryptedInfo extends Omit<BankAccount, 'accountNumber' | 'routingNumber'> {
  accountNumber: string; // Decrypted
  routingNumber?: string; // Decrypted
}

/**
 * Create a new bank account
 */
export async function createBankAccount(
  input: CreateBankAccountInput
): Promise<BankAccount> {
  // Check if user already has this account (by Plaid ID or account number)
  if (input.plaidAccountId) {
    const existingAccount = await prisma.bankAccount.findUnique({
      where: { plaidAccountId: input.plaidAccountId }
    });
    
    if (existingAccount) {
      throw new Error('Bank account already connected');
    }
  }

  // Encrypt sensitive information
  const encryptedAccountNumber = encrypt(input.accountNumber);
  const encryptedRoutingNumber = input.routingNumber ? encrypt(input.routingNumber) : null;

  return prisma.bankAccount.create({
    data: {
      userId: input.userId,
      plaidAccountId: input.plaidAccountId,
      accountName: input.accountName,
      accountType: input.accountType,
      bankName: input.bankName,
      accountNumber: encryptedAccountNumber,
      routingNumber: encryptedRoutingNumber,
      balance: input.balance,
      currency: input.currency || 'USD'
    }
  });
}

/**
 * Get bank account by ID
 */
export async function getBankAccountById(id: string): Promise<BankAccount | null> {
  return prisma.bankAccount.findUnique({
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
 * Get bank account with decrypted sensitive information (admin only)
 */
export async function getBankAccountWithDecryptedInfo(
  id: string
): Promise<BankAccountWithDecryptedInfo | null> {
  const account = await prisma.bankAccount.findUnique({
    where: { id }
  });

  if (!account) return null;

  return {
    ...account,
    accountNumber: decrypt(account.accountNumber),
    routingNumber: account.routingNumber ? decrypt(account.routingNumber) : undefined
  };
}

/**
 * Get user's bank accounts
 */
export async function getUserBankAccounts(
  userId: string,
  includeInactive: boolean = false
): Promise<BankAccount[]> {
  return prisma.bankAccount.findMany({
    where: {
      userId,
      ...(includeInactive ? {} : { isActive: true })
    },
    orderBy: [
      { isVerified: 'desc' },
      { createdAt: 'desc' }
    ]
  });
}

/**
 * Update bank account
 */
export async function updateBankAccount(
  id: string,
  input: UpdateBankAccountInput
): Promise<BankAccount> {
  return prisma.bankAccount.update({
    where: { id },
    data: {
      ...input,
      updatedAt: new Date()
    }
  });
}

/**
 * Verify bank account
 */
export async function verifyBankAccount(id: string): Promise<BankAccount> {
  return prisma.bankAccount.update({
    where: { id },
    data: {
      isVerified: true,
      updatedAt: new Date()
    }
  });
}

/**
 * Deactivate bank account
 */
export async function deactivateBankAccount(id: string): Promise<BankAccount> {
  return prisma.bankAccount.update({
    where: { id },
    data: {
      isActive: false,
      updatedAt: new Date()
    }
  });
}

/**
 * Update account balance
 */
export async function updateAccountBalance(
  id: string,
  balance: number
): Promise<BankAccount> {
  return prisma.bankAccount.update({
    where: { id },
    data: {
      balance,
      updatedAt: new Date()
    }
  });
}

/**
 * Get bank account by Plaid account ID
 */
export async function getBankAccountByPlaidId(
  plaidAccountId: string
): Promise<BankAccount | null> {
  return prisma.bankAccount.findUnique({
    where: { plaidAccountId }
  });
}

/**
 * Get user's primary bank account (first verified, then first active)
 */
export async function getUserPrimaryBankAccount(
  userId: string
): Promise<BankAccount | null> {
  // First try to get verified account
  let account = await prisma.bankAccount.findFirst({
    where: {
      userId,
      isActive: true,
      isVerified: true
    },
    orderBy: { createdAt: 'asc' }
  });

  // If no verified account, get first active account
  if (!account) {
    account = await prisma.bankAccount.findFirst({
      where: {
        userId,
        isActive: true
      },
      orderBy: { createdAt: 'asc' }
    });
  }

  return account;
}

/**
 * Get bank accounts summary for user
 */
export async function getUserBankAccountsSummary(userId: string) {
  const accounts = await getUserBankAccounts(userId, true);
  
  const summary = {
    totalAccounts: accounts.length,
    activeAccounts: accounts.filter(a => a.isActive).length,
    verifiedAccounts: accounts.filter(a => a.isVerified).length,
    totalBalance: accounts
      .filter(a => a.isActive && a.balance !== null)
      .reduce((sum, a) => sum + (a.balance || 0), 0),
    accountTypes: accounts.reduce((acc, a) => {
      acc[a.accountType] = (acc[a.accountType] || 0) + 1;
      return acc;
    }, {} as Record<AccountType, number>),
    banks: [...new Set(accounts.map(a => a.bankName))]
  };

  return summary;
}

/**
 * Check if user can add more bank accounts
 */
export async function canUserAddBankAccount(
  userId: string,
  maxAccounts: number = 5
): Promise<boolean> {
  const accountCount = await prisma.bankAccount.count({
    where: {
      userId,
      isActive: true
    }
  });

  return accountCount < maxAccounts;
}

/**
 * Sync account balances (for Plaid integration)
 */
export async function syncAccountBalances(
  plaidAccountBalances: Array<{
    plaidAccountId: string;
    balance: number;
  }>
): Promise<number> {
  let updatedCount = 0;

  for (const { plaidAccountId, balance } of plaidAccountBalances) {
    const account = await getBankAccountByPlaidId(plaidAccountId);
    if (account) {
      await updateAccountBalance(account.id, balance);
      updatedCount++;
    }
  }

  return updatedCount;
}

/**
 * Get accounts that need balance updates (haven't been updated recently)
 */
export async function getAccountsNeedingBalanceUpdate(
  hoursOld: number = 24
): Promise<BankAccount[]> {
  const cutoffTime = new Date();
  cutoffTime.setHours(cutoffTime.getHours() - hoursOld);

  return prisma.bankAccount.findMany({
    where: {
      isActive: true,
      isVerified: true,
      plaidAccountId: { not: null },
      updatedAt: { lt: cutoffTime }
    },
    include: {
      user: {
        select: {
          id: true,
          username: true
        }
      }
    }
  });
}

/**
 * Delete bank account (hard delete - use with caution)
 */
export async function deleteBankAccount(id: string): Promise<BankAccount> {
  // First deactivate, then delete
  await deactivateBankAccount(id);
  
  return prisma.bankAccount.delete({
    where: { id }
  });
}

/**
 * Get bank account statistics
 */
export async function getBankAccountStats() {
  const [
    totalAccounts,
    activeAccounts,
    verifiedAccounts,
    accountsByType,
    accountsByBank
  ] = await Promise.all([
    prisma.bankAccount.count(),
    prisma.bankAccount.count({ where: { isActive: true } }),
    prisma.bankAccount.count({ where: { isVerified: true } }),
    
    prisma.bankAccount.groupBy({
      by: ['accountType'],
      _count: { id: true },
      where: { isActive: true }
    }),
    
    prisma.bankAccount.groupBy({
      by: ['bankName'],
      _count: { id: true },
      where: { isActive: true },
      orderBy: { _count: { id: 'desc' } },
      take: 10
    })
  ]);

  return {
    totalAccounts,
    activeAccounts,
    verifiedAccounts,
    verificationRate: totalAccounts > 0 ? (verifiedAccounts / totalAccounts) * 100 : 0,
    accountsByType: accountsByType.reduce((acc, item) => {
      acc[item.accountType] = item._count.id;
      return acc;
    }, {} as Record<AccountType, number>),
    topBanks: accountsByBank.map(item => ({
      bankName: item.bankName,
      count: item._count.id
    }))
  };
}