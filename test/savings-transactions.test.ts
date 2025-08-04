const { PrismaClient } = require('@prisma/client');
const { 
  createSavingsTransaction,
  processRoundUp,
  getUserTransactions,
  updateTransactionStatus,
  getUserTransactionStats,
  getUserSavingsSummary
} = require('../lib/db/savings');
const { 
  createBankAccount,
  getUserBankAccounts,
  verifyBankAccount
} = require('../lib/db/bankAccount');
const { createUser } = require('../lib/db/user');

const prisma = new PrismaClient();

describe('Savings and Transactions', () => {
  let testUser;

  beforeEach(async () => {
    // Clean up test data
    await prisma.savingsTransaction.deleteMany();
    await prisma.bankAccount.deleteMany();
    await prisma.user.deleteMany();

    // Create test user
    testUser = await createUser({
      email: 'savings@test.com',
      username: 'savings_user',
      walletAddress: '0x1234567890123456789012345678901234567890',
      privateKeyEncrypted: 'encrypted_key'
    });
  });

  afterEach(async () => {
    // Clean up test data
    await prisma.savingsTransaction.deleteMany();
    await prisma.bankAccount.deleteMany();
    await prisma.user.deleteMany();
  });

  describe('Savings Transactions', () => {
    it('should create a savings transaction', async () => {
      const transactionData = {
        userId: testUser.id,
        type: 'MANUAL',
        amount: 100.50,
        status: 'CONFIRMED'
      };

      const transaction = await createSavingsTransaction(transactionData);

      expect(transaction.userId).toBe(testUser.id);
      expect(transaction.type).toBe('MANUAL');
      expect(transaction.amount).toBe(100.50);
      expect(transaction.status).toBe('CONFIRMED');
    });

    it('should process round-up transactions', async () => {
      const originalAmount = 23.67;
      const merchant = 'Starbucks';
      const category = 'Food';

      const roundUpTransaction = await processRoundUp(
        testUser.id,
        originalAmount,
        merchant,
        category
      );

      expect(roundUpTransaction.type).toBe('ROUNDUP');
      expect(roundUpTransaction.amount).toBe(0.33); // Round up to $24.00
      expect(roundUpTransaction.originalTransactionAmount).toBe(originalAmount);
      expect(roundUpTransaction.merchant).toBe(merchant);
      expect(roundUpTransaction.category).toBe(category);
    });

    it('should get user transactions with pagination', async () => {
      // Create multiple transactions
      for (let i = 0; i < 15; i++) {
        await createSavingsTransaction({
          userId: testUser.id,
          type: 'ROUNDUP',
          amount: Math.random() * 5 + 0.5,
          status: 'CONFIRMED'
        });
      }

      const result = await getUserTransactions(testUser.id, {}, 1, 10);

      expect(result.transactions.length).toBe(10);
      expect(result.total).toBe(15);
      expect(result.hasMore).toBe(true);
    });

    it('should update transaction status', async () => {
      const transaction = await createSavingsTransaction({
        userId: testUser.id,
        type: 'MANUAL',
        amount: 50,
        status: 'PENDING'
      });

      const updatedTransaction = await updateTransactionStatus(
        transaction.id,
        'CONFIRMED',
        '0xabcdef123456789'
      );

      expect(updatedTransaction.status).toBe('CONFIRMED');
      expect(updatedTransaction.blockchainTxHash).toBe('0xabcdef123456789');
    });

    it('should calculate user transaction statistics', async () => {
      // Create various types of transactions
      await createSavingsTransaction({
        userId: testUser.id,
        type: 'ROUNDUP',
        amount: 2.50,
        category: 'Food',
        status: 'CONFIRMED'
      });

      await createSavingsTransaction({
        userId: testUser.id,
        type: 'MANUAL',
        amount: 100,
        status: 'CONFIRMED'
      });

      await createSavingsTransaction({
        userId: testUser.id,
        type: 'ROUNDUP',
        amount: 1.75,
        category: 'Transportation',
        status: 'CONFIRMED'
      });

      const stats = await getUserTransactionStats(testUser.id);

      expect(stats.totalAmount).toBe(104.25);
      expect(stats.totalTransactions).toBe(3);
      expect(stats.byType.ROUNDUP.count).toBe(2);
      expect(stats.byType.MANUAL.count).toBe(1);
      expect(stats.byCategory.Food.amount).toBe(2.50);
    });

    it('should get user savings summary', async () => {
      // Create savings transactions
      await createSavingsTransaction({
        userId: testUser.id,
        type: 'ROUNDUP',
        amount: 25.50,
        status: 'CONFIRMED'
      });

      await createSavingsTransaction({
        userId: testUser.id,
        type: 'YIELD',
        amount: 5.25,
        status: 'CONFIRMED'
      });

      await createSavingsTransaction({
        userId: testUser.id,
        type: 'WITHDRAWAL',
        amount: 10.00,
        status: 'CONFIRMED'
      });

      const summary = await getUserSavingsSummary(testUser.id);

      expect(summary.totalSaved).toBe(25.50);
      expect(summary.totalYield).toBe(5.25);
      expect(summary.totalWithdrawn).toBe(10.00);
      expect(summary.currentBalance).toBe(20.75); // 25.50 + 5.25 - 10.00
    });
  });

  describe('Bank Accounts', () => {
    it('should create a bank account', async () => {
      const accountData = {
        userId: testUser.id,
        accountName: 'My Checking',
        accountType: 'CHECKING',
        bankName: 'Test Bank',
        accountNumber: '1234567890',
        routingNumber: '021000021',
        balance: 1500.00
      };

      const account = await createBankAccount(accountData);

      expect(account.userId).toBe(testUser.id);
      expect(account.accountName).toBe('My Checking');
      expect(account.accountType).toBe('CHECKING');
      expect(account.bankName).toBe('Test Bank');
      expect(account.balance).toBe(1500.00);
      // Account number should be encrypted
      expect(account.accountNumber).not.toBe('1234567890');
    });

    it('should get user bank accounts', async () => {
      // Create multiple accounts
      await createBankAccount({
        userId: testUser.id,
        accountName: 'Checking',
        accountType: 'CHECKING',
        bankName: 'Bank A',
        accountNumber: '1111111111'
      });

      await createBankAccount({
        userId: testUser.id,
        accountName: 'Savings',
        accountType: 'SAVINGS',
        bankName: 'Bank B',
        accountNumber: '2222222222'
      });

      const accounts = await getUserBankAccounts(testUser.id);

      expect(accounts.length).toBe(2);
      expect(accounts.some(a => a.accountName === 'Checking')).toBe(true);
      expect(accounts.some(a => a.accountName === 'Savings')).toBe(true);
    });

    it('should verify bank account', async () => {
      const account = await createBankAccount({
        userId: testUser.id,
        accountName: 'Test Account',
        accountType: 'CHECKING',
        bankName: 'Test Bank',
        accountNumber: '1234567890'
      });

      expect(account.isVerified).toBe(false);

      const verifiedAccount = await verifyBankAccount(account.id);

      expect(verifiedAccount.isVerified).toBe(true);
    });

    it('should prevent duplicate Plaid accounts', async () => {
      const accountData = {
        userId: testUser.id,
        plaidAccountId: 'plaid_123',
        accountName: 'Plaid Account',
        accountType: 'CHECKING',
        bankName: 'Plaid Bank',
        accountNumber: '1234567890'
      };

      await createBankAccount(accountData);

      await expect(createBankAccount(accountData))
        .rejects.toThrow('Bank account already connected');
    });
  });

  describe('Integration Tests', () => {
    it('should update user total saved when transaction is confirmed', async () => {
      // Create pending transaction
      const transaction = await createSavingsTransaction({
        userId: testUser.id,
        type: 'ROUNDUP',
        amount: 5.50,
        status: 'PENDING'
      });

      // Confirm transaction
      await updateTransactionStatus(transaction.id, 'CONFIRMED');

      // Check user's updated total
      const updatedUser = await prisma.user.findUnique({
        where: { id: testUser.id }
      });

      expect(updatedUser.totalSaved).toBe(5.50);
    });

    it('should handle multiple transaction types in savings summary', async () => {
      // Create various transaction types
      const transactions = [
        { type: 'ROUNDUP', amount: 10.25, status: 'CONFIRMED' },
        { type: 'MANUAL', amount: 50.00, status: 'CONFIRMED' },
        { type: 'DEPOSIT', amount: 25.75, status: 'CONFIRMED' },
        { type: 'YIELD', amount: 3.50, status: 'CONFIRMED' },
        { type: 'WITHDRAWAL', amount: 15.00, status: 'CONFIRMED' },
        { type: 'ROUNDUP', amount: 2.25, status: 'PENDING' } // Should not count
      ];

      for (const txData of transactions) {
        await createSavingsTransaction({
          userId: testUser.id,
          ...txData
        });
      }

      const summary = await getUserSavingsSummary(testUser.id);

      expect(summary.totalSaved).toBe(86.00); // 10.25 + 50.00 + 25.75
      expect(summary.totalYield).toBe(3.50);
      expect(summary.totalWithdrawn).toBe(15.00);
      expect(summary.currentBalance).toBe(74.50); // 86.00 + 3.50 - 15.00
    });
  });
});

// Clean up after all tests
afterAll(async () => {
  await prisma.$disconnect();
});