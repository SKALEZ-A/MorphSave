'use client';

import React from 'react';
import { 
  MainLayout,
  AchievementGallery,
  Leaderboard,
  SocialShare,
  CelebrationModal
} from '../../components';

export default function AchievementsPage() {
  const [selectedAchievement, setSelectedAchievement] = React.useState(null);
  const [showShareModal, setShowShareModal] = React.useState(false);
  const [showCelebration, setShowCelebration] = React.useState(false);

  // Mock user data
  const user = {
    id: '1',
    username: 'johndoe',
    profileImage: undefined,
    totalSaved: 1247.50,
    level: 5,
    totalPoints: 2450
  };

  // Mock achievements data
  const mockAchievements = [
    {
      id: '1',
      name: 'First Steps',
      description: 'Complete your first savings transaction',
      icon: '👶',
      category: 'savings' as const,
      rarity: 'common' as const,
      pointsReward: 50,
      unlockedAt: new Date('2024-01-10'),
      requirements: ['Make your first deposit', 'Set up your profile']
    },
    {
      id: '2',
      name: 'Century Club',
      description: 'Save your first $100',
      icon: '💯',
      category: 'savings' as const,
      rarity: 'common' as const,
      pointsReward: 100,
      unlockedAt: new Date('2024-01-15'),
      requirements: ['Accumulate $100 in total savings']
    },
    {
      id: '3',
      name: 'Streak Master',
      description: 'Maintain a 7-day savings streak',
      icon: '🔥',
      category: 'streak' as const,
      rarity: 'rare' as const,
      pointsReward: 200,
      unlockedAt: new Date('2024-01-20'),
      requirements: ['Save money for 7 consecutive days']
    },
    {
      id: '4',
      name: 'Social Butterfly',
      description: 'Complete your first group challenge',
      icon: '🦋',
      category: 'social' as const,
      rarity: 'rare' as const,
      pointsReward: 150,
      unlockedAt: new Date('2024-01-25'),
      requirements: ['Join a challenge', 'Complete the challenge successfully']
    },
    {
      id: '5',
      name: 'Round-up Rookie',
      description: 'Enable automatic round-ups',
      icon: '🔄',
      category: 'savings' as const,
      rarity: 'common' as const,
      pointsReward: 75,
      unlockedAt: new Date('2024-01-12'),
      requirements: ['Connect a bank account', 'Enable round-up feature']
    },
    {
      id: '6',
      name: 'Thousand Club',
      description: 'Save your first $1,000',
      icon: '🏆',
      category: 'savings' as const,
      rarity: 'epic' as const,
      pointsReward: 500,
      unlockedAt: new Date('2024-02-01'),
      requirements: ['Accumulate $1,000 in total savings']
    },
    {
      id: '7',
      name: 'DeFi Explorer',
      description: 'Earn your first yield from DeFi protocols',
      icon: '🌟',
      category: 'special' as const,
      rarity: 'rare' as const,
      pointsReward: 300,
      unlockedAt: new Date('2024-01-30'),
      requirements: ['Enable auto-invest', 'Earn yield from DeFi protocols']
    },
    {
      id: '8',
      name: 'Challenge Creator',
      description: 'Create your first savings challenge',
      icon: '🎯',
      category: 'social' as const,
      rarity: 'epic' as const,
      pointsReward: 400,
      progress: 0,
      maxProgress: 1,
      requirements: ['Create a challenge', 'Have at least 3 participants join']
    },
    {
      id: '9',
      name: 'Legendary Saver',
      description: 'Save $10,000 and maintain a 30-day streak',
      icon: '👑',
      category: 'special' as const,
      rarity: 'legendary' as const,
      pointsReward: 2000,
      progress: 1247,
      maxProgress: 10000,
      requirements: [
        'Accumulate $10,000 in total savings',
        'Maintain a 30-day consecutive savings streak',
        'Complete 5 challenges'
      ]
    }
  ];

  // Mock leaderboard data
  const mockLeaderboard = [
    {
      id: '1',
      userId: '1',
      username: 'johndoe',
      rank: 4,
      previousRank: 5,
      score: 2450,
      level: 5,
      totalSaved: 1247.50,
      streak: 12,
      isCurrentUser: true
    },
    {
      id: '2',
      userId: '2',
      username: 'alice_saves',
      rank: 1,
      previousRank: 1,
      score: 5200,
      level: 8,
      totalSaved: 3500.00,
      streak: 25
    },
    {
      id: '3',
      userId: '3',
      username: 'bob_builder',
      rank: 2,
      previousRank: 3,
      score: 4100,
      level: 7,
      totalSaved: 2800.00,
      streak: 18
    },
    {
      id: '4',
      userId: '4',
      username: 'charlie_crypto',
      rank: 3,
      previousRank: 2,
      score: 3800,
      level: 6,
      totalSaved: 2200.00,
      streak: 22
    },
    {
      id: '5',
      userId: '5',
      username: 'diana_defi',
      rank: 5,
      previousRank: 4,
      score: 2200,
      level: 5,
      totalSaved: 1100.00,
      streak: 8
    }
  ];

  const handleShareAchievement = (achievement: any) => {
    setSelectedAchievement(achievement);
    setShowShareModal(true);
  };

  const handleViewDetails = (achievement: any) => {
    console.log('View achievement details:', achievement);
  };

  const handleShare = (platform: string) => {
    console.log('Shared on:', platform);
    setShowShareModal(false);
  };

  // Simulate achievement unlock
  const handleUnlockAchievement = () => {
    setShowCelebration(true);
  };

  return (
    <MainLayout user={user}>
      <div className="space-y-6">
        {/* Page Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
              Achievements
            </h1>
            <p className="text-gray-600 dark:text-gray-400">
              Track your progress and unlock rewards as you save
            </p>
          </div>
          
          {/* Test Celebration Button */}
          <button
            onClick={handleUnlockAchievement}
            className="px-4 py-2 bg-yellow-500 text-white rounded-lg hover:bg-yellow-600 transition-colors"
          >
            🎉 Test Celebration
          </button>
        </div>

        {/* Main Content Grid */}
        <div className="grid lg:grid-cols-4 gap-6">
          {/* Achievement Gallery */}
          <div className="lg:col-span-3">
            <AchievementGallery
              achievements={mockAchievements}
              onShare={handleShareAchievement}
              onViewDetails={handleViewDetails}
            />
          </div>

          {/* Points Leaderboard */}
          <div className="lg:col-span-1">
            <Leaderboard
              entries={mockLeaderboard}
              type="points"
              timeframe="all-time"
              onViewProfile={(userId) => console.log('View profile:', userId)}
            />
          </div>
        </div>
      </div>

      {/* Social Share Modal */}
      <SocialShare
        isOpen={showShareModal}
        onClose={() => setShowShareModal(false)}
        achievement={selectedAchievement}
        onShare={handleShare}
      />

      {/* Celebration Modal */}
      <CelebrationModal
        isOpen={showCelebration}
        onClose={() => setShowCelebration(false)}
        type="achievement"
        data={{
          title: 'Thousand Club',
          description: 'You\'ve successfully saved your first $1,000! This is a major milestone in your savings journey.',
          icon: '🏆',
          points: 500,
          badge: 'Savings Champion'
        }}
        onShare={() => {
          setShowCelebration(false);
          setShowShareModal(true);
        }}
      />
    </MainLayout>
  );
}