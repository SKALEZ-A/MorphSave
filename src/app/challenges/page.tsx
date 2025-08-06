'use client';

import React from 'react';
import { 
  MainLayout,
  ChallengeCard,
  ChallengeCreator,
  Leaderboard,
  SocialShare,
  Button,
  Badge
} from '../../components';
import { Plus, Filter, Search } from 'lucide-react';

export default function ChallengesPage() {
  const [showCreateChallenge, setShowCreateChallenge] = React.useState(false);
  const [selectedChallenge, setSelectedChallenge] = React.useState(null);
  const [showShareModal, setShowShareModal] = React.useState(false);
  const [filter, setFilter] = React.useState('all');
  const [isLoading, setIsLoading] = React.useState(false);

  // Mock user data
  const user = {
    id: '1',
    username: 'johndoe',
    profileImage: undefined,
    totalSaved: 1247.50,
    level: 5,
    totalPoints: 2450
  };

  // Mock challenges data
  const mockChallenges = [
    {
      id: '1',
      title: 'New Year Savings Sprint',
      description: 'Save $500 in the first month of the year to kickstart your financial goals!',
      type: 'savings_amount' as const,
      targetAmount: 500,
      duration: 30,
      startDate: new Date('2024-01-01'),
      endDate: new Date('2024-01-31'),
      status: 'active' as const,
      participantCount: 127,
      maxParticipants: 200,
      creatorUsername: 'admin',
      isParticipating: true,
      userProgress: 247.50,
      rewards: {
        points: 300,
        badge: 'New Year Champion',
        specialReward: 'Exclusive NFT Badge'
      }
    },
    {
      id: '2',
      title: '7-Day Streak Challenge',
      description: 'Build the habit of daily savings by maintaining a 7-day consecutive streak.',
      type: 'streak' as const,
      duration: 7,
      startDate: new Date('2024-02-01'),
      endDate: new Date('2024-02-07'),
      status: 'active' as const,
      participantCount: 89,
      creatorUsername: 'alice_saves',
      isParticipating: false,
      rewards: {
        points: 150,
        badge: 'Streak Master'
      }
    },
    {
      id: '3',
      title: 'Friends & Family Savings',
      description: 'Invite your friends and family to save together. The more the merrier!',
      type: 'social' as const,
      duration: 14,
      startDate: new Date('2024-01-15'),
      endDate: new Date('2024-01-29'),
      status: 'active' as const,
      participantCount: 45,
      maxParticipants: 50,
      creatorUsername: 'bob_builder',
      isParticipating: true,
      userProgress: 3,
      rewards: {
        points: 200,
        specialReward: 'Group Photo NFT'
      }
    },
    {
      id: '4',
      title: 'Coffee Money Challenge',
      description: 'Skip your daily coffee and save that money instead. Small changes, big impact!',
      type: 'savings_amount' as const,
      targetAmount: 150,
      duration: 30,
      startDate: new Date('2024-01-01'),
      endDate: new Date('2024-01-31'),
      status: 'completed' as const,
      participantCount: 234,
      creatorUsername: 'charlie_crypto',
      isParticipating: true,
      userProgress: 150,
      rewards: {
        points: 100,
        badge: 'Coffee Saver'
      }
    },
    {
      id: '5',
      title: 'Weekend Warrior',
      description: 'Save extra on weekends when you have more time to focus on your goals.',
      type: 'streak' as const,
      duration: 8,
      startDate: new Date('2024-02-10'),
      endDate: new Date('2024-02-17'),
      status: 'active' as const,
      participantCount: 67,
      creatorUsername: 'diana_defi',
      isParticipating: false,
      rewards: {
        points: 120
      }
    }
  ];

  // Mock leaderboard data for challenges
  const mockChallengeLeaderboard = [
    {
      id: '1',
      userId: '2',
      username: 'alice_saves',
      rank: 1,
      score: 8,
      level: 8,
      totalSaved: 3500.00,
      streak: 25
    },
    {
      id: '2',
      userId: '3',
      username: 'bob_builder',
      rank: 2,
      score: 6,
      level: 7,
      totalSaved: 2800.00,
      streak: 18
    },
    {
      id: '3',
      userId: '1',
      username: 'johndoe',
      rank: 3,
      score: 4,
      level: 5,
      totalSaved: 1247.50,
      streak: 12,
      isCurrentUser: true
    },
    {
      id: '4',
      userId: '4',
      username: 'charlie_crypto',
      rank: 4,
      score: 3,
      level: 6,
      totalSaved: 2200.00,
      streak: 22
    }
  ];

  const filteredChallenges = React.useMemo(() => {
    if (filter === 'all') return mockChallenges;
    if (filter === 'participating') return mockChallenges.filter(c => c.isParticipating);
    if (filter === 'available') return mockChallenges.filter(c => !c.isParticipating && c.status === 'active');
    return mockChallenges.filter(c => c.status === filter);
  }, [filter]);

  const handleCreateChallenge = async (challengeData: any) => {
    setIsLoading(true);
    try {
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 2000));
      console.log('Creating challenge:', challengeData);
      setShowCreateChallenge(false);
    } catch (error) {
      console.error('Failed to create challenge:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleJoinChallenge = async (challengeId: string) => {
    console.log('Joining challenge:', challengeId);
    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 1000));
  };

  const handleLeaveChallenge = async (challengeId: string) => {
    console.log('Leaving challenge:', challengeId);
    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 1000));
  };

  const handleShareChallenge = (challenge: any) => {
    setSelectedChallenge(challenge);
    setShowShareModal(true);
  };

  const handleViewDetails = (challenge: any) => {
    console.log('View challenge details:', challenge);
  };

  const handleShare = (platform: string) => {
    console.log('Shared on:', platform);
    setShowShareModal(false);
  };

  const filterOptions = [
    { value: 'all', label: 'All Challenges', count: mockChallenges.length },
    { value: 'participating', label: 'My Challenges', count: mockChallenges.filter(c => c.isParticipating).length },
    { value: 'available', label: 'Available', count: mockChallenges.filter(c => !c.isParticipating && c.status === 'active').length },
    { value: 'active', label: 'Active', count: mockChallenges.filter(c => c.status === 'active').length },
    { value: 'completed', label: 'Completed', count: mockChallenges.filter(c => c.status === 'completed').length }
  ];

  return (
    <MainLayout user={user}>
      <div className="space-y-6">
        {/* Page Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
              Savings Challenges
            </h1>
            <p className="text-gray-600 dark:text-gray-400">
              Join challenges, compete with friends, and achieve your savings goals together
            </p>
          </div>
          
          <Button
            onClick={() => setShowCreateChallenge(true)}
            className="flex items-center space-x-2"
          >
            <Plus className="h-4 w-4" />
            <span>Create Challenge</span>
          </Button>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-2">
          {filterOptions.map((option) => (
            <Button
              key={option.value}
              variant={filter === option.value ? 'default' : 'outline'}
              size="sm"
              onClick={() => setFilter(option.value)}
              className="flex items-center space-x-2"
            >
              <span>{option.label}</span>
              <Badge variant="secondary" size="sm">
                {option.count}
              </Badge>
            </Button>
          ))}
        </div>

        {/* Main Content Grid */}
        <div className="grid lg:grid-cols-4 gap-6">
          {/* Challenges List */}
          <div className="lg:col-span-3">
            {showCreateChallenge ? (
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                    Create New Challenge
                  </h2>
                  <Button
                    variant="outline"
                    onClick={() => setShowCreateChallenge(false)}
                  >
                    Cancel
                  </Button>
                </div>
                <ChallengeCreator
                  onCreateChallenge={handleCreateChallenge}
                  isLoading={isLoading}
                />
              </div>
            ) : (
              <div className="space-y-4">
                {filteredChallenges.length > 0 ? (
                  <div className="grid gap-4">
                    {filteredChallenges.map((challenge) => (
                      <ChallengeCard
                        key={challenge.id}
                        challenge={challenge}
                        onJoin={handleJoinChallenge}
                        onLeave={handleLeaveChallenge}
                        onShare={handleShareChallenge}
                        onViewDetails={handleViewDetails}
                      />
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-12">
                    <div className="text-gray-400 dark:text-gray-600 mb-4">
                      <Search className="h-12 w-12 mx-auto" />
                    </div>
                    <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">
                      No challenges found
                    </h3>
                    <p className="text-gray-500 dark:text-gray-400 mb-4">
                      {filter === 'all' 
                        ? 'No challenges available at the moment.'
                        : `No ${filter} challenges found. Try a different filter.`
                      }
                    </p>
                    {filter === 'all' && (
                      <Button
                        onClick={() => setShowCreateChallenge(true)}
                        className="flex items-center space-x-2"
                      >
                        <Plus className="h-4 w-4" />
                        <span>Create First Challenge</span>
                      </Button>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Challenge Leaderboard */}
          <div className="lg:col-span-1">
            <Leaderboard
              entries={mockChallengeLeaderboard}
              type="points"
              timeframe="monthly"
              onViewProfile={(userId) => console.log('View profile:', userId)}
              onTimeframeChange={(timeframe) => console.log('Timeframe changed:', timeframe)}
            />
          </div>
        </div>
      </div>

      {/* Social Share Modal */}
      <SocialShare
        isOpen={showShareModal}
        onClose={() => setShowShareModal(false)}
        challenge={selectedChallenge}
        onShare={handleShare}
      />
    </MainLayout>
  );
}