'use client';

import React from 'react';

interface CategorySpending {
  category: string;
  amount: number;
  percentage: number;
  transactionCount: number;
  averageAmount: number;
}

interface CategoryBreakdownChartProps {
  categories: CategorySpending[];
}

export const CategoryBredownChart: React.FC<CategoryBreakdownChartProps> = ({ categories }) => {
  const colors = [
    'bg-blue-500',
    'bg-green-500',
    'bg-yellow-500',
    'bg-purple-500',
    'bg-red-500',
    'bg-indigo-500',
    'bg-pink-500',
    'bg-gray-500'
  ];

  const maxAmount = Math.max(...categories.map(c => c.amount));

  return (
    <div className="bg-white rounded-lg shadow-sm border p-6">
      <h3 className="text-lg font-semibold text-gray-900 mb-6">Spending by Category</h3>
      
      {categories.length === 0 ? (
        <div className="text-center py-8 text-gray-500">
          <p>No spending data available</p>
        </div>
      ) : (
        <div className="space-y-4">
          {categories.map((category, index) => (
            <div key={category.category} className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={`w-3 h-3 rounded-full ${colors[index % colors.length]}`}></div>
                  <span className="font-medium text-gray-900">{category.category}</span>
                </div>
                <div className="text-right">
                  <div className="font-semibold text-gray-900">${category.amount.toFixed(2)}</div>
                  <div className="text-sm text-gray-600">{category.percentage.toFixed(1)}%</div>
                </div>
              </div>
              
              <div className="ml-6">
                <div className="w-full bg-gray-200 rounded-full h-2 mb-2">
                  <div
                    className={`h-2 rounded-full transition-all duration-300 ${colors[index % colors.length]}`}
                    style={{ width: `${(category.amount / maxAmount) * 100}%` }}
                  ></div>
                </div>
                <div className="flex justify-between text-xs text-gray-600">
                  <span>{category.transactionCount} transactions</span>
                  <span>Avg: ${category.averageAmount.toFixed(2)}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};