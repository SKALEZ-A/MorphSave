import { aiInsightsService } from '../lib/ai/insights';
import { prisma } from '../lib/db/prisma';
import { TransactionType, TransactionStatus } from '@prisma/client';

async function testAIInsights() {
  console.log('🤖 Testing AI Insights Service...\n');

  try {
    // Create a test user if not exists
    let testUser = await prisma.user.findFirst({
      where: { email: 'test@morphsave.com' }
    });

    if (!testUser) {
      testUser = await prisma.user.create({
        data: {
          email: 'test@morphsave.com',
          username: 'testuser',
          walletAddress: '0x1234567890123456789012345678901234567890',
          privateKeyEncrypted: 'encrypted_key_here',
          totalSaved: 250.75,
          savingsGoal: 1000,
          monthlyTarget: 100,
          roundUpEnabled: true,
          autoInvestEnabled: true
        }
      });
      console.log('✅ Created test user:', testUser.id);
    }

    // Create sample transactions for testing
    const sampleTransactions = [
      {
        userId: testUser.id,
        type: TransactionType.ROUNDUP,
        amount: 0.45,
        originalTransactionAmount: 15.55,
        merchant: 'Starbucks',
        category: 'Food & Dining',
        status: TransactionStatus.CONFIRMED,
        createdAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) // 30 days ago
      },
      {
        userId: testUser.id,
        type: TransactionType.ROUNDUP,
        amount: 0.25,
        originalTransactionAmount: 8.75,
        merchant: 'McDonald\'s',
        category: 'Food & Dining',
        status: TransactionStatus.CONFIRMED,
        createdAt: new Date(Date.now() - 25 * 24 * 60 * 60 * 1000)
      },
      {
        userId: testUser.id,
        type: TransactionType.ROUNDUP,
        amount: 0.80,
        originalTransactionAmount: 45.20,
        merchant: 'Shell Gas Station',
        category: 'Transportation',
        status: TransactionStatus.CONFIRMED,
        createdAt: new Date(Date.now() - 20 * 24 * 60 * 60 * 1000)
      },
      {
        userId: testUser.id,
        type: TransactionType.ROUNDUP,
        amount: 0.35,
        originalTransactionAmount: 12.65,
        merchant: 'Target',
        category: 'Shopping',
        status: TransactionStatus.CONFIRMED,
        createdAt: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000)
      },
      {
        userId: testUser.id,
        type: TransactionType.ROUNDUP,
        amount: 0.90,
        originalTransactionAmount: 67.10,
        merchant: 'Whole Foods',
        category: 'Groceries',
        status: TransactionStatus.CONFIRMED,
        createdAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000)
      },
      {
        userId: testUser.id,
        type: TransactionType.MANUAL,
        amount: 50.00,
        status: TransactionStatus.CONFIRMED,
        createdAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000)
      }
    ];

    // Clear existing test transactions
    await prisma.savingsTransaction.deleteMany({
      where: { userId: testUser.id }
    });

    // Create new test transactions
    for (const transaction of sampleTransactions) {
      await prisma.savingsTransaction.create({ data: transaction });
    }
    console.log('✅ Created sample transactions\n');

    // Test 1: Spending Analysis
    console.log('📊 Testing Spending Analysis...');
    const transactions = await prisma.savingsTransaction.findMany({
      where: { userId: testUser.id }
    });

    const analysis = await aiInsightsService.analyzeSpending(testUser.id, transactions);
    console.log('Analysis Results:');
    console.log(`- Total Spent: $${analysis.totalSpent.toFixed(2)}`);
    console.log(`- Average Transaction: $${analysis.averageTransactionAmount.toFixed(2)}`);
    console.log(`- Spending Velocity: ${analysis.spendingVelocity}`);
    console.log(`- Top Categories:`, analysis.categoryBreakdown.slice(0, 3).map(c => 
      `${c.category}: $${c.amount.toFixed(2)} (${c.percentage.toFixed(1)}%)`
    ));
    console.log(`- Insights: ${analysis.insights.length} generated`);
    analysis.insights.forEach((insight, i) => console.log(`  ${i + 1}. ${insight}`));
    console.log('');

    // Test 2: Recommendations
    console.log('💡 Testing Recommendations...');
    const recommendations = await aiInsightsService.generateRecommendations(testUser.id);
    console.log(`Generated ${recommendations.length} recommendations:`);
    recommendations.forEach((rec, i) => {
      console.log(`  ${i + 1}. [${rec.type}] ${rec.title}`);
      console.log(`     ${rec.description}`);
      console.log(`     Impact: ${rec.impact}, Actionable: ${rec.actionable}`);
      if (rec.estimatedSavings) {
        console.log(`     Estimated Savings: $${rec.estimatedSavings}`);
      }
    });
    console.log('');

    // Test 3: Savings Projections
    console.log('📈 Testing Savings Projections...');
    const projections = await aiInsightsService.predictSavingsGoals(testUser.id);
    console.log('Projection Results:');
    console.log(`- Current Savings Rate: $${projections.currentSavingsRate.toFixed(2)}/day`);
    console.log(`- Projected Monthly: $${projections.projectedMonthly.toFixed(2)}`);
    console.log(`- Projected Yearly: $${projections.projectedYearly.toFixed(2)}`);
    console.log(`- Goal Achievement: ${projections.goalAchievementDate ? projections.goalAchievementDate.toDateString() : 'No goal set'}`);
    console.log(`- Confidence Level: ${(projections.confidenceLevel * 100).toFixed(1)}%`);
    console.log('- Recommended Adjustments:');
    projections.recommendedAdjustments.forEach((adj, i) => console.log(`  ${i + 1}. ${adj}`));
    console.log('');

    // Test 4: Anomaly Detection
    console.log('🚨 Testing Anomaly Detection...');
    
    // Create an unusual transaction for testing
    const unusualTransaction = await prisma.savingsTransaction.create({
      data: {
        userId: testUser.id,
        type: TransactionType.ROUNDUP,
        amount: 0.50,
        originalTransactionAmount: 500.00, // Unusually large
        merchant: 'Expensive Electronics Store',
        category: 'Shopping',
        status: TransactionStatus.CONFIRMED,
        createdAt: new Date()
      }
    });

    const anomaly = await aiInsightsService.detectAnomalies(testUser.id, unusualTransaction);
    if (anomaly) {
      console.log('Anomaly Detected:');
      console.log(`- Type: ${anomaly.type}`);
      console.log(`- Severity: ${anomaly.severity}`);
      console.log(`- Description: ${anomaly.description}`);
      console.log(`- Recommendation: ${anomaly.recommendation}`);
      if (anomaly.amount) console.log(`- Amount: $${anomaly.amount}`);
      if (anomaly.merchant) console.log(`- Merchant: ${anomaly.merchant}`);
    } else {
      console.log('No anomalies detected');
    }
    console.log('');

    // Test normal transaction (should not trigger anomaly)
    const normalTransaction = await prisma.savingsTransaction.create({
      data: {
        userId: testUser.id,
        type: TransactionType.ROUNDUP,
        amount: 0.35,
        originalTransactionAmount: 12.65,
        merchant: 'Target',
        category: 'Shopping',
        status: TransactionStatus.CONFIRMED,
        createdAt: new Date()
      }
    });

    const normalAnomaly = await aiInsightsService.detectAnomalies(testUser.id, normalTransaction);
    console.log(`Normal transaction anomaly check: ${normalAnomaly ? 'Anomaly detected' : 'No anomaly (expected)'}`);

    console.log('\n✅ All AI Insights tests completed successfully!');

  } catch (error) {
    console.error('❌ Error testing AI insights:', error);
    throw error;
  }
}

// Run the test if this script is executed directly
if (require.main === module) {
  testAIInsights()
    .then(() => {
      console.log('\n🎉 AI Insights testing completed!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n💥 AI Insights testing failed:', error);
      process.exit(1);
    });
}

export { testAIInsights };