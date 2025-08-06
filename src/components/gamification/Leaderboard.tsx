'use client';

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/Card';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';
import { 
  Trophy, 
  Medal, 
  Award,
  TrendingUp,
  TrendingDown,
  Minus,
  Crown,
  Users,
  RefreshCw
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface LeaderboardEntry {
  id: string;
  userId: string;
  username: string;
  profileImage?: string;
  rank: number;
  previousRank?: number;
  score: number;
  level: number;
  totalSaved: number;
  streak: number;
  isCurrentUser?: boolean;
}

interface LeaderboardProps {
  entries: LeaderboardEntry[];
  type: 'savings' | 'points' | 'streak';
  timeframe: 'daily' | 'weekly' | 'monthly' | 'all-time';
  isLoading?: boolean;
  onRefresh?: () => void;
  onViewProfile?: (userId: string) => void;
  onTimeframeChange?: (timeframe: string) => void;
  className?: string;
}

const Leaderboard: React.FC<LeaderboardProps> = ({
  entries,
  type,
  timeframe,
  isLoading = false,
  onRefresh,
  onViewProfile,
  onTimeframeChange,
  className
}) => {
  const timeframes = [
    { value: 'daily', label: 'Today' },
    { value: 'weekly', label: 'This Week' },
    { value: 'monthly', label: 'This Month' },
    { value: 'all-time', label: 'All Time' }
  ];

  const getTypeIcon = () => {
    switch (type) {
      case 'savings':
        return Trophy;
      case 'points':
        return Award;
      case 'streak':
        return TrendingUp;
      default:
        return Trophy;
    }
  };

  const getTypeLabel = () => {
    switch (type) {
      case 'savings':
        return 'Savings Leaderboard';
      case 'points':
        return 'Points Leaderboard';
      case 'streak':
        return 'Streak Leaderboard';
      default:
        return 'Leaderboard';
    }
  };

  const formatScore = (score: number, type: string) => {
    switch (type) {
      case 'savings':
        return new Intl.NumberFormat('en-US', {
          style: 'currency',
          currency: 'USD',
          minimumFractionDigits: 0,
          maximumFractionDigits: 0,
        }).format(score);
      case 'points':
        return `${score.toLocaleString()} pts`;
      case 'streak':
        return `${score} days`;
      default:
        return score.toString();
    }
  };

  const getRankIcon = (rank: number) => {
    switch (rank) {
      case 1:
        return <Crown className="h-5 w-5 text-yellow-500" />;
      case 2:
        return <Medal className="h-5 w-5 text-gray-400" />;
      case 3:
        return <Award className="h-5 w-5 text-amber-600" />;
      default:
        return <span className="text-sm font-bold text-gray-500">#{rank}</span>;
    }
  };

  const getRankChangeIcon = (entry: LeaderboardEntry) => {
    if (!entry.previousRank) return null;
    
    const change = entry.previousRank - entry.rank;
    if (change > 0) {
      return <TrendingUp className="h-3 w-3 text-green-500" />;
    } else if (change < 0) {
      return <TrendingDown className="h-3 w-3 text-red-500" />;
    } else {
      return <Minus className="h-3 w-3 text-gray-400" />;
    }
  };

  const getRankBadgeVariant = (rank: number) => {
    switch (rank) {
      case 1:
        return 'warning' as const;
      case 2:
        return 'secondary' as const;
      case 3:
        return 'info' as const;
      default:
        return 'secondary' as const;
    }
  };

  const TypeIcon = getTypeIcon();

  return (
    <Card variant="elevated" className={className}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center space-x-2">
            <TypeIcon className="h-5 w-5 text-blue-600" />
            <span>{getTypeLabel()}</span>
          </CardTitle>
          <div className="flex items-center space-x-2">
            {onRefresh && (
              <Button
                variant="ghost"
                size="sm"
                onClick={onRefresh}
                disabled={isLoading}
              >
                <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
              </Button>
            )}
            <Badge variant="secondary" size="sm">
              <Users className="h-3 w-3 mr-1" />
              {entries.length}
            </Badge>
          </div>
        </div>

        {/* Timeframe Selector */}
        {onTimeframeChange && (
          <div className="flex space-x-1 mt-4">
            {timeframes.map((tf) => (
              <Button
                key={tf.value}
                variant={timeframe === tf.value ? 'default' : 'ghost'}
                size="sm"
                onClick={() => onTimeframeChange(tf.value)}
                disabled={isLoading}
              >
                {tf.label}
              </Button>
            ))}
          </div>
        )}
      </CardHeader>

      <CardContent>
        {/* Top 3 Podium */}
        {entries.length >= 3 && (
          <div className="mb-6">
            <div className="flex items-end justify-center space-x-4">
              {/* 2nd Place */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.2 }}
                className="text-center"
              >
                <div className="w-16 h-16 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center mb-2 mx-auto">
                  {entries[1].profileImage ? (
                    <img
                      src={entries[1].profileImage}
                      alt={entries[1].username}
                      className="w-14 h-14 rounded-full"
                    />
                  ) : (
                    <span className="text-lg font-bold text-gray-600 dark:text-gray-400">
                      {entries[1].username.charAt(0).toUpperCase()}
                    </span>
                  )}
                </div>
                <div className="bg-gray-200 dark:bg-gray-700 rounded-lg p-3 h-16 flex flex-col justify-center">
                  <Medal className="h-5 w-5 text-gray-400 mx-auto mb-1" />
                  <div className="text-xs font-medium text-gray-700 dark:text-gray-300">
                    {entries[1].username}
                  </div>
                </div>
              </motion.div>

              {/* 1st Place */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.1 }}
                className="text-center"
              >
                <div className="w-20 h-20 bg-yellow-100 dark:bg-yellow-900/20 rounded-full flex items-center justify-center mb-2 mx-auto border-2 border-yellow-400">
                  {entries[0].profileImage ? (
                    <img
                      src={entries[0].profileImage}
                      alt={entries[0].username}
                      className="w-16 h-16 rounded-full"
                    />
                  ) : (
                    <span className="text-xl font-bold text-yellow-600">
                      {entries[0].username.charAt(0).toUpperCase()}
                    </span>
                  )}
                </div>
                <div className="bg-yellow-100 dark:bg-yellow-900/20 rounded-lg p-3 h-20 flex flex-col justify-center border border-yellow-300">
                  <Crown className="h-6 w-6 text-yellow-500 mx-auto mb-1" />
                  <div className="text-sm font-bold text-yellow-800 dark:text-yellow-200">
                    {entries[0].username}
                  </div>
                  <div className="text-xs text-yellow-600 dark:text-yellow-400">
                    {formatScore(entries[0].score, type)}
                  </div>
                </div>
              </motion.div>

              {/* 3rd Place */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.3 }}
                className="text-center"
              >
                <div className="w-16 h-16 bg-amber-100 dark:bg-amber-900/20 rounded-full flex items-center justify-center mb-2 mx-auto">
                  {entries[2].profileImage ? (
                    <img
                      src={entries[2].profileImage}
                      alt={entries[2].username}
                      className="w-14 h-14 rounded-full"
                    />
                  ) : (
                    <span className="text-lg font-bold text-amber-600">
                      {entries[2].username.charAt(0).toUpperCase()}
                    </span>
                  )}
                </div>
                <div className="bg-amber-100 dark:bg-amber-900/20 rounded-lg p-3 h-16 flex flex-col justify-center">
                  <Award className="h-5 w-5 text-amber-600 mx-auto mb-1" />
                  <div className="text-xs font-medium text-amber-700 dark:text-amber-300">
                    {entries[2].username}
                  </div>
                </div>
              </motion.div>
            </div>
          </div>
        )}

        {/* Full Leaderboard List */}
        <div className="space-y-2">
          <AnimatePresence>
            {entries.map((entry, index) => (
              <motion.div
                key={entry.id}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                transition={{ duration: 0.2, delay: index * 0.05 }}
                className={`flex items-center justify-between p-3 rounded-lg transition-colors ${
                  entry.isCurrentUser
                    ? 'bg-blue-50 border border-blue-200 dark:bg-blue-900/20 dark:border-blue-800'
                    : 'bg-gray-50 hover:bg-gray-100 dark:bg-gray-800 dark:hover:bg-gray-700'
                } ${onViewProfile ? 'cursor-pointer' : ''}`}
                onClick={() => onViewProfile?.(entry.userId)}
              >
                <div className="flex items-center space-x-3">
                  {/* Rank */}
                  <div className="flex items-center space-x-1 w-12">
                    {getRankIcon(entry.rank)}
                    {getRankChangeIcon(entry)}
                  </div>

                  {/* Profile */}
                  <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 bg-gray-200 dark:bg-gray-700 rounded-full flex items-center justify-center">
                      {entry.profileImage ? (
                        <img
                          src={entry.profileImage}
                          alt={entry.username}
                          className="w-10 h-10 rounded-full"
                        />
                      ) : (
                        <span className="text-sm font-medium text-gray-600 dark:text-gray-400">
                          {entry.username.charAt(0).toUpperCase()}
                        </span>
                      )}
                    </div>
                    
                    <div>
                      <div className="flex items-center space-x-2">
                        <span className={`font-medium ${
                          entry.isCurrentUser 
                            ? 'text-blue-900 dark:text-blue-100' 
                            : 'text-gray-900 dark:text-gray-100'
                        }`}>
                          {entry.username}
                          {entry.isCurrentUser && (
                            <span className="text-xs text-blue-600 dark:text-blue-400 ml-1">
                              (You)
                            </span>
                          )}
                        </span>
                        <Badge variant={getRankBadgeVariant(entry.rank)} size="sm">
                          Level {entry.level}
                        </Badge>
                      </div>
                      <div className="text-xs text-gray-500 dark:text-gray-400">
                        {type === 'savings' && `Total: ${formatScore(entry.totalSaved, 'savings')}`}
                        {type === 'streak' && `Current streak: ${entry.streak} days`}
                        {type === 'points' && `Level ${entry.level}`}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Score */}
                <div className="text-right">
                  <div className={`font-bold ${
                    entry.isCurrentUser 
                      ? 'text-blue-900 dark:text-blue-100' 
                      : 'text-gray-900 dark:text-gray-100'
                  }`}>
                    {formatScore(entry.score, type)}
                  </div>
                  {entry.previousRank && (
                    <div className="text-xs text-gray-500 dark:text-gray-400">
                      {entry.previousRank > entry.rank ? '+' : ''}
                      {entry.previousRank - entry.rank} from last period
                    </div>
                  )}
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>

        {/* Loading State */}
        {isLoading && (
          <div className="text-center py-8">
            <RefreshCw className="h-8 w-8 animate-spin text-blue-600 mx-auto mb-2" />
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Loading leaderboard...
            </p>
          </div>
        )}

        {/* Empty State */}
        {!isLoading && entries.length === 0 && (
          <div className="text-center py-8">
            <Trophy className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">
              No rankings yet
            </h3>
            <p className="text-gray-500 dark:text-gray-400">
              Be the first to start saving and climb the leaderboard!
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export { Leaderboard };