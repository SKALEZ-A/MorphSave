'use client';

import React, { useState } from 'react';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Modal } from '../ui/Modal';
import { 
  Target, 
  TrendingUp, 
  Users, 
  Calendar, 
  Trophy,
  DollarSign,
  Clock,
  Settings,
  ChevronLeft,
  ChevronRight,
  Check
} from 'lucide-react';

interface ChallengeCreateWizardProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

interface ChallengeFormData {
  title: string;
  description: string;
  type: 'savings_amount' | 'streak' | 'social';
  targetAmount?: number;
  duration: number;
  isPublic: boolean;
  maxParticipants?: number;
  rewards: {
    first: { points: number; money: number };
    second: { points: number; money: number };
    third: { points: number; money: number };
    participation: { points: number };
  };
  invitedFriends: string[];
}

const CHALLENGE_TYPES = [
  {
    id: 'savings_amount' as const,
    name: 'Savings Goal',
    description: 'Compete to save a specific amount of money',
    icon: Target,
    color: 'bg-green-100 text-green-600'
  },
  {
    id: 'streak' as const,
    name: 'Savings Streak',
    description: 'Maintain daily savings for the longest streak',
    icon: TrendingUp,
    color: 'bg-blue-100 text-blue-600'
  },
  {
    id: 'social' as const,
    name: 'Social Challenge',
    description: 'Team-based challenges with friends',
    icon: Users,
    color: 'bg-purple-100 text-purple-600'
  }
];

const DURATION_OPTIONS = [
  { value: 7, label: '1 Week' },
  { value: 14, label: '2 Weeks' },
  { value: 30, label: '1 Month' },
  { value: 60, label: '2 Months' },
  { value: 90, label: '3 Months' }
];

export const ChallengeCreateWizard: React.FC<ChallengeCreateWizardProps> = ({
  isOpen,
  onClose,
  onSuccess
}) => {
  const [currentStep, setCurrentStep] = useState(1);
  const [formData, setFormData] = useState<ChallengeFormData>({
    title: '',
    description: '',
    type: 'savings_amount',
    targetAmount: undefined,
    duration: 30,
    isPublic: true,
    maxParticipants: undefined,
    rewards: {
      first: { points: 500, money: 25 },
      second: { points: 300, money: 15 },
      third: { points: 200, money: 10 },
      participation: { points: 50 }
    },
    invitedFriends: []
  });
  const [creating, setCreating] = useState(false);

  const totalSteps = 4;

  const handleNext = () => {
    if (currentStep < totalSteps) {
      setCurrentStep(currentStep + 1);
    }
  };

  const handlePrevious = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleSubmit = async () => {
    setCreating(true);
    try {
      const response = await fetch('/api/social/challenges', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData)
      });

      if (response.ok) {
        onSuccess();
      }
    } catch (error) {
      console.error('Error creating challenge:', error);
    } finally {
      setCreating(false);
    }
  };

  const updateFormData = (updates: Partial<ChallengeFormData>) => {
    setFormData(prev => ({ ...prev, ...updates }));
  };

  const isStepValid = (step: number) => {
    switch (step) {
      case 1:
        return formData.title.trim().length > 0 && formData.description.trim().length > 0;
      case 2:
        return formData.type && (formData.type !== 'savings_amount' || formData.targetAmount);
      case 3:
        return formData.duration > 0;
      case 4:
        return true;
      default:
        return false;
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Create New Challenge">
      <div className="space-y-6">
        {/* Progress Bar */}
        <div className="flex items-center justify-between">
          {Array.from({ length: totalSteps }, (_, i) => (
            <div key={i} className="flex items-center">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                i + 1 <= currentStep
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-200 text-gray-600'
              }`}>
                {i + 1 <= currentStep ? <Check className="w-4 h-4" /> : i + 1}
              </div>
              {i < totalSteps - 1 && (
                <div className={`w-12 h-1 mx-2 ${
                  i + 1 < currentStep ? 'bg-blue-600' : 'bg-gray-200'
                }`} />
              )}
            </div>
          ))}
        </div>

        {/* Step Content */}
        <div className="min-h-[400px]">
          {currentStep === 1 && (
            <Step1BasicInfo
              formData={formData}
              updateFormData={updateFormData}
            />
          )}
          {currentStep === 2 && (
            <Step2ChallengeType
              formData={formData}
              updateFormData={updateFormData}
            />
          )}
          {currentStep === 3 && (
            <Step3Settings
              formData={formData}
              updateFormData={updateFormData}
            />
          )}
          {currentStep === 4 && (
            <Step4Review
              formData={formData}
              updateFormData={updateFormData}
            />
          )}
        </div>

        {/* Navigation */}
        <div className="flex items-center justify-between pt-6 border-t border-gray-200">
          <Button
            onClick={handlePrevious}
            variant="outline"
            disabled={currentStep === 1}
            className="flex items-center gap-2"
          >
            <ChevronLeft className="w-4 h-4" />
            Previous
          </Button>

          <div className="text-sm text-gray-500">
            Step {currentStep} of {totalSteps}
          </div>

          {currentStep === totalSteps ? (
            <Button
              onClick={handleSubmit}
              disabled={!isStepValid(currentStep) || creating}
              className="flex items-center gap-2"
            >
              {creating ? 'Creating...' : 'Create Challenge'}
              <Trophy className="w-4 h-4" />
            </Button>
          ) : (
            <Button
              onClick={handleNext}
              disabled={!isStepValid(currentStep)}
              className="flex items-center gap-2"
            >
              Next
              <ChevronRight className="w-4 h-4" />
            </Button>
          )}
        </div>
      </div>
    </Modal>
  );
};

// Step 1: Basic Information
const Step1BasicInfo: React.FC<{
  formData: ChallengeFormData;
  updateFormData: (updates: Partial<ChallengeFormData>) => void;
}> = ({ formData, updateFormData }) => {
  return (
    <div className="space-y-6">
      <div className="text-center">
        <Trophy className="w-12 h-12 text-yellow-600 mx-auto mb-4" />
        <h3 className="text-lg font-semibold text-gray-900 mb-2">
          Let's create your challenge!
        </h3>
        <p className="text-gray-600">
          Start by giving your challenge a compelling title and description.
        </p>
      </div>

      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Challenge Title *
          </label>
          <Input
            type="text"
            placeholder="e.g., Save $500 in 30 Days"
            value={formData.title}
            onChange={(e) => updateFormData({ title: e.target.value })}
            className="w-full"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Description *
          </label>
          <textarea
            placeholder="Describe your challenge and motivate others to join..."
            value={formData.description}
            onChange={(e) => updateFormData({ description: e.target.value })}
            rows={4}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
          <p className="text-xs text-gray-500 mt-1">
            {formData.description.length}/500 characters
          </p>
        </div>
      </div>
    </div>
  );
};

// Step 2: Challenge Type
const Step2ChallengeType: React.FC<{
  formData: ChallengeFormData;
  updateFormData: (updates: Partial<ChallengeFormData>) => void;
}> = ({ formData, updateFormData }) => {
  return (
    <div className="space-y-6">
      <div className="text-center">
        <h3 className="text-lg font-semibold text-gray-900 mb-2">
          Choose Challenge Type
        </h3>
        <p className="text-gray-600">
          Select the type of challenge that best fits your goals.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4">
        {CHALLENGE_TYPES.map((type) => {
          const Icon = type.icon;
          return (
            <button
              key={type.id}
              onClick={() => updateFormData({ type: type.id })}
              className={`p-4 border-2 rounded-lg text-left transition-all ${
                formData.type === type.id
                  ? 'border-blue-500 bg-blue-50'
                  : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              <div className="flex items-start gap-4">
                <div className={`p-2 rounded-lg ${type.color}`}>
                  <Icon className="w-5 h-5" />
                </div>
                <div className="flex-1">
                  <h4 className="font-medium text-gray-900 mb-1">{type.name}</h4>
                  <p className="text-sm text-gray-600">{type.description}</p>
                </div>
                {formData.type === type.id && (
                  <Check className="w-5 h-5 text-blue-600" />
                )}
              </div>
            </button>
          );
        })}
      </div>

      {/* Target Amount for Savings Goal */}
      {formData.type === 'savings_amount' && (
        <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Target Amount *
          </label>
          <div className="relative">
            <DollarSign className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
            <Input
              type="number"
              placeholder="500"
              value={formData.targetAmount || ''}
              onChange={(e) => updateFormData({ 
                targetAmount: e.target.value ? parseFloat(e.target.value) : undefined 
              })}
              className="pl-10"
            />
          </div>
          <p className="text-xs text-gray-600 mt-1">
            Set the savings goal that participants need to reach
          </p>
        </div>
      )}
    </div>
  );
};

// Step 3: Settings
const Step3Settings: React.FC<{
  formData: ChallengeFormData;
  updateFormData: (updates: Partial<ChallengeFormData>) => void;
}> = ({ formData, updateFormData }) => {
  return (
    <div className="space-y-6">
      <div className="text-center">
        <Settings className="w-12 h-12 text-blue-600 mx-auto mb-4" />
        <h3 className="text-lg font-semibold text-gray-900 mb-2">
          Challenge Settings
        </h3>
        <p className="text-gray-600">
          Configure the duration and participation rules.
        </p>
      </div>

      <div className="space-y-6">
        {/* Duration */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-3">
            Challenge Duration
          </label>
          <div className="grid grid-cols-2 gap-3">
            {DURATION_OPTIONS.map((option) => (
              <button
                key={option.value}
                onClick={() => updateFormData({ duration: option.value })}
                className={`p-3 border rounded-lg text-center transition-all ${
                  formData.duration === option.value
                    ? 'border-blue-500 bg-blue-50 text-blue-700'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <Clock className="w-4 h-4 mx-auto mb-1" />
                <div className="text-sm font-medium">{option.label}</div>
              </button>
            ))}
          </div>
        </div>

        {/* Visibility */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-3">
            Challenge Visibility
          </label>
          <div className="space-y-3">
            <label className="flex items-center">
              <input
                type="radio"
                name="visibility"
                checked={formData.isPublic}
                onChange={() => updateFormData({ isPublic: true })}
                className="mr-3"
              />
              <div>
                <div className="font-medium text-gray-900">Public</div>
                <div className="text-sm text-gray-600">
                  Anyone can discover and join this challenge
                </div>
              </div>
            </label>
            <label className="flex items-center">
              <input
                type="radio"
                name="visibility"
                checked={!formData.isPublic}
                onChange={() => updateFormData({ isPublic: false })}
                className="mr-3"
              />
              <div>
                <div className="font-medium text-gray-900">Private</div>
                <div className="text-sm text-gray-600">
                  Only invited friends can join this challenge
                </div>
              </div>
            </label>
          </div>
        </div>

        {/* Max Participants */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Maximum Participants (Optional)
          </label>
          <Input
            type="number"
            placeholder="Leave empty for unlimited"
            value={formData.maxParticipants || ''}
            onChange={(e) => updateFormData({ 
              maxParticipants: e.target.value ? parseInt(e.target.value) : undefined 
            })}
            min="2"
            max="100"
          />
          <p className="text-xs text-gray-600 mt-1">
            Limit the number of participants to create more exclusive challenges
          </p>
        </div>
      </div>
    </div>
  );
};

// Step 4: Review
const Step4Review: React.FC<{
  formData: ChallengeFormData;
  updateFormData: (updates: Partial<ChallengeFormData>) => void;
}> = ({ formData, updateFormData }) => {
  const selectedType = CHALLENGE_TYPES.find(t => t.id === formData.type);
  const selectedDuration = DURATION_OPTIONS.find(d => d.value === formData.duration);

  return (
    <div className="space-y-6">
      <div className="text-center">
        <Check className="w-12 h-12 text-green-600 mx-auto mb-4" />
        <h3 className="text-lg font-semibold text-gray-900 mb-2">
          Review Your Challenge
        </h3>
        <p className="text-gray-600">
          Double-check the details before creating your challenge.
        </p>
      </div>

      <div className="bg-gray-50 rounded-lg p-6 space-y-4">
        <div>
          <h4 className="font-medium text-gray-900 mb-2">Challenge Details</h4>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-600">Title:</span>
              <span className="font-medium">{formData.title}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Type:</span>
              <span className="font-medium">{selectedType?.name}</span>
            </div>
            {formData.targetAmount && (
              <div className="flex justify-between">
                <span className="text-gray-600">Target Amount:</span>
                <span className="font-medium">${formData.targetAmount}</span>
              </div>
            )}
            <div className="flex justify-between">
              <span className="text-gray-600">Duration:</span>
              <span className="font-medium">{selectedDuration?.label}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Visibility:</span>
              <span className="font-medium">{formData.isPublic ? 'Public' : 'Private'}</span>
            </div>
            {formData.maxParticipants && (
              <div className="flex justify-between">
                <span className="text-gray-600">Max Participants:</span>
                <span className="font-medium">{formData.maxParticipants}</span>
              </div>
            )}
          </div>
        </div>

        <div>
          <h4 className="font-medium text-gray-900 mb-2">Description</h4>
          <p className="text-sm text-gray-600">{formData.description}</p>
        </div>

        <div>
          <h4 className="font-medium text-gray-900 mb-2">Rewards</h4>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div className="space-y-1">
              <div className="flex justify-between">
                <span className="text-gray-600">🥇 1st Place:</span>
                <span>{formData.rewards.first.points} pts + ${formData.rewards.first.money}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">🥈 2nd Place:</span>
                <span>{formData.rewards.second.points} pts + ${formData.rewards.second.money}</span>
              </div>
            </div>
            <div className="space-y-1">
              <div className="flex justify-between">
                <span className="text-gray-600">🥉 3rd Place:</span>
                <span>{formData.rewards.third.points} pts + ${formData.rewards.third.money}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">🎖️ Participation:</span>
                <span>{formData.rewards.participation.points} pts</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
        <h4 className="font-medium text-blue-900 mb-2">What happens next?</h4>
        <ul className="text-sm text-blue-800 space-y-1">
          <li>• Your challenge will be created and available for others to join</li>
          <li>• You'll be automatically enrolled as the first participant</li>
          <li>• Friends will be notified if you've made it public</li>
          <li>• The challenge will start immediately once created</li>
        </ul>
      </div>
    </div>
  );
};