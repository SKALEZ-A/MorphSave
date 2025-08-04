'use client';

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/Card';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';
import { 
  TrendingUp, 
  TrendingDown,
  Info,
  RefreshCw,
  ExternalLink,
  PieChart
} from 'lucide-react';
import { motion } from 'framer-motion';

interface YieldProtocol {
  name: string;
  apy: number;
  allocation: number;
  earned: number;
  risk: 'low' | 'medium' | 'high';
  status: 'active' | 'paused' | 'migrating';
}

interface YieldDisplayProps {
  totalYieldEarned: number;
  currentAPY: number;
  previousAPY?: number;
  protocols: YieldProtocol[];
  totalInvested: number;
  projectedMonthlyYield: number;
  isLoading?: boolean;
  onViewDetails?: () => void;
  onRebalance?: () => void;
  className?: string;
}

const YieldDisplay: React.FC<YieldDisplayProps> = ({
  totalYieldEarned,
  currentAPY,
  previousAPY,
  protocols,
  totalInvested,
  projectedMonthlyYield,
  isLoading = false,
  onViewDetails,
  onRebalance,
  className
}) => {
  const apyChange = previousAPY ? currentAPY - previousAPY : 0;
  const isApyIncreasing = apyChange > 0;

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
    }).format(amount);
  };

  const formatPercentage = (rate: number) => {
    return `${rate.toFixed(2)}%`;
  };

  const getRiskColor = (risk: string) => {
    switch (risk) {
      case 'low':
        return 'text-green-600 dark:text-green-400';
      case 'medium':
        return 'text-yellow-600 dark:text-yellow-400';
      case 'high':
        return 'text-red-600 dark:text-red-400';
      default:
        return 'text-gray-600 dark:text-gray-400';
    }
  };

  const getRiskBadgeVariant = (risk: string) => {
    switch (risk) {
      case 'low':
        return 'success' as const;
      case 'medium':
        return 'warning' as const;
      case 'high':
        return 'error' as const;
      default:
        return 'secondary' as const;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'active':
        return <Badge variant="success" size="sm">Active</Badge>;
      case 'paused':
        return <Badge variant="warning" size="sm">Paused</Badge>;
      case 'migrating':
        return <Badge variant="info" size="sm">Migrating</Badge>;
      default:
        return <Badge variant="secondary" size="sm">{status}</Badge>;
    }
  };

  return (
    <Card variant="elevated" className={className}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center space-x-2">
            <TrendingUp className="h-5 w-5 text-green-600" />
            <span>Yield Overview</span>
          </CardTitle>
          <div className="flex items-center space-x-2">
            {onRebalance && (
              <Button variant="ghost" size="sm" onClick={onRebalance}>
                <RefreshCw className="h-4 w-4" />
              </Button>
            )}
            {onViewDetails && (
              <Button variant="ghost" size="sm" onClick={onViewDetails}>
                <ExternalLink className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
      </CardHeader>
      
      <CardContent className="space-y-6">
        {/* Main Yield Stats */}
        <div className="grid grid-cols-2 gap-4">
          <div className="text-center p-4 bg-green-50 dark:bg-green-900/20 rounded-lg">
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ duration: 0.5 }}
              className="text-2xl font-bold text-green-900 dark:text-green-100 mb-1"
            >
              {formatCurrency(totalYieldEarned)}
            </motion.div>
            <div className="text-sm text-green-600 dark:text-green-400">
              Total Earned
            </div>
          </div>
          
          <div className="text-center p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
            <div className="flex items-center justify-center space-x-1 mb-1">
              <motion.div
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ duration: 0.5, delay: 0.1 }}
                className="text-2xl font-bold text-blue-900 dark:text-blue-100"
              >
                {formatPercentage(currentAPY)}
              </motion.div>
              {apyChange !== 0 && (
                <div className={`flex items-center ${isApyIncreasing ? 'text-green-600' : 'text-red-600'}`}>
                  {isApyIncreasing ? (
                    <TrendingUp className="h-3 w-3" />
                  ) : (
                    <TrendingDown className="h-3 w-3" />
                  )}
                  <span className="text-xs ml-1">
                    {Math.abs(apyChange).toFixed(2)}%
                  </span>
                </div>
              )}
            </div>
            <div className="text-sm text-blue-600 dark:text-blue-400">
              Current APY
            </div>
          </div>
        </div>

        {/* Projections */}
        <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4">
          <div className="flex items-center justify-between mb-3">
            <h4 className="font-medium text-gray-900 dark:text-gray-100">
              Projections
            </h4>
            <Info className="h-4 w-4 text-gray-400" />
          </div>
          
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <div className="text-gray-500 dark:text-gray-400">Monthly</div>
              <div className="font-semibold text-gray-900 dark:text-gray-100">
                {formatCurrency(projectedMonthlyYield)}
              </div>
            </div>
            <div>
              <div className="text-gray-500 dark:text-gray-400">Yearly</div>
              <div className="font-semibold text-gray-900 dark:text-gray-100">
                {formatCurrency(projectedMonthlyYield * 12)}
              </div>
            </div>
          </div>
        </div>

        {/* Protocol Breakdown */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h4 className="font-medium text-gray-900 dark:text-gray-100">
              Protocol Allocation
            </h4>
            <PieChart className="h-4 w-4 text-gray-400" />
          </div>
          
          <div className="space-y-3">
            {protocols.map((protocol, index) => (
              <motion.div
                key={protocol.name}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.3, delay: index * 0.1 }}
                className="flex items-center justify-between p-3 bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700"
              >
                <div className="flex-1">
                  <div className="flex items-center space-x-2 mb-1">
                    <span className="font-medium text-gray-900 dark:text-gray-100">
                      {protocol.name}
                    </span>
                    {getStatusBadge(protocol.status)}
                  </div>
                  
                  <div className="flex items-center space-x-4 text-sm text-gray-500 dark:text-gray-400">
                    <span>{formatPercentage(protocol.apy)} APY</span>
                    <span>•</span>
                    <span>{protocol.allocation}% allocated</span>
                    <span>•</span>
                    <Badge variant={getRiskBadgeVariant(protocol.risk)} size="sm">
                      {protocol.risk} risk
                    </Badge>
                  </div>
                </div>
                
                <div className="text-right">
                  <div className="font-semibold text-gray-900 dark:text-gray-100">
                    {formatCurrency(protocol.earned)}
                  </div>
                  <div className="text-xs text-gray-500 dark:text-gray-400">
                    earned
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>

        {/* Investment Summary */}
        <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
          <div className="grid grid-cols-3 gap-4 text-center">
            <div>
              <div className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                {formatCurrency(totalInvested)}
              </div>
              <div className="text-xs text-gray-500 dark:text-gray-400">
                Total Invested
              </div>
            </div>
            <div>
              <div className="text-lg font-semibold text-green-600 dark:text-green-400">
                {((totalYieldEarned / totalInvested) * 100).toFixed(2)}%
              </div>
              <div className="text-xs text-gray-500 dark:text-gray-400">
                Total Return
              </div>
            </div>
            <div>
              <div className="text-lg font-semibold text-blue-600 dark:text-blue-400">
                {protocols.filter(p => p.status === 'active').length}
              </div>
              <div className="text-xs text-gray-500 dark:text-gray-400">
                Active Protocols
              </div>
            </div>
          </div>
        </div>

        {/* Loading State */}
        {isLoading && (
          <div className="absolute inset-0 bg-white/80 dark:bg-gray-900/80 flex items-center justify-center rounded-lg">
            <div className="flex items-center space-x-2">
              <RefreshCw className="h-5 w-5 animate-spin text-blue-600" />
              <span className="text-sm text-gray-600 dark:text-gray-400">
                Updating yield data...
              </span>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export { YieldDisplay };