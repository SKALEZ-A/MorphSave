import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { InsightsPanel } from '../src/components/insights/InsightsPanel';
import { SpendingAnalysisChart } from '../src/components/insights/SpendingAnalysisChart';
import { RecommendationsCard } from '../src/components/insights/RecommendationsCard';
import { SavingsProjectionCard } from '../src/components/insights/SavingsProjectionCard';
import { CategoryBredownChart } from '../src/components/insights/CategoryBreakdownChart';
import { TrendAnalysisChart } from '../src/components/insights/TrendAnalysisChart';

// Mock fetch globally
global.fetch = jest.fn();

const mockSpendingAnalysis = {
  totalSpent: 1250.75,
  categoryBreakdown: [
    {
      category: 'Food & Dining',
      amount: 450.25,
      percentage: 36.0,
      transactionCount: 25,
      averageAmount: 18.01
    },
    {
      category: 'Transportation',
      amount: 320.50,
      percentage: 25.6,
      transactionCount: 15,
      averageAmount: 21.37
    },
    {
      category: 'Shopping',
      amount: 280.00,
      percentage: 22.4,
      transactionCount: 12,
      averageAmount: 23.33
    }
  ],
  monthlyTrend: [
    {
      month: '2024-01',
      amount: 400.00,
      transactionCount: 20,
      savingsAmount: 15.50
    },
    {
      month: '2024-02',
      amount: 425.25,
      transactionCount: 22,
      savingsAmount: 18.75
    },
    {
      month: '2024-03',
      amount: 425.50,
      transactionCount: 24,
      savingsAmount: 20.25
    }
  ],
  topMerchants: [
    {
      merchant: 'Starbucks',
      amount: 125.50,
      transactionCount: 8,
      category: 'Food & Dining'
    },
    {
      merchant: 'Uber',
      amount: 95.75,
      transactionCount: 6,
      category: 'Transportation'
    }
  ],
  averageTransactionAmount: 24.52,
  spendingVelocity: 'increasing' as const,
  insights: [
    'Your spending on Food & Dining represents 36% of your total expenses.',
    'Transportation costs have increased by 15% this month.',
    'Consider setting a monthly budget for discretionary spending.'
  ]
};

const mockRecommendations = [
  {
    id: '1',
    type: 'savings_opportunity' as const,
    title: 'Reduce Coffee Spending',
    description: 'You spend $125 monthly on coffee. Consider brewing at home to save $75/month.',
    impact: 'medium' as const,
    actionable: true,
    estimatedSavings: 75,
    category: 'Food & Dining',
    createdAt: new Date('2024-03-15')
  },
  {
    id: '2',
    type: 'goal_adjustment' as const,
    title: 'Increase Savings Goal',
    description: 'Based on your current savings rate, you could increase your monthly goal by $50.',
    impact: 'high' as const,
    actionable: true,
    createdAt: new Date('2024-03-14')
  }
];

const mockSavingsProjection = {
  currentSavingsRate: 5.25,
  projectedMonthly: 157.50,
  projectedYearly: 1890.00,
  goalAchievementDate: new Date('2024-12-15'),
  recommendedAdjustments: [
    'Increase round-up amount to $2.00 per transaction',
    'Set up weekly automatic transfers of $25',
    'Review and reduce spending in top categories'
  ],
  confidenceLevel: 0.85
};

describe('InsightsPanel', () => {
  beforeEach(() => {
    (fetch as jest.Mock).mockClear();
  });

  it('renders loading state initially', () => {
    (fetch as jest.Mock).mockImplementation(() => new Promise(() => {}));
    
    render(<InsightsPanel />);
    
    expect(screen.getByText('AI Financial Insights')).toBeInTheDocument();
    expect(screen.getByText('Personalized analysis and recommendations')).toBeInTheDocument();
  });

  it('loads and displays insights data', async () => {
    (fetch as jest.Mock)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: mockSpendingAnalysis })
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: mockRecommendations })
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: mockSavingsProjection })
      });

    render(<InsightsPanel />);

    await waitFor(() => {
      expect(screen.getByText('$1250.75')).toBeInTheDocument();
      expect(screen.getByText('$24.52')).toBeInTheDocument();
      expect(screen.getByText('Increasing')).toBeInTheDocument();
    });
  });

  it('handles tab navigation', async () => {
    (fetch as jest.Mock)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: mockSpendingAnalysis })
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: mockRecommendations })
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: mockSavingsProjection })
      });

    render(<InsightsPanel />);

    await waitFor(() => {
      expect(screen.getByText('Overview')).toBeInTheDocument();
    });

    // Click on Spending Analysis tab
    const spendingTab = screen.getAllByText('Spending Analysis')[0]; // Get the tab button
    fireEvent.click(spendingTab);
    
    // Click on Recommendations tab
    const recommendationsTab = screen.getAllByText('Recommendations')[0]; // Get the tab button
    fireEvent.click(recommendationsTab);
    
    expect(screen.getByText('Financial Recommendations')).toBeInTheDocument();
  });

  it('handles refresh functionality', async () => {
    (fetch as jest.Mock)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: mockSpendingAnalysis })
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: mockRecommendations })
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: mockSavingsProjection })
      });

    render(<InsightsPanel />);

    await waitFor(() => {
      expect(screen.getByText('Refresh')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Refresh'));

    expect(fetch).toHaveBeenCalledTimes(6); // 3 initial + 3 refresh calls
  });
});

describe('SpendingAnalysisChart', () => {
  it('renders spending analysis data correctly', () => {
    render(<SpendingAnalysisChart data={mockSpendingAnalysis} />);

    expect(screen.getByText('Spending Analysis')).toBeInTheDocument();
    expect(screen.getByText('$1250.75')).toBeInTheDocument();
    expect(screen.getByText('$24.52')).toBeInTheDocument();
    expect(screen.getByText('Increasing')).toBeInTheDocument();
  });

  it('displays monthly trend correctly', () => {
    render(<SpendingAnalysisChart data={mockSpendingAnalysis} />);

    expect(screen.getByText('Monthly Spending Trend')).toBeInTheDocument();
    expect(screen.getByText('Jan 2024')).toBeInTheDocument();
    expect(screen.getByText('Feb 2024')).toBeInTheDocument();
    expect(screen.getByText('Mar 2024')).toBeInTheDocument();
  });

  it('shows top merchants', () => {
    render(<SpendingAnalysisChart data={mockSpendingAnalysis} />);

    expect(screen.getByText('Top Merchants')).toBeInTheDocument();
    expect(screen.getByText('Starbucks')).toBeInTheDocument();
    expect(screen.getByText('Uber')).toBeInTheDocument();
  });

  it('displays AI insights', () => {
    render(<SpendingAnalysisChart data={mockSpendingAnalysis} />);

    expect(screen.getByText('AI Insights')).toBeInTheDocument();
    expect(screen.getByText(/Your spending on Food & Dining represents 36%/)).toBeInTheDocument();
  });
});

describe('RecommendationsCard', () => {
  const mockOnRefresh = jest.fn();

  beforeEach(() => {
    mockOnRefresh.mockClear();
  });

  it('renders recommendations correctly', () => {
    render(<RecommendationsCard recommendations={mockRecommendations} onRefresh={mockOnRefresh} />);

    expect(screen.getByText('Financial Recommendations')).toBeInTheDocument();
    expect(screen.getByText('Reduce Coffee Spending')).toBeInTheDocument();
    expect(screen.getByText('Increase Savings Goal')).toBeInTheDocument();
  });

  it('shows recommendation details', () => {
    render(<RecommendationsCard recommendations={mockRecommendations} onRefresh={mockOnRefresh} />);

    expect(screen.getByText('potential savings')).toBeInTheDocument();
    expect(screen.getByText('medium impact')).toBeInTheDocument();
    expect(screen.getByText('high impact')).toBeInTheDocument();
    // Check for estimated savings in the summary section
    expect(screen.getByText('Potential Savings')).toBeInTheDocument();
  });

  it('handles marking recommendations as completed', () => {
    render(<RecommendationsCard recommendations={mockRecommendations} onRefresh={mockOnRefresh} />);

    const markDoneButtons = screen.getAllByText('Mark Done');
    fireEvent.click(markDoneButtons[0]);

    expect(screen.getByText('1 completed')).toBeInTheDocument();
  });

  it('calls onRefresh when refresh button is clicked', () => {
    render(<RecommendationsCard recommendations={mockRecommendations} onRefresh={mockOnRefresh} />);

    fireEvent.click(screen.getByText('Get New Recommendations'));
    expect(mockOnRefresh).toHaveBeenCalledTimes(1);
  });

  it('shows empty state when no active recommendations', () => {
    render(<RecommendationsCard recommendations={[]} onRefresh={mockOnRefresh} />);

    expect(screen.getByText('All caught up!')).toBeInTheDocument();
    expect(screen.getByText("You've completed all available recommendations. Great job!")).toBeInTheDocument();
  });
});

describe('SavingsProjectionCard', () => {
  it('renders projection data correctly', () => {
    render(<SavingsProjectionCard projection={mockSavingsProjection} />);

    expect(screen.getByText('Savings Projections')).toBeInTheDocument();
    expect(screen.getByText('$5.25')).toBeInTheDocument();
    expect(screen.getByText('$157.50')).toBeInTheDocument();
    expect(screen.getByText('Daily Savings Rate')).toBeInTheDocument();
    expect(screen.getByText('Projected Monthly')).toBeInTheDocument();
    expect(screen.getByText('Projected Yearly')).toBeInTheDocument();
  });

  it('shows confidence level', () => {
    render(<SavingsProjectionCard projection={mockSavingsProjection} />);

    expect(screen.getByText('High Confidence')).toBeInTheDocument();
  });

  it('displays goal achievement date', () => {
    render(<SavingsProjectionCard projection={mockSavingsProjection} />);

    expect(screen.getByText('Goal Achievement Projection')).toBeInTheDocument();
    expect(screen.getByText('December 15, 2024')).toBeInTheDocument();
  });

  it('shows recommended adjustments', () => {
    render(<SavingsProjectionCard projection={mockSavingsProjection} />);

    expect(screen.getByText('Recommended Adjustments')).toBeInTheDocument();
    expect(screen.getByText(/Increase round-up amount to \$2.00/)).toBeInTheDocument();
  });

  it('displays projection timeline', () => {
    render(<SavingsProjectionCard projection={mockSavingsProjection} />);

    expect(screen.getByText('3 Months')).toBeInTheDocument();
    expect(screen.getByText('6 Months')).toBeInTheDocument();
    expect(screen.getByText('1 Year')).toBeInTheDocument();
  });
});

describe('CategoryBredownChart', () => {
  it('renders category data correctly', () => {
    render(<CategoryBredownChart categories={mockSpendingAnalysis.categoryBreakdown} />);

    expect(screen.getByText('Spending by Category')).toBeInTheDocument();
    expect(screen.getByText('Food & Dining')).toBeInTheDocument();
    expect(screen.getByText('Transportation')).toBeInTheDocument();
    expect(screen.getByText('Shopping')).toBeInTheDocument();
  });

  it('shows category amounts and percentages', () => {
    render(<CategoryBredownChart categories={mockSpendingAnalysis.categoryBreakdown} />);

    expect(screen.getByText('$450.25')).toBeInTheDocument();
    expect(screen.getByText('36.0%')).toBeInTheDocument();
    expect(screen.getByText('25 transactions')).toBeInTheDocument();
  });

  it('handles empty categories', () => {
    render(<CategoryBredownChart categories={[]} />);

    expect(screen.getByText('No spending data available')).toBeInTheDocument();
  });
});

describe('TrendAnalysisChart', () => {
  it('renders monthly trend data', () => {
    render(<TrendAnalysisChart monthlyData={mockSpendingAnalysis.monthlyTrend} />);

    expect(screen.getByText('Monthly Trend Analysis')).toBeInTheDocument();
    expect(screen.getByText('Jan 24')).toBeInTheDocument();
    expect(screen.getByText('Feb 24')).toBeInTheDocument();
    expect(screen.getByText('Mar 24')).toBeInTheDocument();
  });

  it('shows spending and savings amounts', () => {
    render(<TrendAnalysisChart monthlyData={mockSpendingAnalysis.monthlyTrend} />);

    expect(screen.getByText('20 transactions')).toBeInTheDocument();
    expect(screen.getByText('Round-up Savings')).toBeInTheDocument();
    expect(screen.getByText('Spending')).toBeInTheDocument();
  });

  it('calculates and displays trend', () => {
    render(<TrendAnalysisChart monthlyData={mockSpendingAnalysis.monthlyTrend} />);

    // Should show stable trend since the change is minimal
    expect(screen.getByText('Stable')).toBeInTheDocument();
  });

  it('shows summary statistics', () => {
    render(<TrendAnalysisChart monthlyData={mockSpendingAnalysis.monthlyTrend} />);

    expect(screen.getByText('Total Spending')).toBeInTheDocument();
    expect(screen.getByText('Total Saved')).toBeInTheDocument();
    expect(screen.getByText('$1250.75')).toBeInTheDocument();
    expect(screen.getByText('$54.50')).toBeInTheDocument();
  });

  it('handles empty monthly data', () => {
    render(<TrendAnalysisChart monthlyData={[]} />);

    expect(screen.getByText('No monthly data available')).toBeInTheDocument();
  });
});