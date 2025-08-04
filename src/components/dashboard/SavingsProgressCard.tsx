'use client';

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/Card';
import { Badge } from '../ui/Badge';
import { TrendingUp, Target, Calendar } from 'lucide-react';
import { motion } from 'framer-motion';

interface SavingsProgressCardProps {
  totalSaved: number;
  savingsGoal?: number;
  monthlyTarget?: number;
  currentMonthSaved: number;
  currency?: string;
  className?: string;
}

const SavingsProgressCard: React.FC<SavingsProgressCardProps> = ({
  totalSaved,
  savingsGoal,
  monthlyTarget,
  currentMonthSaved,
  currency = 'USD',
  className
}) => {
  const goalProgress = savingsGoal ? (totalSaved / savingsGoal) * 100 : 0;
  const monthlyProgress = monthlyTarget ? (currentMonthSaved / monthlyTarget) * 100 : 0;
  
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency,
      minimumFractionDigits: 2,
    }).format(amount);
  };

  const getProgressColor = (progress: number) => {
    if (progress >= 100) return 'bg-green-500';
    if (progress >= 75) return 'bg-blue-500';
    if (progress >= 50) return 'bg-yellow-500';
    return 'bg-gray-400';
  };

  const getProgressTextColor = (progress: number) => {
    if (progress >= 100) return 'text-green-600 dark:text-green-400';
    if (progress >= 75) return 'text-blue-600 dark:text-blue-400';
    if (progress >= 50) return 'text-yellow-600 dark:text-yellow-400';
    return 'text-gray-600 dark:text-gray-400';
  };

  return (
    <Card variant="elevated" className={className}>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span className="flex items-center space-x-2">
            <TrendingUp className="h-5 w-5 text-blue-600" />
            <span>Savings Progress</span>
          </span>
          <Badge variant="secondary" size="sm">
            {goalProgress.toFixed(0)}% Complete
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Total Saved Display */}
        <div className="text-center">
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.5 }}
            className="text-3xl font-bold text-gray-900 dark:text-gray-100 mb-2"
          >
            {formatCurrency(totalSaved)}
          </motion.div>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Total Saved
          </p>
        </div>

        {/* Savings Goal Progress */}
        {savingsGoal && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Target className="h-4 w-4 text-gray-500" />
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  Savings Goal
                </span>
              </div>
              <span className={`text-sm font-medium ${getProgressTextColor(goalProgress)}`}>
                {formatCurrency(totalSaved)} / {formatCurrency(savingsGoal)}
              </span>
            </div>
            
            <div className="relative">
              <div className="w-full bg-gray-200 rounded-full h-3 dark:bg-gray-700">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${Math.min(goalProgress, 100)}%` }}
                  transition={{ duration: 1, ease: "easeOut" }}
                  className={`h-3 rounded-full ${getProgressColor(goalProgress)} relative overflow-hidden`}
                >
                  <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent animate-pulse" />
                </motion.div>
              </div>
              <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400 mt-1">
                <span>0%</span>
                <span>{goalProgress.toFixed(1)}%</span>
                <span>100%</span>
              </div>
            </div>
          </div>
        )}

        {/* Monthly Target Progress */}
        {monthlyTarget && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Calendar className="h-4 w-4 text-gray-500" />
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  This Month
                </span>
              </div>
              <span className={`text-sm font-medium ${getProgressTextColor(monthlyProgress)}`}>
                {formatCurrency(currentMonthSaved)} / {formatCurrency(monthlyTarget)}
              </span>
            </div>
            
            <div className="relative">
              <div className="w-full bg-gray-200 rounded-full h-2 dark:bg-gray-700">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${Math.min(monthlyProgress, 100)}%` }}
                  transition={{ duration: 1, delay: 0.3, ease: "easeOut" }}
                  className={`h-2 rounded-full ${getProgressColor(monthlyProgress)}`}
                />
              </div>
              <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400 mt-1">
                <span>{monthlyProgress.toFixed(0)}% of monthly goal</span>
              </div>
            </div>
          </div>
        )}

        {/* Quick Stats */}
        <div className="grid grid-cols-2 gap-4 pt-4 border-t border-gray-200 dark:border-gray-700">
          <div className="text-center">
            <div className="text-lg font-semibold text-gray-900 dark:text-gray-100">
              {savingsGoal ? Math.max(0, savingsGoal - totalSaved).toFixed(0) : '0'}
            </div>
            <div className="text-xs text-gray-500 dark:text-gray-400">
              Left to Goal
            </div>
          </div>
          <div className="text-center">
            <div className="text-lg font-semibold text-gray-900 dark:text-gray-100">
              {monthlyTarget ? Math.max(0, monthlyTarget - currentMonthSaved).toFixed(0) : '0'}
            </div>
            <div className="text-xs text-gray-500 dark:text-gray-400">
              Left This Month
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export { SavingsProgressCard };