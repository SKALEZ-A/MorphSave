'use client';

import React, { useState, useEffect } from 'react';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Modal } from '../ui/Modal';
import { 
  Trophy, 
  Plus, 
  Users, 
  Calendar, 
  Target, 
  Clock,
  Star,
  TrendingUp,
  Award,
  CheckCircle
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
}

interface ChallengeReward {
  id: string;
  type: 'points' | 'badge' | 'money';
  value: number;
  description: string;
  position: number; // 1st, 2nd, 3rd place, etc.
}

export const ChallengeManager: React.FC = () => {
  const [challenges, setChallenges] = useState<Challenge[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedChallenge, setSelectedChallenge] = useState<Challenge | null>(null);
  const [activeTab, setActiveTab] = useState<'active' | 'upcoming' | 'completed' | 'my-challenges'>('active');

  useEffect(() => {
    loadChallenges();
  }, [activeTab]);

  const loadChallenges = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/social/challenges?status=${activeTab}`);
      if (response.ok) {
        const data = await response.json();
        setChallenges(data.data);
      }
    } catch (error) {
      console.error('Error loading challenges:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleJoinChallenge = async (challengeId: string) => {
    try {
      const response = await fetch(`/api/social/challenges/${challengeId}/join`, {
        method: 'POST'
      });
      
      if (response.ok) {
        await loadChallenges();
      }
    } catch (error) {
      console.error('Error joining challenge:', error);
    }
  };

  const handleLeaveChallenge = async (challengeId: string) => {
    try {
      const response = await fetch(`/api/social/challenges/${challengeId}/leave`, {
        method: 'POST'
      });
      
      if (response.ok) {
        await loadChallenges();
      }
    } catch (error) {
      console.error('Error leaving challenge:', error);
    }
  };

  const getStatusColor = (status: Challenge['status']) => {
    switch (status) {
      case 'active':
        return 'bg-green-100 text-green-800';
      case 'upcoming':
        return 'bg-blue-100 text-blue-800';
      case 'completed':
        return 'bg-gray-100 text-gray-800';
      case 'cancelled':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getTypeIcon = (type: Challenge['type']) => {
    switch (type) {
      case 'savings_amount':
        return <Target className="w-4 h-4" />;
      case 'streak':
        return <TrendingUp className="w-4 h-4" />;
      case 'social':
        return <Users className="w-4 h-4" />;
      default:
        return <Trophy className="w-4 h-4" />;
    }
  };

  const formatDuration = (days: number) => {
    if (days === 1) return '1 day';
    if (days < 7) return `${days} days`;
    if (days === 7) return '1 week';
    if (days < 30) return `${Math.floor(days / 7)} weeks`;
    if (days === 30) return '1 month';
    return `${Math.floor(days / 30)} months`;
  };

  const calculateTimeRemaining = (endDate: Date) => {
    const now = new Date();
    const diff = endDate.getTime() - now.getTime();
    const days = Math.ceil(diff / (1000 * 60 * 60 * 24));
    
    if (days <= 0) return 'Ended';
    if (days === 1) return '1 day left';
    if (days < 7) return `${days} days left`;
    if (days < 30) return `${Math.floor(days / 7)} weeks left`;
    return `${Math.floor(days / 30)} months left`;
  };

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow-sm border p-6">
        <div className="animate-pulse">
          <div className="h-6 bg-gray-200 rounded w-1/4 mb-4"></div>
          <div className="space-y-4">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="border border-gray-200 rounded-lg p-4">
                <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
                <div className="h-3 bg-gray-200 rounded w-1/2"></div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-sm border">
      {/* Header */}
      <div className="p-6 border-b border-gray-200">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <Trophy className="w-6 h-6 text-yellow-600" />
            <h2 className="text-xl font-semibold text-gray-900">Savings Challenges</h2>
          </div>
          <Button
            onClick={() => setShowCreateModal(true)}
            className="flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            Create Challenge
          </Button>
        </div>

        {/* Tab Navigation */}
        <div className="flex space-x-6">
          {[
            { id: 'active', label: 'Active', count: challenges.filter(c => c.status === 'active').length },
            { id: 'upcoming', label: 'Upcoming', count: challenges.filter(c => c.status === 'upcoming').length },
            { id: 'completed', label: 'Completed', count: challenges.filter(c => c.status === 'completed').length },
            { id: 'my-challenges', label: 'My Challenges', count: 0 }
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`pb-2 border-b-2 font-medium text-sm ${
                activeTab === tab.id
                  ? 'border-yellow-500 text-yellow-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              {tab.label} ({tab.count})
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="p-6">
        {challenges.length === 0 ? (
          <div className="text-center py-8">
            <Trophy className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              {activeTab === 'active' ? 'No active challenges' : 
               activeTab === 'upcoming' ? 'No upcoming challenges' :
               activeTab === 'completed' ? 'No completed challenges' :
               'No challenges created'}
            </h3>
            <p className="text-gray-600 mb-4">
              {activeTab === 'my-challenges' 
                ? 'Create your first challenge to compete with friends!'
                : 'Join a challenge to compete with other savers and earn rewards!'
              }
            </p>
            <Button onClick={() => setShowCreateModal(true)}>
              Create Your First Challenge
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {challenges.map((challenge) => (
              <ChallengeCard
                key={challenge.id}
                challenge={challenge}
                onJoin={() => handleJoinChallenge(challenge.id)}
                onLeave={() => handleLeaveChallenge(challenge.id)}
                onViewDetails={() => setSelectedChallenge(challenge)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Create Challenge Modal */}
      {showCreateModal && (
        <ChallengeCreateModal
          isOpen={showCreateModal}
          onClose={() => setShowCreateModal(false)}
          onSuccess={() => {
            setShowCreateModal(false);
            loadChallenges();
          }}
        />
      )}

      {/* Challenge Details Modal */}
      {selectedChallenge && (
        <ChallengeDetailsModal
          challenge={selectedChallenge}
          onClose={() => setSelectedChallenge(null)}
          onJoin={() => handleJoinChallenge(selectedChallenge.id)}
          onLeave={() => handleLeaveChallenge(selectedChallenge.id)}
        />
      )}
    </div>
  );
};

// Challenge Card Component
interface ChallengeCardProps {
  challenge: Challenge;
  onJoin: () => void;
  onLeave: () => void;
  onViewDetails: () => void;
}

const ChallengeCard: React.FC<ChallengeCardProps> = ({ 
  challenge, 
  onJoin, 
  onLeave, 
  onViewDetails 
}) => {
  const isParticipating = challenge.participants.some(p => p.userId === 'current-user-id'); // TODO: Get actual user ID
  const progressPercentage = challenge.targetAmount 
    ? (challenge.participants[0]?.currentProgress || 0) / challenge.targetAmount * 100
    : 0;

  return (
    <div className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow">
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2">
          {getTypeIcon(challenge.type)}
          <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(challenge.status)}`}>
            {challenge.status}
          </span>
        </div>
        <div className="flex items-center gap-1 text-gray-500">
          <Users className="w-3 h-3" />
          <span className="text-xs">{challenge.participants.length}</span>
          {challenge.maxParticipants && (
            <span className="text-xs">/{challenge.maxParticipants}</span>
          )}
        </div>
      </div>

      {/* Title and Description */}
      <h3 className="font-semibold text-gray-900 mb-2">{challenge.title}</h3>
      <p className="text-sm text-gray-600 mb-3 line-clamp-2">{challenge.description}</p>

      {/* Challenge Details */}
      <div className="space-y-2 mb-4">
        {challenge.targetAmount && (
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-600">Target:</span>
            <span className="font-medium">${challenge.targetAmount}</span>
          </div>
        )}
        <div className="flex items-center justify-between text-sm">
          <span className="text-gray-600">Duration:</span>
          <span className="font-medium">{formatDuration(challenge.duration)}</span>
        </div>
        {challenge.status === 'active' && (
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-600">Time left:</span>
            <span className="font-medium text-orange-600">
              {calculateTimeRemaining(challenge.endDate)}
            </span>
          </div>
        )}
      </div>

      {/* Progress Bar (for active challenges) */}
      {challenge.status === 'active' && challenge.targetAmount && (
        <div className="mb-4">
          <div className="flex items-center justify-between text-xs text-gray-600 mb-1">
            <span>Progress</span>
            <span>{progressPercentage.toFixed(1)}%</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div
              className="bg-green-500 h-2 rounded-full transition-all duration-300"
              style={{ width: `${Math.min(progressPercentage, 100)}%` }}
            ></div>
          </div>
        </div>
      )}

      {/* Creator */}
      <div className="flex items-center gap-2 mb-4">
        {challenge.creator.profileImage ? (
          <img
            src={challenge.creator.profileImage}
            alt={challenge.creator.username}
            className="w-6 h-6 rounded-full"
          />
        ) : (
          <div className="w-6 h-6 bg-blue-100 rounded-full flex items-center justify-center">
            <span className="text-xs text-blue-600 font-medium">
              {challenge.creator.username.charAt(0).toUpperCase()}
            </span>
          </div>
        )}
        <span className="text-sm text-gray-600">by {challenge.creator.username}</span>
      </div>

      {/* Actions */}
      <div className="flex gap-2">
        <Button
          onClick={onViewDetails}
          variant="outline"
          size="sm"
          className="flex-1"
        >
          View Details
        </Button>
        {isParticipating ? (
          <Button
            onClick={onLeave}
            variant="outline"
            size="sm"
            className="text-red-600 border-red-300 hover:bg-red-50"
          >
            Leave
          </Button>
        ) : (
          <Button
            onClick={onJoin}
            size="sm"
            disabled={challenge.status !== 'active' && challenge.status !== 'upcoming'}
          >
            Join
          </Button>
        )}
      </div>
    </div>
  );
};

// Placeholder components (to be implemented)
const ChallengeCreateModal: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}> = ({ isOpen, onClose, onSuccess }) => {
  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Create New Challenge">
      <div className="text-center py-8">
        <p className="text-gray-600">Challenge creation form coming soon...</p>
        <Button onClick={onSuccess} className="mt-4">
          Create Sample Challenge
        </Button>
      </div>
    </Modal>
  );
};

const ChallengeDetailsModal: React.FC<{
  challenge: Challenge;
  onClose: () => void;
  onJoin: () => void;
  onLeave: () => void;
}> = ({ challenge, onClose, onJoin, onLeave }) => {
  return (
    <Modal isOpen={true} onClose={onClose} title={challenge.title}>
      <div className="space-y-4">
        <p className="text-gray-600">{challenge.description}</p>
        <div className="text-center py-4">
          <p className="text-gray-600">Challenge details view coming soon...</p>
        </div>
      </div>
    </Modal>
  );
};