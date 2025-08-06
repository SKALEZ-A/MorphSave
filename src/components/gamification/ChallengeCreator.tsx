'use client';

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/Card';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { FormField } from '../forms/FormField';
import { Alert } from '../ui/Alert';
import { Badge } from '../ui/Badge';
import { 
  Plus, 
  Target, 
  Calendar, 
  Users,
  Trophy,
  Gift,
  Info
} from 'lucide-react';
import { motion } from 'framer-motion';

interface ChallengeCreatorProps {
  onCreateChallenge: (challengeData: ChallengeFormData) => Promise<void>;
  isLoading?: boolean;
  className?: string;
}

interface ChallengeFormData {
  title: string;
  description: string;
  type: 'savings_amount' | 'streak' | 'social';
  targetAmount?: number;
  duration: number;
  maxParticipants?: number;
  rewards: {
    points: number;
    badge?: string;
    specialReward?: string;
  };
}

const ChallengeCreator: React.FC<ChallengeCreatorProps> = ({
  onCreateChallenge,
  isLoading = false,
  className
}) => {
  const [formData, setFormData] = React.useState<ChallengeFormData>({
    title: '',
    description: '',
    type: 'savings_amount',
    duration: 7,
    rewards: {
      points: 100
    }
  });
  const [errors, setErrors] = React.useState<Record<string, string>>({});
  const [showPreview, setShowPreview] = React.useState(false);

  const challengeTypes = [
    {
      value: 'savings_amount',
      label: 'Savings Goal',
      description: 'Challenge participants to save a specific amount',
      icon: Target,
      requiresAmount: true
    },
    {
      value: 'streak',
      label: 'Streak Challenge',
      description: 'Maintain a daily savings streak',
      icon: Calendar,
      requiresAmount: false
    },
    {
      value: 'social',
      label: 'Social Challenge',
      description: 'Group challenge with social interaction',
      icon: Users,
      requiresAmount: false
    }
  ];

  const durationPresets = [
    { days: 3, label: '3 Days' },
    { days: 7, label: '1 Week' },
    { days: 14, label: '2 Weeks' },
    { days: 30, label: '1 Month' },
  ];

  const pointsPresets = [50, 100, 200, 500];

  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    if (!formData.title.trim()) {
      newErrors.title = 'Challenge title is required';
    } else if (formData.title.length < 3) {
      newErrors.title = 'Title must be at least 3 characters';
    } else if (formData.title.length > 100) {
      newErrors.title = 'Title must be less than 100 characters';
    }

    if (!formData.description.trim()) {
      newErrors.description = 'Challenge description is required';
    } else if (formData.description.length < 10) {
      newErrors.description = 'Description must be at least 10 characters';
    } else if (formData.description.length > 500) {
      newErrors.description = 'Description must be less than 500 characters';
    }

    const selectedType = challengeTypes.find(t => t.value === formData.type);
    if (selectedType?.requiresAmount && (!formData.targetAmount || formData.targetAmount <= 0)) {
      newErrors.targetAmount = 'Target amount is required for savings challenges';
    }

    if (formData.duration < 1) {
      newErrors.duration = 'Duration must be at least 1 day';
    } else if (formData.duration > 365) {
      newErrors.duration = 'Duration cannot exceed 365 days';
    }

    if (formData.maxParticipants && formData.maxParticipants < 2) {
      newErrors.maxParticipants = 'Maximum participants must be at least 2';
    }

    if (formData.rewards.points < 10) {
      newErrors.points = 'Points reward must be at least 10';
    } else if (formData.rewards.points > 10000) {
      newErrors.points = 'Points reward cannot exceed 10,000';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }

    try {
      await onCreateChallenge(formData);
      // Reset form on success
      setFormData({
        title: '',
        description: '',
        type: 'savings_amount',
        duration: 7,
        rewards: {
          points: 100
        }
      });
      setShowPreview(false);
    } catch (error) {
      // Error handling is done by parent component
    }
  };

  const handleChange = (field: keyof ChallengeFormData) => (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    const value = e.target.type === 'number' ? parseFloat(e.target.value) || 0 : e.target.value;
    
    if (field === 'rewards') {
      setFormData(prev => ({
        ...prev,
        rewards: {
          ...prev.rewards,
          [e.target.name]: value
        }
      }));
    } else {
      setFormData(prev => ({ ...prev, [field]: value }));
    }
    
    // Clear error when user starts typing
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }));
    }
  };

  const selectedType = challengeTypes.find(t => t.value === formData.type);

  return (
    <Card variant="elevated" className={className}>
      <CardHeader>
        <CardTitle className="flex items-center space-x-2">
          <Plus className="h-5 w-5 text-blue-600" />
          <span>Create New Challenge</span>
        </CardTitle>
      </CardHeader>

      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Challenge Type Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
              Challenge Type
            </label>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {challengeTypes.map((type) => {
                const Icon = type.icon;
                return (
                  <motion.div
                    key={type.value}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                  >
                    <label
                      className={`relative flex flex-col p-4 border-2 rounded-lg cursor-pointer transition-all ${
                        formData.type === type.value
                          ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                          : 'border-gray-200 hover:border-gray-300 dark:border-gray-700 dark:hover:border-gray-600'
                      }`}
                    >
                      <input
                        type="radio"
                        name="type"
                        value={type.value}
                        checked={formData.type === type.value}
                        onChange={handleChange('type')}
                        className="sr-only"
                      />
                      <div className="flex items-center space-x-2 mb-2">
                        <Icon className="h-5 w-5 text-blue-600" />
                        <span className="font-medium text-gray-900 dark:text-gray-100">
                          {type.label}
                        </span>
                      </div>
                      <p className="text-xs text-gray-600 dark:text-gray-400">
                        {type.description}
                      </p>
                    </label>
                  </motion.div>
                );
              })}
            </div>
          </div>

          {/* Basic Information */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FormField label="Challenge Title" error={errors.title} required>
              <Input
                placeholder="Enter challenge title"
                value={formData.title}
                onChange={handleChange('title')}
                error={errors.title}
                maxLength={100}
              />
            </FormField>

            <FormField label="Duration (days)" error={errors.duration} required>
              <div className="space-y-2">
                <Input
                  type="number"
                  placeholder="7"
                  value={formData.duration.toString()}
                  onChange={handleChange('duration')}
                  error={errors.duration}
                  min={1}
                  max={365}
                />
                <div className="flex space-x-1">
                  {durationPresets.map(preset => (
                    <Button
                      key={preset.days}
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setFormData(prev => ({ ...prev, duration: preset.days }))}
                      className="text-xs"
                    >
                      {preset.label}
                    </Button>
                  ))}
                </div>
              </div>
            </FormField>
          </div>

          <FormField label="Description" error={errors.description} required>
            <textarea
              placeholder="Describe your challenge and what participants need to do"
              value={formData.description}
              onChange={handleChange('description')}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
              rows={3}
              maxLength={500}
            />
            <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              {formData.description.length}/500 characters
            </div>
          </FormField>

          {/* Target Amount (for savings challenges) */}
          {selectedType?.requiresAmount && (
            <FormField label="Target Amount" error={errors.targetAmount} required>
              <Input
                type="number"
                placeholder="100.00"
                value={formData.targetAmount?.toString() || ''}
                onChange={handleChange('targetAmount')}
                error={errors.targetAmount}
                step="0.01"
                min="0"
                leftIcon={<Target className="h-4 w-4" />}
              />
            </FormField>
          )}

          {/* Advanced Options */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FormField label="Max Participants (optional)" error={errors.maxParticipants}>
              <Input
                type="number"
                placeholder="Unlimited"
                value={formData.maxParticipants?.toString() || ''}
                onChange={handleChange('maxParticipants')}
                error={errors.maxParticipants}
                min={2}
                leftIcon={<Users className="h-4 w-4" />}
              />
            </FormField>

            <FormField label="Points Reward" error={errors.points} required>
              <div className="space-y-2">
                <Input
                  type="number"
                  placeholder="100"
                  value={formData.rewards.points.toString()}
                  onChange={(e) => setFormData(prev => ({
                    ...prev,
                    rewards: { ...prev.rewards, points: parseInt(e.target.value) || 0 }
                  }))}
                  error={errors.points}
                  min={10}
                  max={10000}
                  leftIcon={<Trophy className="h-4 w-4" />}
                />
                <div className="flex space-x-1">
                  {pointsPresets.map(points => (
                    <Button
                      key={points}
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setFormData(prev => ({
                        ...prev,
                        rewards: { ...prev.rewards, points }
                      }))}
                      className="text-xs"
                    >
                      {points}
                    </Button>
                  ))}
                </div>
              </div>
            </FormField>
          </div>

          {/* Special Rewards */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FormField label="Badge Name (optional)">
              <Input
                placeholder="e.g., Savings Champion"
                value={formData.rewards.badge || ''}
                onChange={(e) => setFormData(prev => ({
                  ...prev,
                  rewards: { ...prev.rewards, badge: e.target.value }
                }))}
                leftIcon={<Trophy className="h-4 w-4" />}
              />
            </FormField>

            <FormField label="Special Reward (optional)">
              <Input
                placeholder="e.g., Exclusive NFT"
                value={formData.rewards.specialReward || ''}
                onChange={(e) => setFormData(prev => ({
                  ...prev,
                  rewards: { ...prev.rewards, specialReward: e.target.value }
                }))}
                leftIcon={<Gift className="h-4 w-4" />}
              />
            </FormField>
          </div>

          {/* Preview */}
          {showPreview && (
            <div className="bg-gray-50 dark:bg-gray-800 p-4 rounded-lg">
              <h4 className="font-medium text-gray-900 dark:text-gray-100 mb-2">
                Challenge Preview
              </h4>
              <div className="space-y-2 text-sm">
                <div><strong>Title:</strong> {formData.title || 'Untitled Challenge'}</div>
                <div><strong>Type:</strong> {selectedType?.label}</div>
                <div><strong>Duration:</strong> {formData.duration} days</div>
                {formData.targetAmount && (
                  <div><strong>Target:</strong> ${formData.targetAmount}</div>
                )}
                <div><strong>Reward:</strong> {formData.rewards.points} points</div>
                {formData.rewards.badge && (
                  <div><strong>Badge:</strong> {formData.rewards.badge}</div>
                )}
              </div>
            </div>
          )}

          {/* Info Alert */}
          <Alert variant="info">
            <Info className="h-4 w-4" />
            <div>
              <strong>Challenge Guidelines:</strong>
              <ul className="text-sm mt-1 space-y-1">
                <li>• Challenges must be fair and achievable for all participants</li>
                <li>• Inappropriate content will result in challenge removal</li>
                <li>• You cannot modify a challenge once participants have joined</li>
              </ul>
            </div>
          </Alert>

          {/* Action Buttons */}
          <div className="flex space-x-3">
            <Button
              type="button"
              variant="outline"
              onClick={() => setShowPreview(!showPreview)}
              disabled={isLoading}
            >
              {showPreview ? 'Hide Preview' : 'Show Preview'}
            </Button>
            <Button
              type="submit"
              loading={isLoading}
              disabled={isLoading}
              className="flex-1"
            >
              Create Challenge
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
};

export { ChallengeCreator };