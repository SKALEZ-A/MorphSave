'use client';

import React from 'react';
import { Card, CardContent } from '../ui/Card';
import { Button } from '../ui/Button';
import { Modal } from '../ui/Modal';
import { Input } from '../ui/Input';
import { 
  Share2, 
  Twitter, 
  Facebook, 
  Copy,
  Download,
  Trophy,
  Star,
  CheckCircle
} from 'lucide-react';
import { motion } from 'framer-motion';

interface SocialShareProps {
  isOpen: boolean;
  onClose: () => void;
  achievement?: {
    id: string;
    name: string;
    description: string;
    icon: string;
    rarity: string;
    pointsReward: number;
  };
  challenge?: {
    id: string;
    title: string;
    description: string;
    type: string;
    userProgress?: number;
    targetAmount?: number;
  };
  milestone?: {
    type: 'savings' | 'streak' | 'level';
    value: number;
    description: string;
  };
  onShare?: (platform: string) => void;
}

const SocialShare: React.FC<SocialShareProps> = ({
  isOpen,
  onClose,
  achievement,
  challenge,
  milestone,
  onShare
}) => {
  const [copied, setCopied] = React.useState(false);
  const [customMessage, setCustomMessage] = React.useState('');

  const getShareContent = () => {
    if (achievement) {
      return {
        title: `🏆 Achievement Unlocked: ${achievement.name}!`,
        description: achievement.description,
        hashtags: ['MorphSave', 'Achievement', 'Savings', 'DeFi'],
        url: `https://morphsave.com/achievements/${achievement.id}`
      };
    }
    
    if (challenge) {
      return {
        title: `🎯 Challenge ${challenge.userProgress === challenge.targetAmount ? 'Completed' : 'Progress'}: ${challenge.title}`,
        description: challenge.description,
        hashtags: ['MorphSave', 'Challenge', 'Savings', 'Community'],
        url: `https://morphsave.com/challenges/${challenge.id}`
      };
    }
    
    if (milestone) {
      const milestoneText = {
        savings: `💰 Reached $${milestone.value} in total savings!`,
        streak: `🔥 ${milestone.value} day savings streak!`,
        level: `⭐ Level ${milestone.value} achieved!`
      };
      
      return {
        title: milestoneText[milestone.type],
        description: milestone.description,
        hashtags: ['MorphSave', 'Milestone', 'Savings', 'Progress'],
        url: 'https://morphsave.com'
      };
    }
    
    return {
      title: '🚀 Join me on MorphSave!',
      description: 'Gamified micro-savings that makes saving money fun and rewarding.',
      hashtags: ['MorphSave', 'Savings', 'DeFi', 'Blockchain'],
      url: 'https://morphsave.com'
    };
  };

  const shareContent = getShareContent();
  const fullMessage = customMessage || `${shareContent.title}\n\n${shareContent.description}\n\n${shareContent.url}`;

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(fullMessage);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error('Failed to copy:', error);
    }
  };

  const handlePlatformShare = (platform: string) => {
    const encodedMessage = encodeURIComponent(shareContent.title);
    const encodedUrl = encodeURIComponent(shareContent.url);
    const encodedHashtags = encodeURIComponent(shareContent.hashtags.join(','));
    
    let shareUrl = '';
    
    switch (platform) {
      case 'twitter':
        shareUrl = `https://twitter.com/intent/tweet?text=${encodedMessage}&url=${encodedUrl}&hashtags=${encodedHashtags}`;
        break;
      case 'facebook':
        shareUrl = `https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}&quote=${encodedMessage}`;
        break;
      case 'linkedin':
        shareUrl = `https://www.linkedin.com/sharing/share-offsite/?url=${encodedUrl}&title=${encodedMessage}`;
        break;
    }
    
    if (shareUrl) {
      window.open(shareUrl, '_blank', 'width=600,height=400');
      onShare?.(platform);
    }
  };

  const handleDownloadImage = () => {
    // This would generate and download a shareable image
    // For now, we'll just trigger the callback
    onShare?.('download');
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Share Your Success"
      size="md"
    >
      <div className="space-y-6">
        {/* Preview Card */}
        <Card variant="outlined" className="bg-gradient-to-br from-blue-50 to-purple-50 dark:from-blue-900/20 dark:to-purple-900/20">
          <CardContent className="p-6 text-center">
            {achievement && (
              <motion.div
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ duration: 0.5 }}
              >
                <div className="text-6xl mb-4">{achievement.icon}</div>
                <h3 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-2">
                  Achievement Unlocked!
                </h3>
                <p className="text-lg font-semibold text-blue-600 dark:text-blue-400 mb-2">
                  {achievement.name}
                </p>
                <p className="text-gray-600 dark:text-gray-400 mb-4">
                  {achievement.description}
                </p>
                <div className="flex items-center justify-center space-x-2">
                  <Star className="h-4 w-4 text-yellow-500" />
                  <span className="text-sm font-medium">
                    +{achievement.pointsReward} points
                  </span>
                </div>
              </motion.div>
            )}

            {challenge && (
              <motion.div
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ duration: 0.5 }}
              >
                <Trophy className="h-16 w-16 text-blue-600 mx-auto mb-4" />
                <h3 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-2">
                  Challenge Progress!
                </h3>
                <p className="text-lg font-semibold text-blue-600 dark:text-blue-400 mb-2">
                  {challenge.title}
                </p>
                <p className="text-gray-600 dark:text-gray-400 mb-4">
                  {challenge.description}
                </p>
                {challenge.targetAmount && challenge.userProgress && (
                  <div className="bg-white dark:bg-gray-800 rounded-lg p-3">
                    <div className="text-sm text-gray-600 dark:text-gray-400 mb-1">
                      Progress
                    </div>
                    <div className="text-lg font-bold text-gray-900 dark:text-gray-100">
                      ${challenge.userProgress} / ${challenge.targetAmount}
                    </div>
                  </div>
                )}
              </motion.div>
            )}

            {milestone && (
              <motion.div
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ duration: 0.5 }}
              >
                <div className="text-6xl mb-4">
                  {milestone.type === 'savings' && '💰'}
                  {milestone.type === 'streak' && '🔥'}
                  {milestone.type === 'level' && '⭐'}
                </div>
                <h3 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-2">
                  Milestone Reached!
                </h3>
                <p className="text-lg font-semibold text-blue-600 dark:text-blue-400 mb-2">
                  {milestone.type === 'savings' && `$${milestone.value} Total Savings`}
                  {milestone.type === 'streak' && `${milestone.value} Day Streak`}
                  {milestone.type === 'level' && `Level ${milestone.value}`}
                </p>
                <p className="text-gray-600 dark:text-gray-400">
                  {milestone.description}
                </p>
              </motion.div>
            )}
          </CardContent>
        </Card>

        {/* Custom Message */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Custom Message (Optional)
          </label>
          <textarea
            value={customMessage}
            onChange={(e) => setCustomMessage(e.target.value)}
            placeholder={`${shareContent.title}\n\n${shareContent.description}`}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
            rows={4}
            maxLength={280}
          />
          <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            {customMessage.length}/280 characters
          </div>
        </div>

        {/* Share Buttons */}
        <div className="space-y-4">
          <h4 className="font-medium text-gray-900 dark:text-gray-100">
            Share on Social Media
          </h4>
          
          <div className="grid grid-cols-2 gap-3">
            <Button
              variant="outline"
              onClick={() => handlePlatformShare('twitter')}
              className="flex items-center justify-center space-x-2"
            >
              <Twitter className="h-4 w-4 text-blue-400" />
              <span>Twitter</span>
            </Button>
            
            <Button
              variant="outline"
              onClick={() => handlePlatformShare('facebook')}
              className="flex items-center justify-center space-x-2"
            >
              <Facebook className="h-4 w-4 text-blue-600" />
              <span>Facebook</span>
            </Button>
            
            <Button
              variant="outline"
              onClick={() => handlePlatformShare('linkedin')}
              className="flex items-center justify-center space-x-2"
            >
              <Share2 className="h-4 w-4 text-blue-700" />
              <span>LinkedIn</span>
            </Button>
            
            <Button
              variant="outline"
              onClick={handleDownloadImage}
              className="flex items-center justify-center space-x-2"
            >
              <Download className="h-4 w-4 text-gray-600" />
              <span>Download</span>
            </Button>
          </div>
        </div>

        {/* Copy Link */}
        <div className="space-y-2">
          <h4 className="font-medium text-gray-900 dark:text-gray-100">
            Copy Link
          </h4>
          <div className="flex space-x-2">
            <Input
              value={shareContent.url}
              readOnly
              className="flex-1"
            />
            <Button
              variant="outline"
              onClick={handleCopyLink}
              className="flex items-center space-x-2"
            >
              {copied ? (
                <>
                  <CheckCircle className="h-4 w-4 text-green-600" />
                  <span>Copied!</span>
                </>
              ) : (
                <>
                  <Copy className="h-4 w-4" />
                  <span>Copy</span>
                </>
              )}
            </Button>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex space-x-3 pt-4 border-t border-gray-200 dark:border-gray-700">
          <Button
            variant="outline"
            onClick={onClose}
            className="flex-1"
          >
            Close
          </Button>
          <Button
            onClick={() => handlePlatformShare('twitter')}
            className="flex-1"
          >
            <Share2 className="h-4 w-4 mr-2" />
            Share Now
          </Button>
        </div>
      </div>
    </Modal>
  );
};

export { SocialShare };