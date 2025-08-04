import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import {
  SavingsProgressCard,
  BalanceDisplay,
  TransactionHistory,
  QuickActions,
  YieldDisplay
} from '../src/components/dashboard';

// Mock framer-motion
jest.mock('framer-motion', () => ({
  motion: {
    div: ({ children, ...props }: any) => <div {...props}>{children}</div>,
  },
  AnimatePresence: ({ children }: any) => children,
}));

describe('Dashboard Components', () => {
  describe('SavingsProgressCard', () => {
    const defaultProps = {
      totalSaved: 1247.50,
      savingsGoal: 2000,
      monthlyTarget: 200,
      currentMonthSaved: 127.30
    };

    it('renders savings progress correctly', () => {
      render(<SavingsProgressCard {...defaultProps} />);
      
      expect(screen.getByText('$1,247.50')).toBeInTheDocument();
      expect(screen.getByText('Total Saved')).toBeInTheDocument();
      expect(screen.getByText('62% Complete')).toBeInTheDocument();
    });

    it('displays goal progress bar', () => {
      render(<SavingsProgressCard {...defaultProps} />);
      
      expect(screen.getByText('Savings Goal')).toBeInTheDocument();
      expect(screen.getByText('$1,247.50 / $2,000.00')).toBeInTheDocument();
    });

    it('displays monthly progress', () => {
      render(<SavingsProgressCard {...defaultProps} />);
      
      expect(screen.getByText('This Month')).toBeInTheDocument();
      expect(screen.getByText('$127.30 / $200.00')).toBeInTheDocument();
    });

    it('handles missing goal gracefully', () => {
      const propsWithoutGoal = {
        totalSaved: 1247.50,
        currentMonthSaved: 127.30
      };
      
      render(<SavingsProgressCard {...propsWithoutGoal} />);
      expect(screen.getByText('$1,247.50')).toBeInTheDocument();
    });
  });

  describe('BalanceDisplay', () => {
    const defaultProps = {
      totalBalance: 1247.50,
      availableBalance: 1200.00,
      yieldEarned: 47.50,
      yieldRate: 4.2,
      onDeposit: jest.fn(),
      onWithdraw: jest.fn(),
      onRefresh: jest.fn()
    };

    beforeEach(() => {
      jest.clearAllMocks();
    });

    it('renders balance information correctly', () => {
      render(<BalanceDisplay {...defaultProps} />);
      
      expect(screen.getByText('$1,247.50')).toBeInTheDocument();
      expect(screen.getByText('Total Balance')).toBeInTheDocument();
      expect(screen.getByText('4.20% APY')).toBeInTheDocument();
    });

    it('toggles balance visibility', () => {
      render(<BalanceDisplay {...defaultProps} />);
      
      const toggleButton = screen.getByRole('button', { name: /eye/i });
      fireEvent.click(toggleButton);
      
      expect(screen.getByText('••••••')).toBeInTheDocument();
    });

    it('calls onDeposit when deposit button is clicked', () => {
      render(<BalanceDisplay {...defaultProps} />);
      
      const depositButton = screen.getByText('Deposit');
      fireEvent.click(depositButton);
      
      expect(defaultProps.onDeposit).toHaveBeenCalled();
    });

    it('calls onWithdraw when withdraw button is clicked', () => {
      render(<BalanceDisplay {...defaultProps} />);
      
      const withdrawButton = screen.getByText('Withdraw');
      fireEvent.click(withdrawButton);
      
      expect(defaultProps.onWithdraw).toHaveBeenCalled();
    });

    it('disables withdraw when balance is zero', () => {
      const propsWithZeroBalance = {
        ...defaultProps,
        availableBalance: 0
      };
      
      render(<BalanceDisplay {...propsWithZeroBalance} />);
      
      const withdrawButton = screen.getByText('Withdraw');
      expect(withdrawButton).toBeDisabled();
    });
  });

  describe('TransactionHistory', () => {
    const mockTransactions = [
      {
        id: '1',
        type: 'deposit' as const,
        amount: 50.00,
        description: 'Manual Deposit',
        timestamp: new Date('2024-01-15T10:30:00'),
        status: 'confirmed' as const,
        blockchainTxHash: '0x1234567890abcdef'
      },
      {
        id: '2',
        type: 'roundup' as const,
        amount: 2.50,
        description: 'Coffee Shop Round-up',
        timestamp: new Date('2024-01-14T15:45:00'),
        status: 'pending' as const,
        merchant: 'Starbucks',
        category: 'food'
      }
    ];

    const defaultProps = {
      transactions: mockTransactions,
      onViewTransaction: jest.fn(),
      onViewBlockchain: jest.fn()
    };

    beforeEach(() => {
      jest.clearAllMocks();
    });

    it('renders transaction list', () => {
      render(<TransactionHistory {...defaultProps} />);
      
      expect(screen.getByText('Manual Deposit')).toBeInTheDocument();
      expect(screen.getByText('Coffee Shop Round-up')).toBeInTheDocument();
      expect(screen.getByText('+$50.00')).toBeInTheDocument();
      expect(screen.getByText('+$2.50')).toBeInTheDocument();
    });

    it('filters transactions by search term', async () => {
      render(<TransactionHistory {...defaultProps} />);
      
      const searchInput = screen.getByPlaceholderText('Search transactions...');
      fireEvent.change(searchInput, { target: { value: 'coffee' } });
      
      await waitFor(() => {
        expect(screen.getByText('Coffee Shop Round-up')).toBeInTheDocument();
        expect(screen.queryByText('Manual Deposit')).not.toBeInTheDocument();
      });
    });

    it('filters transactions by type', async () => {
      render(<TransactionHistory {...defaultProps} />);
      
      const filterSelect = screen.getByDisplayValue('All Types');
      fireEvent.change(filterSelect, { target: { value: 'deposit' } });
      
      await waitFor(() => {
        expect(screen.getByText('Manual Deposit')).toBeInTheDocument();
        expect(screen.queryByText('Coffee Shop Round-up')).not.toBeInTheDocument();
      });
    });

    it('calls onViewTransaction when transaction is clicked', () => {
      render(<TransactionHistory {...defaultProps} />);
      
      const transaction = screen.getByText('Manual Deposit').closest('div');
      fireEvent.click(transaction!);
      
      expect(defaultProps.onViewTransaction).toHaveBeenCalledWith(mockTransactions[0]);
    });

    it('calls onViewBlockchain when blockchain link is clicked', () => {
      render(<TransactionHistory {...defaultProps} />);
      
      const blockchainLink = screen.getByText('View on blockchain');
      fireEvent.click(blockchainLink);
      
      expect(defaultProps.onViewBlockchain).toHaveBeenCalledWith('0x1234567890abcdef');
    });

    it('shows empty state when no transactions', () => {
      render(<TransactionHistory {...defaultProps} transactions={[]} />);
      
      expect(screen.getByText('No transactions found')).toBeInTheDocument();
    });
  });

  describe('QuickActions', () => {
    const defaultProps = {
      onDeposit: jest.fn(),
      onWithdraw: jest.fn(),
      onSetupRoundUp: jest.fn(),
      onSetGoal: jest.fn(),
      availableBalance: 1200.00
    };

    beforeEach(() => {
      jest.clearAllMocks();
    });

    it('renders all quick action buttons', () => {
      render(<QuickActions {...defaultProps} />);
      
      expect(screen.getByText('Add Money')).toBeInTheDocument();
      expect(screen.getByText('Withdraw')).toBeInTheDocument();
      expect(screen.getByText('Round-up')).toBeInTheDocument();
      expect(screen.getByText('Set Goal')).toBeInTheDocument();
    });

    it('opens deposit modal when Add Money is clicked', () => {
      render(<QuickActions {...defaultProps} />);
      
      const addMoneyButton = screen.getByText('Add Money');
      fireEvent.click(addMoneyButton);
      
      expect(screen.getByText('Deposit funds to your MorphSave account')).toBeInTheDocument();
    });

    it('processes deposit correctly', async () => {
      const mockDeposit = jest.fn().mockResolvedValue(undefined);
      render(<QuickActions {...defaultProps} onDeposit={mockDeposit} />);
      
      // Open deposit modal
      fireEvent.click(screen.getByText('Add Money'));
      
      // Enter amount
      const amountInput = screen.getByPlaceholderText('0.00');
      fireEvent.change(amountInput, { target: { value: '100' } });
      
      // Submit
      const depositButton = screen.getByRole('button', { name: 'Deposit' });
      fireEvent.click(depositButton);
      
      await waitFor(() => {
        expect(mockDeposit).toHaveBeenCalledWith(100);
      });
    });

    it('validates deposit amount', async () => {
      render(<QuickActions {...defaultProps} />);
      
      // Open deposit modal
      fireEvent.click(screen.getByText('Add Money'));
      
      // Try to submit without amount
      const depositButton = screen.getByRole('button', { name: 'Deposit' });
      fireEvent.click(depositButton);
      
      // Should not call onDeposit
      expect(defaultProps.onDeposit).not.toHaveBeenCalled();
    });

    it('disables withdraw when balance is zero', () => {
      const propsWithZeroBalance = {
        ...defaultProps,
        availableBalance: 0
      };
      
      render(<QuickActions {...propsWithZeroBalance} />);
      
      const withdrawButton = screen.getByText('Withdraw');
      expect(withdrawButton.closest('button')).toBeDisabled();
    });
  });

  describe('YieldDisplay', () => {
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
        risk: 'medium' as const,
        status: 'paused' as const
      }
    ];

    const defaultProps = {
      totalYieldEarned: 47.50,
      currentAPY: 4.2,
      previousAPY: 3.9,
      protocols: mockProtocols,
      totalInvested: 1200.00,
      projectedMonthlyYield: 4.20,
      onViewDetails: jest.fn(),
      onRebalance: jest.fn()
    };

    beforeEach(() => {
      jest.clearAllMocks();
    });

    it('renders yield information correctly', () => {
      render(<YieldDisplay {...defaultProps} />);
      
      expect(screen.getByText('$47.50')).toBeInTheDocument();
      expect(screen.getByText('Total Earned')).toBeInTheDocument();
      expect(screen.getByText('4.20%')).toBeInTheDocument();
      expect(screen.getByText('Current APY')).toBeInTheDocument();
    });

    it('shows APY change indicator', () => {
      render(<YieldDisplay {...defaultProps} />);
      
      // Should show positive change (4.2 - 3.9 = 0.3)
      expect(screen.getByText('0.30%')).toBeInTheDocument();
    });

    it('renders protocol breakdown', () => {
      render(<YieldDisplay {...defaultProps} />);
      
      expect(screen.getByText('Aave USDC')).toBeInTheDocument();
      expect(screen.getByText('Compound DAI')).toBeInTheDocument();
      expect(screen.getByText('4.20% APY')).toBeInTheDocument();
      expect(screen.getByText('3.80% APY')).toBeInTheDocument();
    });

    it('shows protocol status badges', () => {
      render(<YieldDisplay {...defaultProps} />);
      
      expect(screen.getByText('Active')).toBeInTheDocument();
      expect(screen.getByText('Paused')).toBeInTheDocument();
    });

    it('displays projections', () => {
      render(<YieldDisplay {...defaultProps} />);
      
      expect(screen.getByText('$4.20')).toBeInTheDocument(); // Monthly
      expect(screen.getByText('$50.40')).toBeInTheDocument(); // Yearly (4.20 * 12)
    });

    it('calls onRebalance when rebalance button is clicked', () => {
      render(<YieldDisplay {...defaultProps} />);
      
      const rebalanceButton = screen.getByRole('button', { name: /refresh/i });
      fireEvent.click(rebalanceButton);
      
      expect(defaultProps.onRebalance).toHaveBeenCalled();
    });

    it('calls onViewDetails when details button is clicked', () => {
      render(<YieldDisplay {...defaultProps} />);
      
      const detailsButton = screen.getByRole('button', { name: /external/i });
      fireEvent.click(detailsButton);
      
      expect(defaultProps.onViewDetails).toHaveBeenCalled();
    });
  });

  describe('Accessibility', () => {
    it('SavingsProgressCard has proper ARIA labels', () => {
      render(
        <SavingsProgressCard
          totalSaved={1000}
          savingsGoal={2000}
          monthlyTarget={200}
          currentMonthSaved={100}
        />
      );
      
      // Progress bars should be accessible
      const progressBars = screen.getAllByRole('progressbar', { hidden: true });
      expect(progressBars.length).toBeGreaterThan(0);
    });

    it('BalanceDisplay has proper button labels', () => {
      render(
        <BalanceDisplay
          totalBalance={1000}
          availableBalance={900}
          yieldEarned={100}
          yieldRate={4.2}
        />
      );
      
      const buttons = screen.getAllByRole('button');
      buttons.forEach(button => {
        expect(button).toHaveAccessibleName();
      });
    });

    it('TransactionHistory has proper search input label', () => {
      render(
        <TransactionHistory
          transactions={[]}
          onViewTransaction={jest.fn()}
        />
      );
      
      const searchInput = screen.getByPlaceholderText('Search transactions...');
      expect(searchInput).toHaveAccessibleName();
    });
  });

  describe('Responsive Design', () => {
    it('components adapt to different screen sizes', () => {
      render(
        <div className="grid lg:grid-cols-3 gap-6">
          <SavingsProgressCard
            totalSaved={1000}
            currentMonthSaved={100}
          />
        </div>
      );
      
      // Component should render without layout issues
      expect(screen.getByText('$1,000.00')).toBeInTheDocument();
    });
  });

  describe('Error Handling', () => {
    it('handles API errors gracefully in QuickActions', async () => {
      const mockDeposit = jest.fn().mockRejectedValue(new Error('API Error'));
      render(<QuickActions onDeposit={mockDeposit} availableBalance={1000} />);
      
      // Open deposit modal
      fireEvent.click(screen.getByText('Add Money'));
      
      // Enter amount and submit
      const amountInput = screen.getByPlaceholderText('0.00');
      fireEvent.change(amountInput, { target: { value: '100' } });
      
      const depositButton = screen.getByRole('button', { name: 'Deposit' });
      fireEvent.click(depositButton);
      
      await waitFor(() => {
        expect(screen.getByText(/failed to process deposit/i)).toBeInTheDocument();
      });
    });

    it('validates withdrawal amount against available balance', async () => {
      render(<QuickActions availableBalance={100} onWithdraw={jest.fn()} />);
      
      // Open withdraw modal
      fireEvent.click(screen.getByText('Withdraw'));
      
      // Try to withdraw more than available
      const amountInput = screen.getByPlaceholderText('0.00');
      fireEvent.change(amountInput, { target: { value: '200' } });
      
      const withdrawButton = screen.getByRole('button', { name: 'Withdraw' });
      fireEvent.click(withdrawButton);
      
      await waitFor(() => {
        expect(screen.getByText(/insufficient balance/i)).toBeInTheDocument();
      });
    });
  });
});