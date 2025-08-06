'use client';

import React from 'react';
import { TrendingUp, TrendingDown } from 'lucide-react';

interface MonthlySpending {
  month: string;
  amount: number;
  transactionCount: number;
  savingsAmount: number;
}

interface TrendAnalysisChartProps {
  monthlyData: MonthlySpending[];
}

export const TrendAnalysisChart: React.FC<TrendAnalysisChartProps> = ({ monthlyData }) => {
  const formatMonth = (monthStr: string) => {
    const date = new Date(monthStr + '-01');
    return date.toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
  };

  const calculateTrend = () => {
    if (monthlyData.length < 2) return { direction: 'stable', percentage: 0 };
    
    const recent = monthlyData.slice(-2);
    const [previous, current] = recent;
    
    if (!previous || !current) return { direction: 'stable', percentage: 0 };
    
    const change = ((current.amount - previous.amount) / previous.amount) * 100;
    
    return {
      direction: change > 5 ? 'increasing' : change < -5 ? 'decreasing' : 'stable',
      percentage: Math.abs(change)
    };
  };

  const trend = calculateTrend();
  const maxAmount = Math.max(...monthlyData.map(m => m.amount));
  const maxSavings = Math.max(...monthlyData.map(m => m.savingsAmount));

  return (
    <div className="bg-white rounded-lg shadow-sm border p-6">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-semibold text-gray-900">Monthly Trend Analysis</h3>
        <div className="flex items-center gap-2">
          {trend.direction === 'increasing' && (
            <div className="flex items-center gap-1 text-red-600">
              <TrendingUp className="w-4 h-4" />
              <span className="text-sm font-medium">+{trend.percentage.toFixed(1)}%</span>
            </div>
          )}
          {trend.direction === 'decreasing' && (
            <div className="flex items-center gap-1 text-green-600">
              <TrendingDown className="w-4 h-4" />
              <span className="text-sm font-medium">-{trend.percentage.toFixed(1)}%</span>
            </div>
          )}
          {trend.direction === 'stable' && (
            <div className="text-sm font-medium text-blue-600">Stable</div>
          )}
        </div>
      </div>

      {monthlyData.length === 0 ? (
        <div className="text-center py-8 text-gray-500">
          <p>No monthly data available</p>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Chart */}
          <div className="space-y-4">
            {monthlyData.map((month, index) => (
              <div key={month.month} className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-gray-700">
                    {formatMonth(month.month)}
                  </span>
                  <div className="text-right">
                    <div className="text-sm font-semibold text-gray-900">
                      ${month.amount.toFixed(2)}
                    </div>
                    <div className="text-xs text-gray-600">
                      {month.transactionCount} transactions
                    </div>
                  </div>
                </div>
                
                {/* Spending Bar */}
                <div className="space-y-1">
                  <div className="flex items-center justify-between text-xs text-gray-600">
                    <span>Spending</span>
                    <span>${month.amount.toFixed(2)}</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div
                      className="bg-red-400 h-2 rounded-full transition-all duration-300"
                      style={{ width: `${(month.amount / maxAmount) * 100}%` }}
                    ></div>
                  </div>
                </div>

                {/* Savings Bar */}
                <div className="space-y-1">
                  <div className="flex items-center justify-between text-xs text-gray-600">
                    <span>Round-up Savings</span>
                    <span>${month.savingsAmount.toFixed(2)}</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div
                      className="bg-green-400 h-2 rounded-full transition-all duration-300"
                      style={{ width: `${(month.savingsAmount / maxSavings) * 100}%` }}
                    ></div>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Summary Stats */}
          <div className="pt-4 border-t border-gray-200">
            <div className="grid grid-cols-2 gap-4 text-center">
              <div>
                <div className="text-lg font-bold text-red-600">
                  ${monthlyData.reduce((sum, m) => sum + m.amount, 0).toFixed(2)}
                </div>
                <div className="text-sm text-gray-600">Total Spending</div>
              </div>
              <div>
                <div className="text-lg font-bold text-green-600">
                  ${monthlyData.reduce((sum, m) => sum + m.savingsAmount, 0).toFixed(2)}
                </div>
                <div className="text-sm text-gray-600">Total Saved</div>
              </div>
            </div>
          </div>

          {/* Trend Insight */}
          <div className="p-3 bg-blue-50 rounded-lg border border-blue-200">
            <div className="text-sm text-blue-800">
              {trend.direction === 'increasing' && (
                <>
                  <strong>Spending Trend:</strong> Your spending has increased by {trend.percentage.toFixed(1)}% 
                  compared to last month. Consider reviewing your budget to stay on track.
                </>
              )}
              {trend.direction === 'decreasing' && (
                <>
                  <strong>Great Progress:</strong> Your spending has decreased by {trend.percentage.toFixed(1)}% 
                  compared to last month. Keep up the good work!
                </>
              )}
              {trend.direction === 'stable' && (
                <>
                  <strong>Consistent Spending:</strong> Your spending has remained stable. 
                  This consistency can help with budgeting and savings planning.
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};