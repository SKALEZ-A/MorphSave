'use client';

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/Card';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';
import { Modal } from '../ui/Modal';
import { 
  Trophy, 
  Star, 
  Lock, 
  Unlock,
  Share2,
  Download,
  Filter,
  Search
} from 'lucide-react';
import { Input } from '../ui/Input';
import { motion, AnimatePresence } from 'framer-motion';

interface Achievement {
  id: string;
  name: string;
  description: string;
  icon: string;
  category: 'savings' | 'social' | 'streak' | 'special';
  rarity: 'common' | 'rare' | 'epic' | 'legendary';
  pointsReward: number;
  unlockedAt?: Date;
  progress?: number;
  maxProgress?: number;
  requirements: string[];
}

interface AchievementGalleryProps {
  achievements: Achievement[];
  onShare?: (achievement: Achievement) => void;
  onViewDetails?: (achievement: Achievement) => void;
  className?: string;
}

const AchievementGallery: React.FC<AchievementGalleryProps> = ({
  achievements,
  onShare,
  onViewDetails,
  className
}) => {
  const [selectedAchievement, setSelectedAchievement] = React.useState<Achievement | null>(null);
  const [filter, setFilter] = React.useState<string>('all');
  const [searchTerm, setSearchTerm] = React.useState('');
  const [showUnlockedOnly, setShowUnlockedOnly] = React.useState(false);

  const categories = [
    { value: 'all', label: 'All Categories', icon: Trophy },
    { value: 'savings', label: 'Savings', icon: Trophy },
    { value: 'social', label: 'Social', icon: Trophy },
    { value: 'streak', label: 'Streak', icon: Trophy },
    { value: 'special', label: 'Special', icon: Star },
  ];

  const rarityColors = {
    common: 'border-gray-300 bg-gray-50 dark:border-gray-600 dark:bg-gray-800',
    rare: 'border-blue-300 bg-blue-50 dark:border-blue-600 dark:bg-blue-900/20',
    epic: 'border-purple-300 bg-purple-50 dark:border-purple-600 dark:bg-purple-900/20',
    legendary: 'border-yellow-300 bg-yellow-50 dark:border-yellow-600 dark:bg-yellow-900/20'
  };

  const rarityBadgeVariants = {
    common: 'secondary' as const,
    rare: 'info' as const,
    epic: 'secondary' as const,
    legendary: 'warning' as const
  };

  const filteredAchievements = React.useMemo(() => {
    return achievements.filter(achievement => {
      const matchesCategory = filter === 'all' || achievement.category === filter;
      const matchesSearch = !searchTerm || 
        achievement.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        achievement.description.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesUnlocked = !showUnlockedOnly || achievement.unlockedAt;
      
      return matchesCategory && matchesSearch && matchesUnlocked;
    });
  }, [achievements, filter, searchTerm, showUnlockedOnly]);

  const stats = React.useMemo(() => {
    const unlocked = achievements.filter(a => a.unlockedAt).length;
    const total = achievements.length;
    const totalPoints = achievements
      .filter(a => a.unlockedAt)
      .reduce((sum, a) => sum + a.pointsReward, 0);
    
    return { unlocked, total, totalPoints };
  }, [achievements]);

  const handleAchievementClick = (achievement: Achievement) => {
    setSelectedAchievement(achievement);
    onViewDetails?.(achievement);
  };

  const handleShare = (achievement: Achievement) => {
    onShare?.(achievement);
  };

  const getProgressPercentage = (achievement: Achievement) => {
    if (!achievement.maxProgress) return 0;
    return Math.min((achievement.progress || 0) / achievement.maxProgress * 100, 100);
  };

  return (
    <>
      <Card variant="elevated" className={className}>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center space-x-2">
              <Trophy className="h-5 w-5 text-yellow-600" />
              <span>Achievement Gallery</span>
            </CardTitle>
            <div className="flex items-center space-x-2">
              <Badge variant="secondary" size="sm">
                {stats.unlocked}/{stats.total}
              </Badge>
              <Badge variant="warning" size="sm">
                {stats.totalPoints} pts
              </Badge>
            </div>
          </div>

          {/* Filters and Search */}
          <div className="flex flex-col sm:flex-row gap-3 mt-4">
            <div className="flex-1">
              <Input
                placeholder="Search achievements..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                leftIcon={<Search className="h-4 w-4" />}
              />
            </div>
            <select
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
            >
              {categories.map(category => (
                <option key={category.value} value={category.value}>
                  {category.label}
                </option>
              ))}
            </select>
            <label className="flex items-center space-x-2 text-sm">
              <input
                type="checkbox"
                checked={showUnlockedOnly}
                onChange={(e) => setShowUnlockedOnly(e.target.checked)}
                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              <span className="text-gray-700 dark:text-gray-300">Unlocked only</span>
            </label>
          </div>
        </CardHeader>

        <CardContent>
          {/* Achievement Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            <AnimatePresence>
              {filteredAchievements.map((achievement, index) => {
                const isUnlocked = !!achievement.unlockedAt;
                const progress = getProgressPercentage(achievement);
                
                return (
                  <motion.div
                    key={achievement.id}
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.9 }}
                    transition={{ duration: 0.2, delay: index * 0.05 }}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                  >
                    <div
                      className={`relative p-4 rounded-lg border-2 cursor-pointer transition-all ${
                        rarityColors[achievement.rarity]
                      } ${isUnlocked ? 'shadow-md' : 'opacity-60'}`}
                      onClick={() => handleAchievementClick(achievement)}
                    >
                      {/* Rarity Badge */}
                      <div className="absolute top-2 right-2">
                        <Badge 
                          variant={rarityBadgeVariants[achievement.rarity]} 
                          size="sm"
                        >
                          {achievement.rarity}
                        </Badge>
                      </div>

                      {/* Achievement Icon */}
                      <div className="text-center mb-3">
                        <div className={`text-4xl mb-2 ${isUnlocked ? '' : 'grayscale'}`}>
                          {achievement.icon}
                        </div>
                        {isUnlocked ? (
                          <Unlock className="h-4 w-4 text-green-600 mx-auto" />
                        ) : (
                          <Lock className="h-4 w-4 text-gray-400 mx-auto" />
                        )}
                      </div>

                      {/* Achievement Info */}
                      <div className="text-center">
                        <h3 className={`font-semibold text-sm mb-1 ${
                          isUnlocked 
                            ? 'text-gray-900 dark:text-gray-100' 
                            : 'text-gray-500 dark:text-gray-400'
                        }`}>
                          {achievement.name}
                        </h3>
                        <p className="text-xs text-gray-600 dark:text-gray-400 mb-2 line-clamp-2">
                          {achievement.description}
                        </p>
                        
                        {/* Points Reward */}
                        <div className="flex items-center justify-center space-x-1 mb-2">
                          <Star className="h-3 w-3 text-yellow-500" />
                          <span className="text-xs font-medium text-gray-700 dark:text-gray-300">
                            {achievement.pointsReward} pts
                          </span>
                        </div>

                        {/* Progress Bar (for locked achievements) */}
                        {!isUnlocked && achievement.maxProgress && (
                          <div className="mt-2">
                            <div className="w-full bg-gray-200 rounded-full h-1.5 dark:bg-gray-700">
                              <motion.div
                                initial={{ width: 0 }}
                                animate={{ width: `${progress}%` }}
                                transition={{ duration: 0.5, delay: index * 0.1 }}
                                className="bg-blue-600 h-1.5 rounded-full"
                              />
                            </div>
                            <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                              {achievement.progress}/{achievement.maxProgress}
                            </div>
                          </div>
                        )}

                        {/* Unlock Date */}
                        {isUnlocked && achievement.unlockedAt && (
                          <div className="text-xs text-green-600 dark:text-green-400 mt-1">
                            Unlocked {achievement.unlockedAt.toLocaleDateString()}
                          </div>
                        )}
                      </div>

                      {/* Share Button (for unlocked achievements) */}
                      {isUnlocked && (
                        <motion.button
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          className="absolute bottom-2 right-2 p-1 rounded-full bg-white dark:bg-gray-800 shadow-md hover:shadow-lg transition-shadow"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleShare(achievement);
                          }}
                        >
                          <Share2 className="h-3 w-3 text-gray-600 dark:text-gray-400" />
                        </motion.button>
                      )}
                    </div>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>

          {/* Empty State */}
          {filteredAchievements.length === 0 && (
            <div className="text-center py-8">
              <Trophy className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">
                No achievements found
              </h3>
              <p className="text-gray-500 dark:text-gray-400">
                {searchTerm || filter !== 'all' || showUnlockedOnly
                  ? 'Try adjusting your search or filter criteria'
                  : 'Start saving to unlock your first achievement!'
                }
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Achievement Detail Modal */}
      <Modal
        isOpen={!!selectedAchievement}
        onClose={() => setSelectedAchievement(null)}
        title={selectedAchievement?.name}
        size="md"
      >
        {selectedAchievement && (
          <div className="space-y-4">
            <div className="text-center">
              <div className="text-6xl mb-4">
                {selectedAchievement.icon}
              </div>
              <div className="flex items-center justify-center space-x-2 mb-2">
                <Badge variant={rarityBadgeVariants[selectedAchievement.rarity]}>
                  {selectedAchievement.rarity}
                </Badge>
                <Badge variant="secondary">
                  {selectedAchievement.category}
                </Badge>
              </div>
              <p className="text-gray-600 dark:text-gray-400 mb-4">
                {selectedAchievement.description}
              </p>
            </div>

            {/* Requirements */}
            <div>
              <h4 className="font-medium text-gray-900 dark:text-gray-100 mb-2">
                Requirements:
              </h4>
              <ul className="space-y-1">
                {selectedAchievement.requirements.map((req, index) => (
                  <li key={index} className="flex items-center space-x-2 text-sm text-gray-600 dark:text-gray-400">
                    <div className="w-1.5 h-1.5 bg-blue-600 rounded-full" />
                    <span>{req}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Reward */}
            <div className="bg-yellow-50 dark:bg-yellow-900/20 p-3 rounded-lg">
              <div className="flex items-center space-x-2">
                <Star className="h-5 w-5 text-yellow-600" />
                <span className="font-medium text-yellow-800 dark:text-yellow-200">
                  Reward: {selectedAchievement.pointsReward} points
                </span>
              </div>
            </div>

            {/* Actions */}
            <div className="flex space-x-3">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => setSelectedAchievement(null)}
              >
                Close
              </Button>
              {selectedAchievement.unlockedAt && (
                <Button
                  className="flex-1"
                  onClick={() => handleShare(selectedAchievement)}
                >
                  <Share2 className="h-4 w-4 mr-2" />
                  Share
                </Button>
              )}
            </div>
          </div>
        )}
      </Modal>
    </>
  );
};

export { AchievementGallery };