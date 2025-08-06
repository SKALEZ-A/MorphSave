'use client';

import React, { useState, useEffect } from 'react';
import { Button } from '../ui/Button';
import { Modal } from '../ui/Modal';
import { 
  Trophy, 
  Users, 
  Calendar, 
  Target, 
  Clock,
  Star,
  TrendingUp,
  Award,
  CheckCircle,
  MessageCircle,
  Share2,
  Crown,
  Medal,
  Gift
} from 'lucide-react';

interface Challenge {
  id: string;
  title: string;
  description: string;
  type: 'savings_amount' | 'streak' | 'social';
  targetAmount?: number;
  duration: number;
  startDate: Date;
  endDate: Date;
  creatorId: string;
  creator: {
    username: string;
    profileImage?: string;
  };
  participants: ChallengeParticipant[];
  rewards: ChallengeReward[];
  status: 'upcoming' | 'active' | 'completed' | 'cancelled';
  isPublic: boolean;
  maxParticipants?: number;
}

interface ChallengeParticipant {
  id: string;
  userId: string;
  user: {
    username: string;
    profileImage?: string;
    level: number;
  };
  joinedAt: Date;
  currentProgress: number;
  rank: number;
  isCompleted: boolean;
  dailyProgress: DailyProgress[];
}

interface DailyProgress {
  date: Date;
  amount: number;
  isActive: boolean;
}

interface ChallengeReward {
  id: string;
  type: 'points' | 'badge' | 'money';
  value: number;
  description: string;
  position: number;
}

interface ChallengeDetailsProps {
  challenge: Challenge;
  onClose: () => void;
  onJoin: () => void;
  onLeave: () => void;
}

export const ChallengeDetails: React.FC<ChallengeDetailsProps> = ({
  challenge,
  onClose,
  onJoin,
  onLeave
}) => {
  const [activeTab, setActiveTab] = useState<'overview' | 'leaderboard' | 'progress' | 'chat'>('overview');
  const [userProgress, setUserProgress] = useState<ChallengeParticipant | null>(null);
  
  const currentUserId = 'current-user-id'; // TODO: Get actual user ID
  const isParticipating = challenge.participants.some(p => p.userId === currentUserId);
  const userParticipant = challenge.participants.find(p => p.userId === currentUserId);

  useEffect(() => {
    if (userParticipant) {
      setUserProgress(userParticipant);
    }
  }, [userParticipant]);

  const calculateTimeRemaining = () => {
    const now = new Date();
    const diff = challenge.endDate.getTime() - now.getTime();
    const days = Math.ceil(diff / (1000 * 60 * 60 * 24));
    
    if (days <= 0) return 'Challenge ended';
    if (days === 1) return '1 day remaining';
    if (days < 7) return `${days} days remaining`;
    if (days < 30) return `${Math.floor(days / 7)} weeks remaining`;
    return `${Math.floor(days / 30)} months remaining`;
  };

  const getProgressPercentage = (participant: ChallengeParticipant) => {
    if (!challenge.targetAmount) return 0;
    return Math.min((participant.currentProgress / challenge.targetAmount) * 100, 100);
  };

  const getRankIcon = (rank: number) => {
    switch (rank) {
      case 1:
        return <Crown className="w-5 h-5 text-yellow-500" />;
      case 2:
        return <Medal className="w-5 h-5 text-gray-400" />;
      case 3:
        return <Medal className="w-5 h-5 text-amber-600" />;
      default:
        return <span className="w-5 h-5 flex items-center justify-center text-sm font-bold text-gray-600">#{rank}</span>;
    }
  };

  return (
    <Modal isOpen={true} onClose={onClose} title="" size="large">
      <div className="space-y-6">
        {/* Header */}
        <div className="text-center">
          <div className="flex items-center justify-center gap-2 mb-2">
            <Trophy className="w-6 h-6 text-yellow-600" />
            <span className={`px-3 py-1 rounded-full text-sm font-medium ${
              challenge.status === 'active' ? 'bg-green-100 text-green-800' :
              challenge.status === 'upcoming' ? 'bg-blue-100 text-blue-800' :
              challenge.status === 'completed' ? 'bg-gray-100 text-gray-800' :
              'bg-red-100 text-red-800'
            }`}>
              {challenge.status}
            </span>
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">{challenge.title}</h2>
          <p className="text-gray-600 mb-4">{challenge.description}</p>
          
          {/* Quick Stats */}
          <div className="grid grid-cols-3 gap-4 mb-6">
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600">{challenge.participants.length}</div>
              <div className="text-sm text-gray-600">Participants</div>
            </div>
            {challenge.targetAmount && (
              <div className="text-center">
                <div className="text-2xl font-bold text-green-600">${challenge.targetAmount}</div>
                <div className="text-sm text-gray-600">Target Amount</div>
              </div>
            )}
            <div className="text-center">
              <div className="text-2xl font-bold text-orange-600">
                {challenge.status === 'active' ? calculateTimeRemaining().split(' ')[0] : challenge.duration}
              </div>
              <div className="text-sm text-gray-600">
                {challenge.status === 'active' ? 'Days Left' : 'Duration (Days)'}
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex justify-center gap-3 mb-6">
            {isParticipating ? (
              <>
                <Button
                  onClick={onLeave}
                  variant="outline"
                  className="text-red-600 border-red-300 hover:bg-red-50"
                >
                  Leave Challenge
                </Button>
                <Button className="flex items-center gap-2">
                  <MessageCircle className="w-4 h-4" />
                  Chat
                </Button>
              </>
            ) : (
              <Button
                onClick={onJoin}
                disabled={challenge.status !== 'active' && challenge.status !== 'upcoming'}
                className="flex items-center gap-2"
              >
                <Users className="w-4 h-4" />
                Join Challenge
              </Button>
            )}
            <Button variant="outline" className="flex items-center gap-2">
              <Share2 className="w-4 h-4" />
              Share
            </Button>
          </div>
        </div>

        {/* User Progress (if participating) */}
        {isParticipating && userProgress && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-blue-900">Your Progress</h3>
              <div className="flex items-center gap-2">
                {getRankIcon(userProgress.rank)}
                <span className="text-sm font-medium text-blue-800">
                  Rank #{userProgress.rank}
                </span>
              </div>
            </div>
            
            {challenge.targetAmount && (
              <div className="mb-3">
                <div className="flex items-center justify-between text-sm text-blue-800 mb-1">
                  <span>Progress: ${userProgress.currentProgress.toFixed(2)}</span>
                  <span>{getProgressPercentage(userProgress).toFixed(1)}%</span>
                </div>
                <div className="w-full bg-blue-200 rounded-full h-3">
                  <div
                    className="bg-blue-600 h-3 rounded-full transition-all duration-300"
                    style={{ width: `${getProgressPercentage(userProgress)}%` }}
                  ></div>
                </div>
              </div>
            )}
            
            <div className="text-sm text-blue-700">
              {userProgress.isCompleted ? (
                <div className="flex items-center gap-2">
                  <CheckCircle className="w-4 h-4" />
                  <span>Challenge completed! 🎉</span>
                </div>
              ) : (
                <span>
                  Keep going! You need ${((challenge.targetAmount || 0) - userProgress.currentProgress).toFixed(2)} more to reach the goal.
                </span>
              )}
            </div>
          </div>
        )}

        {/* Tab Navigation */}
        <div className="border-b border-gray-200">
          <nav className="-mb-px flex space-x-8">
            {[
              { id: 'overview', label: 'Overview', icon: Target },
              { id: 'leaderboard', label: 'Leaderboard', icon: Trophy },
              { id: 'progress', label: 'Progress', icon: TrendingUp },
              { id: 'chat', label: 'Chat', icon: MessageCircle }
            ].map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as any)}
                  className={`py-2 px-1 border-b-2 font-medium text-sm flex items-center gap-2 ${
                    activeTab === tab.id
                      ? 'border-blue-500 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  {tab.label}
                </button>
              );
            })}
          </nav>
        </div>

        {/* Tab Content */}
        <div className="min-h-[300px]">
          {activeTab === 'overview' && (
            <OverviewTab challenge={challenge} />
          )}
          {activeTab === 'leaderboard' && (
            <LeaderboardTab challenge={challenge} />
          )}
          {activeTab === 'progress' && (
            <ProgressTab challenge={challenge} userProgress={userProgress} />
          )}
          {activeTab === 'chat' && (
            <ChatTab challenge={challenge} />
          )}
        </div>
      </div>
    </Modal>
  );
};

// Overview Tab
const OverviewTab: React.FC<{ challenge: Challenge }> = ({ challenge }) => {
  return (
    <div className="space-y-6">
      {/* Challenge Info */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="space-y-4">
          <div>
            <h4 className="font-semibold text-gray-900 mb-2">Challenge Details</h4>
            <div className="space-y-2 text-sm">
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-gray-400" />
                <span>Started: {challenge.startDate.toLocaleDateString()}</span>
              </div>
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-gray-400" />
                <span>Ends: {challenge.endDate.toLocaleDateString()}</span>
              </div>
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4 text-gray-400" />
                <span>
                  {challenge.participants.length} participants
                  {challenge.maxParticipants && ` (max ${challenge.maxParticipants})`}
                </span>
              </div>
            </div>
          </div>

          <div>
            <h4 className="font-semibold text-gray-900 mb-2">Created by</h4>
            <div className="flex items-center gap-3">
              {challenge.creator.profileImage ? (
                <img
                  src={challenge.creator.profileImage}
                  alt={challenge.creator.username}
                  className="w-10 h-10 rounded-full"
                />
              ) : (
                <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                  <span className="text-blue-600 font-semibold">
                    {challenge.creator.username.charAt(0).toUpperCase()}
                  </span>
                </div>
              )}
              <span className="font-medium text-gray-900">{challenge.creator.username}</span>
            </div>
          </div>
        </div>

        <div>
          <h4 className="font-semibold text-gray-900 mb-2">Rewards</h4>
          <div className="space-y-2">
            {challenge.rewards
              .sort((a, b) => a.position - b.position)
              .map((reward, index) => (
                <div key={reward.id} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                  <div className="flex items-center gap-2">
                    {index === 0 && <Crown className="w-4 h-4 text-yellow-500" />}
                    {index === 1 && <Medal className="w-4 h-4 text-gray-400" />}
                    {index === 2 && <Medal className="w-4 h-4 text-amber-600" />}
                    {index > 2 && <Gift className="w-4 h-4 text-blue-500" />}
                    <span className="text-sm font-medium">
                      {index === 0 ? '1st Place' : 
                       index === 1 ? '2nd Place' : 
                       index === 2 ? '3rd Place' : 
                       'Participation'}
                    </span>
                  </div>
                  <span className="text-sm text-gray-600">
                    {reward.type === 'points' && `${reward.value} points`}
                    {reward.type === 'money' && `$${reward.value}`}
                    {reward.type === 'badge' && reward.description}
                  </span>
                </div>
              ))}
          </div>
        </div>
      </div>
    </div>
  );
};

// Leaderboard Tab
const LeaderboardTab: React.FC<{ challenge: Challenge }> = ({ challenge }) => {
  const sortedParticipants = [...challenge.participants].sort((a, b) => b.currentProgress - a.currentProgress);

  return (
    <div className="space-y-4">
      <h4 className="font-semibold text-gray-900">Current Rankings</h4>
      <div className="space-y-2">
        {sortedParticipants.map((participant, index) => (
          <div
            key={participant.id}
            className={`flex items-center justify-between p-3 rounded-lg ${
              index < 3 ? 'bg-gradient-to-r from-yellow-50 to-orange-50 border border-yellow-200' : 'bg-gray-50'
            }`}
          >
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center w-8 h-8">
                {index === 0 && <Crown className="w-5 h-5 text-yellow-500" />}
                {index === 1 && <Medal className="w-5 h-5 text-gray-400" />}
                {index === 2 && <Medal className="w-5 h-5 text-amber-600" />}
                {index > 2 && (
                  <span className="text-sm font-bold text-gray-600">#{index + 1}</span>
                )}
              </div>
              
              {participant.user.profileImage ? (
                <img
                  src={participant.user.profileImage}
                  alt={participant.user.username}
                  className="w-8 h-8 rounded-full"
                />
              ) : (
                <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                  <span className="text-xs text-blue-600 font-medium">
                    {participant.user.username.charAt(0).toUpperCase()}
                  </span>
                </div>
              )}
              
              <div>
                <div className="font-medium text-gray-900">{participant.user.username}</div>
                <div className="text-xs text-gray-600">Level {participant.user.level}</div>
              </div>
            </div>
            
            <div className="text-right">
              <div className="font-semibold text-gray-900">
                ${participant.currentProgress.toFixed(2)}
              </div>
              {challenge.targetAmount && (
                <div className="text-xs text-gray-600">
                  {((participant.currentProgress / challenge.targetAmount) * 100).toFixed(1)}%
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

// Progress Tab
const ProgressTab: React.FC<{ 
  challenge: Challenge; 
  userProgress: ChallengeParticipant | null; 
}> = ({ challenge, userProgress }) => {
  return (
    <div className="space-y-6">
      <h4 className="font-semibold text-gray-900">Progress Tracking</h4>
      
      {userProgress ? (
        <div className="space-y-4">
          <div className="p-4 bg-blue-50 rounded-lg">
            <h5 className="font-medium text-blue-900 mb-2">Your Daily Progress</h5>
            <div className="grid grid-cols-7 gap-2">
              {userProgress.dailyProgress?.slice(-7).map((day, index) => (
                <div
                  key={index}
                  className={`p-2 rounded text-center text-xs ${
                    day.isActive 
                      ? 'bg-green-100 text-green-800' 
                      : 'bg-gray-100 text-gray-600'
                  }`}
                >
                  <div className="font-medium">${day.amount.toFixed(0)}</div>
                  <div>{day.date.toLocaleDateString('en-US', { weekday: 'short' })}</div>
                </div>
              ))}
            </div>
          </div>
          
          <div className="text-center text-gray-600">
            <p>Keep up the great work! Your consistency is paying off.</p>
          </div>
        </div>
      ) : (
        <div className="text-center py-8">
          <TrendingUp className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <h5 className="font-medium text-gray-900 mb-2">Join to Track Progress</h5>
          <p className="text-gray-600">
            Join this challenge to see detailed progress tracking and daily statistics.
          </p>
        </div>
      )}
    </div>
  );
};

// Chat Tab
const ChatTab: React.FC<{ challenge: Challenge }> = ({ challenge }) => {
  return (
    <div className="text-center py-8">
      <MessageCircle className="w-12 h-12 text-gray-400 mx-auto mb-4" />
      <h5 className="font-medium text-gray-900 mb-2">Challenge Chat</h5>
      <p className="text-gray-600">
        Chat functionality coming soon! Connect with other participants and share your progress.
      </p>
    </div>
  );
};