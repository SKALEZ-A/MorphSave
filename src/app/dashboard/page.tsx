'use client';

import React from 'react';
import { 
  MainLayout,
  SavingsProgressCard,
  BalanceDisplay,
  TransactionHistory,
  QuickActions,
  YieldDisplay
} from '../../components';

export default function DashboardPage() {
  // Mock user data
  const user = {
    id: '1',
    username: 'johndoe',
    profileImage: undefined,
    totalSaved: 1247.50,
    level: 5,
    totalPoints: 2450
  };

  // Mock transaction data
  const mockTransactions = [
    {
      id: '1',
      type: 'roundup' as const,
      amount: 2.50,
      description: 'Coffee Shop Round-up',
      timestamp: new Date('2024-01-15T10:30:00'),
      status: 'confirmed' as const,
      blockchainTxHash: '0x1234567890abcdef1234567890abcdef12345678',
      merchant: 'Starbucks',
      category: 'food'
    },
    {
      id: '2',
      type: 'deposit' as const,
      amount: 50.00,
      description: 'Manual Deposit',
      timestamp: new Date('2024-01-14T15:45:00'),
      status: 'confirmed' as const,
      blockchainTxHash: '0xabcdef1234567890abcdef1234567890abcdef12'
    },
    {
      id: '3',
      type: 'yield' as const,
      amount: 3.25,
      description: 'DeFi Yield Earned',
      timestamp: new Date('2024-01-13T09:15:00'),
      status: 'confirmed' as const,
      blockchainTxHash: '0x567890abcdef1234567890abcdef1234567890ab'
    },
    {
      id: '4',
      type: 'roundup' as const,
      amount: 1.75,
      description: 'Gas Station Round-up',
      timestamp: new Date('2024-01-12T18:20:00'),
      status: 'confirmed' as const,
      merchant: 'Shell',
      category: 'transportation'
    },
    {
      id: '5',
      type: 'withdrawal' as const,
      amount: 25.00,
      description: 'Emergency Withdrawal',
      timestamp: new Date('2024-01-11T14:10:00'),
      status: 'confirmed' as const,
      blockchainTxHash: '0x890abcdef1234567890abcdef1234567890abcde'
    }
  ];

  // Mock yield protocols
  const mockProtocols = [
    {
      name: 'Aave USDC',
      apy: 4.2,
      allocation: 60,
      earned: 15.30,
      risk: 'low' as const,
      status: 'active' as const
    },
    {
      name: 'Compound DAI',
      apy: 3.8,
      allocation: 30,
      earned: 8.75,
      risk: 'low' as const,
      status: 'active' as const
    },
    {
      name: 'Yearn USDT',
      apy: 5.1,
      allocation: 10,
      earned: 2.45,
      risk: 'medium' as const,
      status: 'active' as const
    }
  ];

  // Mock handlers
  const handleDeposit = async (amount: number) => {
    console.log('Deposit:', amount);
    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 1000));
  };

  const handleWithdraw = async (amount: number) => {
    console.log('Withdraw:', amount);
    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 1000));
  };

  const handleSetGoal = async (goal: number) => {
    console.log('Set goal:', goal);
    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 1000));
  };

  const handleViewTransaction = (transaction: any) => {
    console.log('View transaction:', transaction);
  };

  const handleViewBlockchain = (txHash: string) => {
    window.open(`https://explorer-holesky.morphl2.io/tx/${txHash}`, '_blank');
  };

  const handleRefreshBalance = () => {
    console.log('Refreshing balance...');
  };

  return (
    <MainLayout user={user}>
      <div className="space-y-6">
        {/* Welcome Section */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
              Welcome back, {user.username}! 👋
            </h1>
            <p className="text-gray-600 dark:text-gray-400">
              Here's your savings overview for today
            </p>
          </div>
        </div>

        {/* Top Row - Balance and Progress */}
        <div className="grid lg:grid-cols-3 gap-6">
          <div className="lg:col-span-1">
            <BalanceDisplay
              totalBalance={1247.50}
              availableBalance={1200.00}
              yieldEarned={47.50}
              yieldRate={4.2}
              onDeposit={handleDeposit}
              onWithdraw={handleWithdraw}
              onRefresh={handleRefreshBalance}
            />
          </div>
          
          <div className="lg:col-span-1">
            <SavingsProgressCard
              totalSaved={1247.50}
              savingsGoal={2000}
              monthlyTarget={200}
              currentMonthSaved={127.30}
            />
          </div>

          <div className="lg:col-span-1">
            <QuickActions
              onDeposit={handleDeposit}
              onWithdraw={handleWithdraw}
              onSetGoal={handleSetGoal}
              availableBalance={1200.00}
            />
          </div>
        </div>

        {/* Middle Row - Yield and Transaction History */}
        <div className="grid lg:grid-cols-3 gap-6">
          <div className="lg:col-span-1">
            <YieldDisplay
              totalYieldEarned={47.50}
              currentAPY={4.2}
              previousAPY={3.9}
              protocols={mockProtocols}
              totalInvested={1200.00}
              projectedMonthlyYield={4.20}
            />
          </div>
          
          <div className="lg:col-span-2">
            <TransactionHistory
              transactions={mockTransactions}
              onViewTransaction={handleViewTransaction}
              onViewBlockchain={handleViewBlockchain}
              hasMore={true}
            />
          </div>
        </div>
      </div>
    </MainLayout>
  );
}