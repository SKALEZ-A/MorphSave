'use client';

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/Card';
import { Button } from '../ui/Button';
import { Modal } from '../ui/Modal';
import { Input } from '../ui/Input';
import { FormField } from '../forms/FormField';
import { Alert } from '../ui/Alert';
import { 
  Plus, 
  Minus, 
  RotateCcw, 
  Target,
  Settings,
  TrendingUp,
  Wallet,
  CreditCard
} from 'lucide-react';
import { motion } from 'framer-motion';

interface QuickActionsProps {
  onDeposit?: (amount: number) => Promise<void>;
  onWithdraw?: (amount: number) => Promise<void>;
  onSetupRoundUp?: () => void;
  onSetGoal?: (goal: number) => Promise<void>;
  onViewSettings?: () => void;
  availableBalance?: number;
  isLoading?: boolean;
  className?: string;
}

const QuickActions: React.FC<QuickActionsProps> = ({
  onDeposit,
  onWithdraw,
  onSetupRoundUp,
  onSetGoal,
  onViewSettings,
  availableBalance = 0,
  isLoading = false,
  className
}) => {
  const [showDepositModal, setShowDepositModal] = React.useState(false);
  const [showWithdrawModal, setShowWithdrawModal] = React.useState(false);
  const [showGoalModal, setShowGoalModal] = React.useState(false);
  const [depositAmount, setDepositAmount] = React.useState('');
  const [withdrawAmount, setWithdrawAmount] = React.useState('');
  const [goalAmount, setGoalAmount] = React.useState('');
  const [actionLoading, setActionLoading] = React.useState(false);
  const [error, setError] = React.useState('');

  const quickActions = [
    {
      id: 'deposit',
      title: 'Add Money',
      description: 'Deposit funds to your savings',
      icon: Plus,
      color: 'bg-green-100 text-green-600 dark:bg-green-900/20 dark:text-green-400',
      onClick: () => setShowDepositModal(true)
    },
    {
      id: 'withdraw',
      title: 'Withdraw',
      description: 'Take money out of savings',
      icon: Minus,
      color: 'bg-red-100 text-red-600 dark:bg-red-900/20 dark:text-red-400',
      onClick: () => setShowWithdrawModal(true),
      disabled: availableBalance <= 0
    },
    {
      id: 'roundup',
      title: 'Round-up',
      description: 'Set up automatic round-ups',
      icon: RotateCcw,
      color: 'bg-blue-100 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400',
      onClick: onSetupRoundUp
    },
    {
      id: 'goal',
      title: 'Set Goal',
      description: 'Create a savings target',
      icon: Target,
      color: 'bg-purple-100 text-purple-600 dark:bg-purple-900/20 dark:text-purple-400',
      onClick: () => setShowGoalModal(true)
    }
  ];

  const handleDeposit = async () => {
    if (!onDeposit || !depositAmount) return;
    
    const amount = parseFloat(depositAmount);
    if (isNaN(amount) || amount <= 0) {
      setError('Please enter a valid amount');
      return;
    }

    setActionLoading(true);
    setError('');

    try {
      await onDeposit(amount);
      setShowDepositModal(false);
      setDepositAmount('');
    } catch (err) {
      setError('Failed to process deposit. Please try again.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleWithdraw = async () => {
    if (!onWithdraw || !withdrawAmount) return;
    
    const amount = parseFloat(withdrawAmount);
    if (isNaN(amount) || amount <= 0) {
      setError('Please enter a valid amount');
      return;
    }

    if (amount > availableBalance) {
      setError('Insufficient balance for withdrawal');
      return;
    }

    setActionLoading(true);
    setError('');

    try {
      await onWithdraw(amount);
      setShowWithdrawModal(false);
      setWithdrawAmount('');
    } catch (err) {
      setError('Failed to process withdrawal. Please try again.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleSetGoal = async () => {
    if (!onSetGoal || !goalAmount) return;
    
    const amount = parseFloat(goalAmount);
    if (isNaN(amount) || amount <= 0) {
      setError('Please enter a valid goal amount');
      return;
    }

    setActionLoading(true);
    setError('');

    try {
      await onSetGoal(amount);
      setShowGoalModal(false);
      setGoalAmount('');
    } catch (err) {
      setError('Failed to set goal. Please try again.');
    } finally {
      setActionLoading(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
    }).format(amount);
  };

  return (
    <>
      <Card variant="elevated" className={className}>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Quick Actions</CardTitle>
            {onViewSettings && (
              <Button variant="ghost" size="sm" onClick={onViewSettings}>
                <Settings className="h-4 w-4" />
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4">
            {quickActions.map((action, index) => {
              const Icon = action.icon;
              return (
                <motion.div
                  key={action.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.2, delay: index * 0.1 }}
                >
                  <Button
                    variant="ghost"
                    className="h-auto p-4 flex flex-col items-center space-y-2 w-full hover:bg-gray-50 dark:hover:bg-gray-800"
                    onClick={action.onClick}
                    disabled={action.disabled || isLoading}
                  >
                    <div className={`p-3 rounded-lg ${action.color}`}>
                      <Icon className="h-6 w-6" />
                    </div>
                    <div className="text-center">
                      <div className="font-medium text-gray-900 dark:text-gray-100">
                        {action.title}
                      </div>
                      <div className="text-xs text-gray-500 dark:text-gray-400">
                        {action.description}
                      </div>
                    </div>
                  </Button>
                </motion.div>
              );
            })}
          </div>

          {/* Additional Quick Stats */}
          <div className="mt-6 pt-4 border-t border-gray-200 dark:border-gray-700">
            <div className="grid grid-cols-2 gap-4 text-center">
              <div className="flex items-center justify-center space-x-2">
                <Wallet className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                <div>
                  <div className="text-sm font-medium text-gray-900 dark:text-gray-100">
                    {formatCurrency(availableBalance)}
                  </div>
                  <div className="text-xs text-gray-500 dark:text-gray-400">
                    Available
                  </div>
                </div>
              </div>
              <div className="flex items-center justify-center space-x-2">
                <TrendingUp className="h-4 w-4 text-green-600 dark:text-green-400" />
                <div>
                  <div className="text-sm font-medium text-gray-900 dark:text-gray-100">
                    4.2% APY
                  </div>
                  <div className="text-xs text-gray-500 dark:text-gray-400">
                    Current Rate
                  </div>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Deposit Modal */}
      <Modal
        isOpen={showDepositModal}
        onClose={() => setShowDepositModal(false)}
        title="Add Money"
        description="Deposit funds to your MorphSave account"
      >
        <div className="space-y-4">
          {error && <Alert variant="error">{error}</Alert>}
          
          <FormField label="Amount" required>
            <Input
              type="number"
              placeholder="0.00"
              value={depositAmount}
              onChange={(e) => setDepositAmount(e.target.value)}
              leftIcon={<CreditCard className="h-4 w-4" />}
              step="0.01"
              min="0"
            />
          </FormField>

          <div className="flex space-x-3">
            <Button
              variant="outline"
              className="flex-1"
              onClick={() => setShowDepositModal(false)}
              disabled={actionLoading}
            >
              Cancel
            </Button>
            <Button
              className="flex-1"
              onClick={handleDeposit}
              loading={actionLoading}
              disabled={!depositAmount || actionLoading}
            >
              Deposit
            </Button>
          </div>
        </div>
      </Modal>

      {/* Withdraw Modal */}
      <Modal
        isOpen={showWithdrawModal}
        onClose={() => setShowWithdrawModal(false)}
        title="Withdraw Money"
        description={`Available balance: ${formatCurrency(availableBalance)}`}
      >
        <div className="space-y-4">
          {error && <Alert variant="error">{error}</Alert>}
          
          <FormField label="Amount" required>
            <Input
              type="number"
              placeholder="0.00"
              value={withdrawAmount}
              onChange={(e) => setWithdrawAmount(e.target.value)}
              leftIcon={<Wallet className="h-4 w-4" />}
              step="0.01"
              min="0"
              max={availableBalance}
            />
          </FormField>

          <div className="flex space-x-2">
            {[25, 50, 75, 100].map(percentage => (
              <Button
                key={percentage}
                variant="outline"
                size="sm"
                onClick={() => setWithdrawAmount((availableBalance * percentage / 100).toFixed(2))}
                className="flex-1"
              >
                {percentage}%
              </Button>
            ))}
          </div>

          <div className="flex space-x-3">
            <Button
              variant="outline"
              className="flex-1"
              onClick={() => setShowWithdrawModal(false)}
              disabled={actionLoading}
            >
              Cancel
            </Button>
            <Button
              className="flex-1"
              onClick={handleWithdraw}
              loading={actionLoading}
              disabled={!withdrawAmount || actionLoading}
            >
              Withdraw
            </Button>
          </div>
        </div>
      </Modal>

      {/* Goal Setting Modal */}
      <Modal
        isOpen={showGoalModal}
        onClose={() => setShowGoalModal(false)}
        title="Set Savings Goal"
        description="Create a target to work towards"
      >
        <div className="space-y-4">
          {error && <Alert variant="error">{error}</Alert>}
          
          <FormField label="Goal Amount" required>
            <Input
              type="number"
              placeholder="1000.00"
              value={goalAmount}
              onChange={(e) => setGoalAmount(e.target.value)}
              leftIcon={<Target className="h-4 w-4" />}
              step="0.01"
              min="0"
            />
          </FormField>

          <div className="grid grid-cols-3 gap-2">
            {[500, 1000, 5000].map(amount => (
              <Button
                key={amount}
                variant="outline"
                size="sm"
                onClick={() => setGoalAmount(amount.toString())}
              >
                ${amount}
              </Button>
            ))}
          </div>

          <div className="flex space-x-3">
            <Button
              variant="outline"
              className="flex-1"
              onClick={() => setShowGoalModal(false)}
              disabled={actionLoading}
            >
              Cancel
            </Button>
            <Button
              className="flex-1"
              onClick={handleSetGoal}
              loading={actionLoading}
              disabled={!goalAmount || actionLoading}
            >
              Set Goal
            </Button>
          </div>
        </div>
      </Modal>
    </>
  );
};

export { QuickActions };