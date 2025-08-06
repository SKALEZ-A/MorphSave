'use client';

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/Card';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';
import { 
  Users, 
  Calendar, 
  Target,
  Trophy,
  Clock,
  Share2,
  UserPlus,
  CheckCircle,
  AlertCircle
} from 'lucide-react';
import { motion } from 'framer-motion';

interface Challenge {
  id: string;
  title: string;
  description: string;
  type: 'savings_amount' | 'streak' | 'social';
  targetAmount?: number;
  duration: number; // in days
  startDate: Date;
  endDate: Date;
  status: 'active' | 'completed' | 'cancelled';
  participantCount: number;
  maxParticipants?: number;
  creatorUsername: string;
  isParticipating?: boolean;
  userProgress?: number;
  rewards: {
    points: number;
    badge?: string;
    specialReward?: string;
  };
}

interface ChallengeCardProps {
  challenge: Challenge;
  onJoin?: (challengeId: string) => void;
  onLeave?: (challengeId: string) => void;
  onShare?: (challenge: Challenge) => void;
  onViewDetails?: (challenge: Challenge) => void;
  isLoading?: boolean;
  className?: string;
}

const ChallengeCard: React.FC<ChallengeCardProps> = ({
  challenge,
  onJoin,
  onLeave,
  onShare,
  onViewDetails,
  isLoading = false,
  className
}) => {
  const now = new Date();
  const timeRemaining = challenge.endDate.getTime() - now.getTime();
  const daysRemaining = Math.max(0, Math.ceil(timeRemaining / (1000 * 60 * 60 * 24)));
  const isExpired = timeRemaining <= 0;
  const progress = challenge.userProgress || 0;

  const getTypeIcon = () => {
    switch (challenge.type) {
      case 'savings_amount':
        return Target;
      case 'streak':
        return Calendar;
      case 'social':
        return Users;
      default:
        return Target;
    }
  };

  const getTypeLabel = () => {
    switch (challenge.type) {
      case 'savings_amount':
        return 'Savings Goal';
      case 'streak':
        return 'Streak Challenge';
      case 'social':
        return 'Social Challenge';
      default:
        return 'Challenge';
    }
  };

  const getStatusColor = () => {
    if (isExpired) return 'text-gray-500 dark:text-gray-400';
    switch (challenge.status) {
      case 'active':
        return 'text-green-600 dark:text-green-400';
      case 'completed':
        return 'text-blue-600 dark:text-blue-400';
      case 'cancelled':
        return 'text-red-600 dark:text-red-400';
      default:
        return 'text-gray-600 dark:text-gray-400';
    }
  };

  const getStatusBadge = () => {
    if (isExpired) {
      return <Badge variant="secondary" size="sm">Expired</Badge>;
    }
    switch (challenge.status) {
      case 'active':
        return <Badge variant="success" size="sm">Active</Badge>;
      case 'completed':
        return <Badge variant="info" size="sm">Completed</Badge>;
      case 'cancelled':
        return <Badge variant="error" size="sm">Cancelled</Badge>;
      default:
        return <Badge variant="secondary" size="sm">{challenge.status}</Badge>;
    }
  };

  const formatTargetAmount = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const getProgressPercentage = () => {
    if (!challenge.targetAmount) return 0;
    return Math.min((progress / challenge.targetAmount) * 100, 100);
  };

  const TypeIcon = getTypeIcon();

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      whileHover={{ scale: 1.02 }}
      className={className}
    >
      <Card 
        variant="elevated" 
        className={`h-full transition-all ${
          challenge.isParticipating 
            ? 'ring-2 ring-blue-500 ring-opacity-50' 
            : ''
        }`}
      >
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between">
            <div className="flex items-center space-x-2">
              <TypeIcon className="h-5 w-5 text-blue-600" />
              <div>
                <CardTitle className="text-lg">{challenge.title}</CardTitle>
                <div className="flex items-center space-x-2 mt-1">
                  <Badge variant="secondary" size="sm">
                    {getTypeLabel()}
                  </Badge>
                  {getStatusBadge()}
                </div>
              </div>
            </div>
            
            {onShare && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onShare(challenge)}
                className="h-8 w-8 p-0"
              >
                <Share2 className="h-4 w-4" />
              </Button>
            )}
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          {/* Description */}
          <p className="text-sm text-gray-600 dark:text-gray-400 line-clamp-2">
            {challenge.description}
          </p>

          {/* Challenge Details */}
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div className="flex items-center space-x-2">
              <Users className="h-4 w-4 text-gray-500" />
              <span className="text-gray-700 dark:text-gray-300">
                {challenge.participantCount}
                {challenge.maxParticipants && ` / ${challenge.maxParticipants}`}
                {' participants'}
              </span>
            </div>
            
            <div className="flex items-center space-x-2">
              <Clock className="h-4 w-4 text-gray-500" />
              <span className={`${getStatusColor()}`}>
                {isExpired ? 'Expired' : `${daysRemaining} days left`}
              </span>
            </div>

            {challenge.targetAmount && (
              <div className="flex items-center space-x-2">
                <Target className="h-4 w-4 text-gray-500" />
                <span className="text-gray-700 dark:text-gray-300">
                  Goal: {formatTargetAmount(challenge.targetAmount)}
                </span>
              </div>
            )}

            <div className="flex items-center space-x-2">
              <Trophy className="h-4 w-4 text-gray-500" />
              <span className="text-gray-700 dark:text-gray-300">
                {challenge.rewards.points} points
              </span>
            </div>
          </div>

          {/* Progress Bar (for participating users) */}
          {challenge.isParticipating && challenge.targetAmount && (
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-gray-600 dark:text-gray-400">Your Progress</span>
                <span className="font-medium text-gray-900 dark:text-gray-100">
                  {formatTargetAmount(progress)} / {formatTargetAmount(challenge.targetAmount)}
                </span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2 dark:bg-gray-700">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${getProgressPercentage()}%` }}
                  transition={{ duration: 0.5 }}
                  className="bg-blue-600 h-2 rounded-full"
                />
              </div>
              <div className="text-xs text-gray-500 dark:text-gray-400">
                {getProgressPercentage().toFixed(1)}% complete
              </div>
            </div>
          )}

          {/* Creator Info */}
          <div className="text-xs text-gray-500 dark:text-gray-400">
            Created by {challenge.creatorUsername}
          </div>

          {/* Rewards */}
          {(challenge.rewards.badge || challenge.rewards.specialReward) && (
            <div className="bg-yellow-50 dark:bg-yellow-900/20 p-3 rounded-lg">
              <div className="flex items-center space-x-2 mb-1">
                <Trophy className="h-4 w-4 text-yellow-600" />
                <span className="text-sm font-medium text-yellow-800 dark:text-yellow-200">
                  Special Rewards
                </span>
              </div>
              {challenge.rewards.badge && (
                <div className="text-xs text-yellow-700 dark:text-yellow-300">
                  🏆 {challenge.rewards.badge}
                </div>
              )}
              {challenge.rewards.specialReward && (
                <div className="text-xs text-yellow-700 dark:text-yellow-300">
                  🎁 {challenge.rewards.specialReward}
                </div>
              )}
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex space-x-2 pt-2">
            {challenge.isParticipating ? (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1"
                  onClick={() => onLeave?.(challenge.id)}
                  disabled={isLoading || isExpired}
                >
                  Leave Challenge
                </Button>
                <Button
                  size="sm"
                  className="flex-1"
                  onClick={() => onViewDetails?.(challenge)}
                >
                  View Details
                </Button>
              </>
            ) : (
              <>
                <Button
                  size="sm"
                  className="flex-1"
                  onClick={() => onJoin?.(challenge.id)}
                  disabled={
                    isLoading || 
                    isExpired || 
                    challenge.status !== 'active' ||
                    (challenge.maxParticipants && challenge.participantCount >= challenge.maxParticipants)
                  }
                >
                  <UserPlus className="h-4 w-4 mr-2" />
                  Join Challenge
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onViewDetails?.(challenge)}
                >
                  Details
                </Button>
              </>
            )}
          </div>

          {/* Status Messages */}
          {challenge.maxParticipants && challenge.participantCount >= challenge.maxParticipants && (
            <div className="flex items-center space-x-2 text-xs text-amber-600 dark:text-amber-400">
              <AlertCircle className="h-3 w-3" />
              <span>Challenge is full</span>
            </div>
          )}

          {challenge.status === 'completed' && challenge.isParticipating && (
            <div className="flex items-center space-x-2 text-xs text-green-600 dark:text-green-400">
              <CheckCircle className="h-3 w-3" />
              <span>You completed this challenge!</span>
            </div>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
};

export { ChallengeCard };