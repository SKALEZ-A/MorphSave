'use client';

import React from 'react';
import { TrendingUp, TrendingDown, Minus, DollarSign, ShoppingBag, Calendar } from 'lucide-react';

interface SpendingAnalysis {
  totalSpent: number;
  categoryBreakdown: CategorySpending[];
  monthlyTrend: MonthlySpending[];
  topMerchants: MerchantSpending[];
  averageTransactionAmount: number;
  spendingVelocity: 'increasing' | 'decreasing' | 'stable';
  insights: string[];
}

interface CategorySpending {
  category: string;
  amount: number;
  percentage: number;
  transactionCount: number;
  averageAmount: number;
}

interface MonthlySpending {
  month: string;
  amount: number;
  transactionCount: number;
  savingsAmount: number;
}

interface MerchantSpending {
  merchant: string;
  amount: number;
  transactionCount: number;
  category: string;
}

interface SpendingAnalysisChartProps {
  data: SpendingAnalysis;
}

export const SpendingAnalysisChart: React.FC<SpendingAnalysisChartProps> = ({ data }) => {
  const getVelocityIcon = () => {
    switch (data.spendingVelocity) {
      case 'increasing':
        return <TrendingUp className="w-5 h-5 text-red-500" />;
      case 'decreasing':
        return <TrendingDown className="w-5 h-5 text-green-500" />;
      default:
        return <Minus className="w-5 h-5 text-blue-500" />;
    }
  };

  const getVelocityColor = () => {
    switch (data.spendingVelocity) {
      case 'increasing':
        return 'text-red-600 bg-red-50 border-red-200';
      case 'decreasing':
        return 'text-green-600 bg-green-50 border-green-200';
      default:
        return 'text-blue-600 bg-blue-50 border-blue-200';
    }
  };

  const formatMonth = (monthStr: string) => {
    const date = new Date(monthStr + '-01');
    return date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
  };

  const maxMonthlyAmount = Math.max(...data.monthlyTrend.map(m => m.amount));

  return (
    <div className="bg-white rounded-lg shadow-sm border p-6">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-semibold text-gray-900">Spending Analysis</h3>
        <div className={`flex items-center gap-2 px-3 py-1 rounded-full border ${getVelocityColor()}`}>
          {getVelocityIcon()}
          <span className="text-sm font-medium capitalize">{data.spendingVelocity}</span>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        {/* Total Spent */}
        <div className="text-center">
          <div className="flex items-center justify-center w-12 h-12 bg-blue-100 rounded-lg mx-auto mb-3">
            <DollarSign className="w-6 h-6 text-blue-600" />
          </div>
          <div className="text-2xl font-bold text-gray-900">${data.totalSpent.toFixed(2)}</div>
          <div className="text-sm text-gray-600">Total Spent (90 days)</div>
        </div>

        {/* Average Transaction */}
        <div className="text-center">
          <div className="flex items-center justify-center w-12 h-12 bg-green-100 rounded-lg mx-auto mb-3">
            <ShoppingBag className="w-6 h-6 text-green-600" />
          </div>
          <div className="text-2xl font-bold text-gray-900">${data.averageTransactionAmount.toFixed(2)}</div>
          <div className="text-sm text-gray-600">Average Transaction</div>
        </div>

        {/* Transaction Count */}
        <div className="text-center">
          <div className="flex items-center justify-center w-12 h-12 bg-purple-100 rounded-lg mx-auto mb-3">
            <Calendar className="w-6 h-6 text-purple-600" />
          </div>
          <div className="text-2xl font-bold text-gray-900">
            {data.monthlyTrend.reduce((sum, m) => sum + m.transactionCount, 0)}
          </div>
          <div className="text-sm text-gray-600">Total Transactions</div>
        </div>
      </div>

      {/* Monthly Trend Chart */}
      {data.monthlyTrend.length > 0 && (
        <div className="mb-8">
          <h4 className="text-md font-medium text-gray-900 mb-4">Monthly Spending Trend</h4>
          <div className="space-y-3">
            {data.monthlyTrend.map((month, index) => (
              <div key={month.month} className="flex items-center gap-4">
                <div className="w-16 text-sm text-gray-600 font-medium">
                  {formatMonth(month.month)}
                </div>
                <div className="flex-1">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm text-gray-700">${month.amount.toFixed(2)}</span>
                    <span className="text-xs text-gray-500">{month.transactionCount} transactions</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div
                      className="bg-blue-500 h-2 rounded-full transition-all duration-300"
                      style={{ width: `${(month.amount / maxMonthlyAmount) * 100}%` }}
                    ></div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Top Merchants */}
      {data.topMerchants.length > 0 && (
        <div>
          <h4 className="text-md font-medium text-gray-900 mb-4">Top Merchants</h4>
          <div className="space-y-3">
            {data.topMerchants.slice(0, 5).map((merchant, index) => (
              <div key={merchant.merchant} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                    <span className="text-sm font-medium text-blue-600">{index + 1}</span>
                  </div>
                  <div>
                    <div className="font-medium text-gray-900">{merchant.merchant}</div>
                    <div className="text-sm text-gray-600">{merchant.category}</div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-semibold text-gray-900">${merchant.amount.toFixed(2)}</div>
                  <div className="text-sm text-gray-600">{merchant.transactionCount} transactions</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* AI Insights */}
      {data.insights.length > 0 && (
        <div className="mt-8 p-4 bg-blue-50 rounded-lg border border-blue-200">
          <h4 className="text-md font-medium text-blue-900 mb-3">AI Insights</h4>
          <div className="space-y-2">
            {data.insights.map((insight, index) => (
              <div key={index} className="flex items-start gap-2">
                <div className="w-1.5 h-1.5 bg-blue-500 rounded-full mt-2 flex-shrink-0"></div>
                <p className="text-sm text-blue-800">{insight}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};