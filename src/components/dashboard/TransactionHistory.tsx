'use client';

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/Card';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';
import { 
  ArrowUpRight, 
  ArrowDownLeft, 
  RotateCcw, 
  TrendingUp,
  ExternalLink,
  Filter,
  Search
} from 'lucide-react';
import { Input } from '../ui/Input';
import { motion, AnimatePresence } from 'framer-motion';

interface Transaction {
  id: string;
  type: 'deposit' | 'withdrawal' | 'roundup' | 'yield' | 'transfer';
  amount: number;
  description: string;
  timestamp: Date;
  status: 'pending' | 'confirmed' | 'failed';
  blockchainTxHash?: string;
  category?: string;
  merchant?: string;
}

interface TransactionHistoryProps {
  transactions: Transaction[];
  isLoading?: boolean;
  onLoadMore?: () => void;
  onViewTransaction?: (transaction: Transaction) => void;
  onViewBlockchain?: (txHash: string) => void;
  hasMore?: boolean;
  className?: string;
}

const TransactionHistory: React.FC<TransactionHistoryProps> = ({
  transactions,
  isLoading = false,
  onLoadMore,
  onViewTransaction,
  onViewBlockchain,
  hasMore = false,
  className
}) => {
  const [searchTerm, setSearchTerm] = React.useState('');
  const [filterType, setFilterType] = React.useState<string>('all');
  const [filteredTransactions, setFilteredTransactions] = React.useState(transactions);

  React.useEffect(() => {
    let filtered = transactions;

    // Filter by type
    if (filterType !== 'all') {
      filtered = filtered.filter(tx => tx.type === filterType);
    }

    // Filter by search term
    if (searchTerm) {
      filtered = filtered.filter(tx => 
        tx.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
        tx.merchant?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        tx.category?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    setFilteredTransactions(filtered);
  }, [transactions, searchTerm, filterType]);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
    }).format(amount);
  };

  const formatDate = (date: Date) => {
    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(date);
  };

  const getTransactionIcon = (type: string) => {
    switch (type) {
      case 'deposit':
        return ArrowDownLeft;
      case 'withdrawal':
        return ArrowUpRight;
      case 'roundup':
        return RotateCcw;
      case 'yield':
        return TrendingUp;
      default:
        return ArrowUpRight;
    }
  };

  const getTransactionColor = (type: string) => {
    switch (type) {
      case 'deposit':
      case 'roundup':
      case 'yield':
        return 'text-green-600 dark:text-green-400';
      case 'withdrawal':
        return 'text-red-600 dark:text-red-400';
      default:
        return 'text-gray-600 dark:text-gray-400';
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'confirmed':
        return <Badge variant="success" size="sm">Confirmed</Badge>;
      case 'pending':
        return <Badge variant="warning" size="sm">Pending</Badge>;
      case 'failed':
        return <Badge variant="error" size="sm">Failed</Badge>;
      default:
        return <Badge variant="secondary" size="sm">{status}</Badge>;
    }
  };

  const transactionTypes = [
    { value: 'all', label: 'All Types' },
    { value: 'deposit', label: 'Deposits' },
    { value: 'withdrawal', label: 'Withdrawals' },
    { value: 'roundup', label: 'Round-ups' },
    { value: 'yield', label: 'Yield' },
  ];

  return (
    <Card variant="elevated" className={className}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>Transaction History</CardTitle>
          <div className="flex items-center space-x-2">
            <Button variant="ghost" size="sm">
              <Filter className="h-4 w-4" />
            </Button>
          </div>
        </div>
        
        {/* Search and Filter */}
        <div className="flex flex-col sm:flex-row gap-3 mt-4">
          <div className="flex-1">
            <Input
              placeholder="Search transactions..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              leftIcon={<Search className="h-4 w-4" />}
            />
          </div>
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
          >
            {transactionTypes.map(type => (
              <option key={type.value} value={type.value}>
                {type.label}
              </option>
            ))}
          </select>
        </div>
      </CardHeader>
      
      <CardContent>
        {/* Transaction List */}
        <div className="space-y-3">
          <AnimatePresence>
            {filteredTransactions.map((transaction, index) => {
              const Icon = getTransactionIcon(transaction.type);
              const colorClass = getTransactionColor(transaction.type);
              
              return (
                <motion.div
                  key={transaction.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  transition={{ duration: 0.2, delay: index * 0.05 }}
                  className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-800 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors cursor-pointer"
                  onClick={() => onViewTransaction?.(transaction)}
                >
                  <div className="flex items-center space-x-4">
                    <div className={`p-2 rounded-lg bg-white dark:bg-gray-900 ${colorClass}`}>
                      <Icon className="h-5 w-5" />
                    </div>
                    
                    <div className="flex-1">
                      <div className="flex items-center space-x-2">
                        <h4 className="font-medium text-gray-900 dark:text-gray-100">
                          {transaction.description}
                        </h4>
                        {getStatusBadge(transaction.status)}
                      </div>
                      
                      <div className="flex items-center space-x-2 text-sm text-gray-500 dark:text-gray-400">
                        <span>{formatDate(transaction.timestamp)}</span>
                        {transaction.merchant && (
                          <>
                            <span>•</span>
                            <span>{transaction.merchant}</span>
                          </>
                        )}
                        {transaction.category && (
                          <>
                            <span>•</span>
                            <span className="capitalize">{transaction.category}</span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                  
                  <div className="text-right">
                    <div className={`font-semibold ${colorClass}`}>
                      {transaction.type === 'withdrawal' ? '-' : '+'}
                      {formatCurrency(transaction.amount)}
                    </div>
                    
                    {transaction.blockchainTxHash && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onViewBlockchain?.(transaction.blockchainTxHash!);
                        }}
                        className="flex items-center space-x-1 text-xs text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 mt-1"
                      >
                        <ExternalLink className="h-3 w-3" />
                        <span>View on blockchain</span>
                      </button>
                    )}
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>

        {/* Empty State */}
        {filteredTransactions.length === 0 && !isLoading && (
          <div className="text-center py-8">
            <div className="text-gray-400 dark:text-gray-600 mb-2">
              <RotateCcw className="h-12 w-12 mx-auto" />
            </div>
            <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">
              No transactions found
            </h3>
            <p className="text-gray-500 dark:text-gray-400">
              {searchTerm || filterType !== 'all' 
                ? 'Try adjusting your search or filter criteria'
                : 'Your transactions will appear here once you start saving'
              }
            </p>
          </div>
        )}

        {/* Loading State */}
        {isLoading && (
          <div className="space-y-3">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="flex items-center space-x-4 p-4 bg-gray-50 dark:bg-gray-800 rounded-lg animate-pulse">
                <div className="w-10 h-10 bg-gray-300 dark:bg-gray-600 rounded-lg" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 bg-gray-300 dark:bg-gray-600 rounded w-3/4" />
                  <div className="h-3 bg-gray-300 dark:bg-gray-600 rounded w-1/2" />
                </div>
                <div className="w-20 h-4 bg-gray-300 dark:bg-gray-600 rounded" />
              </div>
            ))}
          </div>
        )}

        {/* Load More Button */}
        {hasMore && !isLoading && (
          <div className="text-center mt-6">
            <Button
              variant="outline"
              onClick={onLoadMore}
              disabled={isLoading}
            >
              Load More Transactions
            </Button>
          </div>
        )}

        {/* Summary Stats */}
        {filteredTransactions.length > 0 && (
          <div className="mt-6 pt-4 border-t border-gray-200 dark:border-gray-700">
            <div className="grid grid-cols-3 gap-4 text-center">
              <div>
                <div className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                  {filteredTransactions.length}
                </div>
                <div className="text-xs text-gray-500 dark:text-gray-400">
                  Total Transactions
                </div>
              </div>
              <div>
                <div className="text-lg font-semibold text-green-600 dark:text-green-400">
                  {filteredTransactions.filter(tx => ['deposit', 'roundup', 'yield'].includes(tx.type)).length}
                </div>
                <div className="text-xs text-gray-500 dark:text-gray-400">
                  Deposits
                </div>
              </div>
              <div>
                <div className="text-lg font-semibold text-red-600 dark:text-red-400">
                  {filteredTransactions.filter(tx => tx.type === 'withdrawal').length}
                </div>
                <div className="text-xs text-gray-500 dark:text-gray-400">
                  Withdrawals
                </div>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export { TransactionHistory };