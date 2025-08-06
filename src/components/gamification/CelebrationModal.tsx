'use client';

import React from 'react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import { 
  Trophy, 
  Star, 
  Share2,
  X,
  Sparkles,
  Gift
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface CelebrationModalProps {
  isOpen: boolean;
  onClose: () => void;
  type: 'achievement' | 'challenge' | 'milestone' | 'level_up';
  data: {
    title: string;
    description: string;
    icon?: string;
    points?: number;
    level?: number;
    badge?: string;
    specialReward?: string;
  };
  onShare?: () => void;
  onContinue?: () => void;
}

const CelebrationModal: React.FC<CelebrationModalProps> = ({
  isOpen,
  onClose,
  type,
  data,
  onShare,
  onContinue
}) => {
  const [showConfetti, setShowConfetti] = React.useState(false);

  React.useEffect(() => {
    if (isOpen) {
      setShowConfetti(true);
      const timer = setTimeout(() => setShowConfetti(false), 3000);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  const getTypeConfig = () => {
    switch (type) {
      case 'achievement':
        return {
          title: '🎉 Achievement Unlocked!',
          color: 'from-yellow-400 to-orange-500',
          bgColor: 'from-yellow-50 to-orange-50 dark:from-yellow-900/20 dark:to-orange-900/20',
          icon: Trophy,
          iconColor: 'text-yellow-600'
        };
      case 'challenge':
        return {
          title: '🏆 Challenge Completed!',
          color: 'from-blue-400 to-purple-500',
          bgColor: 'from-blue-50 to-purple-50 dark:from-blue-900/20 dark:to-purple-900/20',
          icon: Trophy,
          iconColor: 'text-blue-600'
        };
      case 'milestone':
        return {
          title: '🎯 Milestone Reached!',
          color: 'from-green-400 to-blue-500',
          bgColor: 'from-green-50 to-blue-50 dark:from-green-900/20 dark:to-blue-900/20',
          icon: Star,
          iconColor: 'text-green-600'
        };
      case 'level_up':
        return {
          title: '⭐ Level Up!',
          color: 'from-purple-400 to-pink-500',
          bgColor: 'from-purple-50 to-pink-50 dark:from-purple-900/20 dark:to-pink-900/20',
          icon: Sparkles,
          iconColor: 'text-purple-600'
        };
      default:
        return {
          title: '🎉 Congratulations!',
          color: 'from-blue-400 to-purple-500',
          bgColor: 'from-blue-50 to-purple-50 dark:from-blue-900/20 dark:to-purple-900/20',
          icon: Trophy,
          iconColor: 'text-blue-600'
        };
    }
  };

  const config = getTypeConfig();
  const Icon = config.icon;

  // Confetti animation components
  const ConfettiPiece = ({ delay }: { delay: number }) => (
    <motion.div
      initial={{ y: -100, x: Math.random() * 400 - 200, rotate: 0, opacity: 1 }}
      animate={{ 
        y: 600, 
        x: Math.random() * 400 - 200, 
        rotate: 360,
        opacity: 0 
      }}
      transition={{ 
        duration: 3, 
        delay,
        ease: "easeOut"
      }}
      className={`absolute w-2 h-2 bg-gradient-to-r ${config.color} rounded-full`}
    />
  );

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      showCloseButton={false}
      closeOnOverlayClick={false}
      size="md"
    >
      <div className="relative overflow-hidden">
        {/* Confetti Animation */}
        <AnimatePresence>
          {showConfetti && (
            <div className="absolute inset-0 pointer-events-none z-10">
              {[...Array(50)].map((_, i) => (
                <ConfettiPiece key={i} delay={i * 0.1} />
              ))}
            </div>
          )}
        </AnimatePresence>

        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 z-20 p-2 rounded-full bg-white/80 dark:bg-gray-800/80 hover:bg-white dark:hover:bg-gray-800 transition-colors"
        >
          <X className="h-4 w-4 text-gray-600 dark:text-gray-400" />
        </button>

        {/* Main Content */}
        <div className={`bg-gradient-to-br ${config.bgColor} p-8 text-center`}>
          {/* Animated Icon/Emoji */}
          <motion.div
            initial={{ scale: 0, rotate: -180 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{ 
              type: "spring", 
              stiffness: 260, 
              damping: 20,
              delay: 0.2 
            }}
            className="mb-6"
          >
            {data.icon ? (
              <div className="text-8xl mb-4">{data.icon}</div>
            ) : (
              <div className={`w-20 h-20 mx-auto mb-4 rounded-full bg-white dark:bg-gray-800 flex items-center justify-center shadow-lg`}>
                <Icon className={`h-10 w-10 ${config.iconColor}`} />
              </div>
            )}
          </motion.div>

          {/* Title */}
          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-2"
          >
            {config.title}
          </motion.h2>

          {/* Achievement/Challenge Name */}
          <motion.h3
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
            className={`text-xl font-semibold mb-4 bg-gradient-to-r ${config.color} bg-clip-text text-transparent`}
          >
            {data.title}
          </motion.h3>

          {/* Description */}
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6 }}
            className="text-gray-600 dark:text-gray-400 mb-6 max-w-md mx-auto"
          >
            {data.description}
          </motion.p>

          {/* Rewards Section */}
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.7 }}
            className="space-y-4 mb-8"
          >
            {/* Points */}
            {data.points && (
              <div className="flex items-center justify-center space-x-2">
                <Star className="h-5 w-5 text-yellow-500" />
                <span className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                  +{data.points} points earned!
                </span>
              </div>
            )}

            {/* Level */}
            {data.level && (
              <div className="flex items-center justify-center space-x-2">
                <Sparkles className="h-5 w-5 text-purple-500" />
                <span className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                  You're now Level {data.level}!
                </span>
              </div>
            )}

            {/* Badge */}
            {data.badge && (
              <div className="flex items-center justify-center">
                <Badge variant="warning" className="text-base px-4 py-2">
                  🏆 {data.badge}
                </Badge>
              </div>
            )}

            {/* Special Reward */}
            {data.specialReward && (
              <div className="bg-white/50 dark:bg-gray-800/50 rounded-lg p-4 backdrop-blur-sm">
                <div className="flex items-center justify-center space-x-2 mb-2">
                  <Gift className="h-5 w-5 text-pink-500" />
                  <span className="font-medium text-gray-900 dark:text-gray-100">
                    Special Reward
                  </span>
                </div>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  {data.specialReward}
                </p>
              </div>
            )}
          </motion.div>

          {/* Action Buttons */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.8 }}
            className="flex flex-col sm:flex-row gap-3 justify-center"
          >
            {onShare && (
              <Button
                onClick={onShare}
                className="flex items-center space-x-2"
                size="lg"
              >
                <Share2 className="h-4 w-4" />
                <span>Share Achievement</span>
              </Button>
            )}
            
            <Button
              variant={onShare ? "outline" : "default"}
              onClick={onContinue || onClose}
              size="lg"
              className="min-w-[120px]"
            >
              {onContinue ? 'Continue' : 'Awesome!'}
            </Button>
          </motion.div>
        </div>

        {/* Animated Background Elements */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          {[...Array(20)].map((_, i) => (
            <motion.div
              key={i}
              initial={{ 
                opacity: 0.1,
                scale: 0,
                x: Math.random() * 400,
                y: Math.random() * 400
              }}
              animate={{ 
                opacity: [0.1, 0.3, 0.1],
                scale: [0, 1, 0],
                rotate: 360
              }}
              transition={{
                duration: 4,
                delay: Math.random() * 2,
                repeat: Infinity,
                repeatType: "loop"
              }}
              className={`absolute w-4 h-4 rounded-full bg-gradient-to-r ${config.color}`}
            />
          ))}
        </div>
      </div>
    </Modal>
  );
};

export { CelebrationModal };