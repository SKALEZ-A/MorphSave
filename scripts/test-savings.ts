const { createUser } = require('../lib/db/user');
const { 
  createSavingsTransaction,
  processRoundUp,
  getUserTransactions,
  getUserSavingsSummary,
  getUserTransactionStats
} = require('../lib/db/savings');
const { 
  createBankAccount,
  getUserBankAccounts
} = require('../lib/db/bankAccount');

async function testSavingsAndTransactions() {
  console.log('🧪 Testing savings and transaction functions...');

  try {
    // Create test user
    console.log('Creating test user...');
    const user = await createUser({
      email: 'savings-test@morphsave.com',
      username: 'savings_tester',
      firstName: 'Savings',
      lastName: 'Tester',
      walletAddress: '0x9876543210987654321098765432109876543210',
      privateKeyEncrypted: 'encrypted_savings_key'
    });
    console.log('✅ User created:', user.username);

    // Create bank account
    console.log('Creating bank account...');
    const bankAccount = await createBankAccount({
      userId: user.id,
      accountName: 'Test Checking Account',
      accountType: 'CHECKING',
      bankName: 'Test Bank',
      accountNumber: '1234567890',
      routingNumber: '021000021',
      balance: 2500.00
    });
    console.log('✅ Bank account created:', bankAccount.accountName);

    // Test round-up processing
    console.log('Processing round-up transactions...');
    const roundUp1 = await processRoundUp(user.id, 23.67, 'Starbucks', 'Food');
    const roundUp2 = await processRoundUp(user.id, 45.23, 'Amazon', 'Shopping');
    const roundUp3 = await processRoundUp(user.id, 12.89, 'Uber', 'Transportation');
    
    console.log('✅ Round-ups processed:', {
      starbucks: `$${roundUp1.amount} (from $${roundUp1.originalTransactionAmount})`,
      amazon: `$${roundUp2.amount} (from $${roundUp2.originalTransactionAmount})`,
      uber: `$${roundUp3.amount} (from $${roundUp3.originalTransactionAmount})`
    });

    // Create manual savings transaction
    console.log('Creating manual savings...');
    const manualSaving = await createSavingsTransaction({
      userId: user.id,
      type: 'MANUAL',
      amount: 100.00,
      status: 'CONFIRMED'
    });
    console.log('✅ Manual saving created:', `$${manualSaving.amount}`);

    // Create yield transaction
    console.log('Creating yield transaction...');
    const yieldTransaction = await createSavingsTransaction({
      userId: user.id,
      type: 'YIELD',
      amount: 5.25,
      yieldProtocol: 'Compound',
      apy: 4.5,
      status: 'CONFIRMED'
    });
    console.log('✅ Yield transaction created:', `$${yieldTransaction.amount} from ${yieldTransaction.yieldProtocol}`);

    // Get user transactions
    console.log('Retrieving user transactions...');
    const transactions = await getUserTransactions(user.id, {}, 1, 10);
    console.log('✅ Transactions retrieved:', {
      total: transactions.total,
      showing: transactions.transactions.length,
      hasMore: transactions.hasMore
    });

    // Get transaction statistics
    console.log('Calculating transaction statistics...');
    const stats = await getUserTransactionStats(user.id);
    console.log('✅ Transaction stats:', {
      totalAmount: `$${stats.totalAmount.toFixed(2)}`,
      totalTransactions: stats.totalTransactions,
      averageAmount: `$${stats.averageAmount.toFixed(2)}`,
      roundUpCount: stats.byType.ROUNDUP?.count || 0,
      manualCount: stats.byType.MANUAL?.count || 0
    });

    // Get savings summary
    console.log('Getting savings summary...');
    const summary = await getUserSavingsSummary(user.id);
    console.log('✅ Savings summary:', {
      currentBalance: `$${summary.currentBalance.toFixed(2)}`,
      totalSaved: `$${summary.totalSaved.toFixed(2)}`,
      totalYield: `$${summary.totalYield.toFixed(2)}`,
      recentTransactions: summary.recentTransactions.length
    });

    // Get bank accounts
    console.log('Retrieving bank accounts...');
    const bankAccounts = await getUserBankAccounts(user.id);
    console.log('✅ Bank accounts retrieved:', {
      count: bankAccounts.length,
      accounts: bankAccounts.map(acc => ({
        name: acc.accountName,
        type: acc.accountType,
        bank: acc.bankName,
        verified: acc.isVerified
      }))
    });

    console.log('\n🎉 All savings and transaction tests passed!');

  } catch (error) {
    console.error('❌ Savings test failed:', error);
  }
}

testSavingsAndTransactions()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });