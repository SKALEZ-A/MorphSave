'use client';

import React from 'react';
import { Card, CardContent } from '../ui/Card';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';
import { 
  Eye, 
  EyeOff, 
  TrendingUp, 
  TrendingDown,
  Plus,
  Minus,
  RefreshCw
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface BalanceDisplayProps {
  totalBalance: number;
  availableBalance: number;
  yieldEarned: number;
  yieldRate: number;
  currency?: string;
  isLoading?: boolean;
  onDeposit?: () => void;
  onWithdraw?: () => void;
  onRefresh?: () => void;
  className?: string;
}

const BalanceDisplay: React.FC<BalanceDisplayProps> = ({
  totalBalance,
  availableBalance,
  yieldEarned,
  yieldRate,
  currency = 'USD',
  isLoading = false,
  onDeposit,
  onWithdraw,
  onRefresh,
  className
}) => {
  const [isBalanceVisible, setIsBalanceVisible] = React.useState(true);
  const [previousBalance, setPreviousBalance] = React.useState(totalBalance);
  const [balanceChange, setBalanceChange] = React.useState(0);

  React.useEffect(() => {
    if (totalBalance !== previousBalance) {
      setBalanceChange(totalBalance - previousBalance);
      setPreviousBalance(totalBalance);
    }
  }, [totalBalance, previousBalance]);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency,
      minimumFractionDigits: 2,
    }).format(amount);
  };

  const formatPercentage = (rate: number) => {
    return `${rate.toFixed(2)}%`;
  };

  const getChangeColor = (change: number) => {
    if (change > 0) return 'text-green-600 dark:text-green-400';
    if (change < 0) return 'text-red-600 dark:text-red-400';
    return 'text-gray-600 dark:text-gray-400';
  };

  const getChangeIcon = (change: number) => {
    if (change > 0) return TrendingUp;
    if (change < 0) return TrendingDown;
    return null;
  };

  const ChangeIcon = getChangeIcon(balanceChange);

  return (
    <Card variant="elevated" className={className}>
      <CardContent className="p-6">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
            Your Balance
          </h3>
          <div className="flex items-center space-x-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsBalanceVisible(!isBalanceVisible)}
              className="h-8 w-8 p-0"
            >
              {isBalanceVisible ? (
                <EyeOff className="h-4 w-4" />
              ) : (
                <Eye className="h-4 w-4" />
              )}
            </Button>
            {onRefresh && (
              <Button
                variant="ghost"
                size="sm"
                onClick={onRefresh}
                disabled={isLoading}
                className="h-8 w-8 p-0"
              >
                <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
              </Button>
            )}
          </div>
        </div>

        {/* Main Balance Display */}
        <div className="text-center mb-6">
          <AnimatePresence mode="wait">
            {isBalanceVisible ? (
              <motion.div
                key="visible"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.2 }}
              >
                <div className="text-4xl font-bold text-gray-900 dark:text-gray-100 mb-2">
                  {formatCurrency(totalBalance)}
                </div>
                <div className="text-sm text-gray-600 dark:text-gray-400">
                  Total Balance
                </div>
              </motion.div>
            ) : (
              <motion.div
                key="hidden"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.2 }}
                className="text-4xl font-bold text-gray-900 dark:text-gray-100 mb-2"
              >
                ••••••
              </motion.div>
            )}
          </AnimatePresence>

          {/* Balance Change Indicator */}
          {balanceChange !== 0 && ChangeIcon && (
            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              className={`flex items-center justify-center space-x-1 ${getChangeColor(balanceChange)}`}
            >
              <ChangeIcon className="h-4 w-4" />
              <span className="text-sm font-medium">
                {balanceChange > 0 ? '+' : ''}{formatCurrency(Math.abs(balanceChange))}
              </span>
            </motion.div>
          )}
        </div>

        {/* Balance Breakdown */}
        <div className="grid grid-cols-2 gap-4 mb-6">
          <div className="text-center p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
            <div className="text-lg font-semibold text-blue-900 dark:text-blue-100">
              {isBalanceVisible ? formatCurrency(availableBalance) : '••••'}
            </div>
            <div className="text-xs text-blue-600 dark:text-blue-400">
              Available
            </div>
          </div>
          <div className="text-center p-3 bg-green-50 dark:bg-green-900/20 rounded-lg">
            <div className="text-lg font-semibold text-green-900 dark:text-green-100">
              {isBalanceVisible ? formatCurrency(yieldEarned) : '••••'}
            </div>
            <div className="text-xs text-green-600 dark:text-green-400">
              Yield Earned
            </div>
          </div>
        </div>

        {/* Yield Information */}
        <div className="flex items-center justify-center space-x-2 mb-6">
          <Badge variant="success" size="sm">
            {formatPercentage(yieldRate)} APY
          </Badge>
          <span className="text-xs text-gray-500 dark:text-gray-400">
            Current yield rate
          </span>
        </div>

        {/* Action Buttons */}
        <div className="grid grid-cols-2 gap-3">
          {onDeposit && (
            <Button
              onClick={onDeposit}
              className="flex items-center justify-center space-x-2"
              disabled={isLoading}
            >
              <Plus className="h-4 w-4" />
              <span>Deposit</span>
            </Button>
          )}
          {onWithdraw && (
            <Button
              variant="outline"
              onClick={onWithdraw}
              className="flex items-center justify-center space-x-2"
              disabled={isLoading || availableBalance <= 0}
            >
              <Minus className="h-4 w-4" />
              <span>Withdraw</span>
            </Button>
          )}
        </div>

        {/* Additional Info */}
        <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
          <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400">
            <span>Last updated</span>
            <span>{new Date().toLocaleTimeString()}</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export { BalanceDisplay };