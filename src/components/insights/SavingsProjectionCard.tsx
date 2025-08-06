'use client';

import React from 'react';
import { TrendingUp, Calendar, Target, BarChart3, AlertCircle } from 'lucide-react';

interface SavingsProjection {
  currentSavingsRate: number;
  projectedMonthly: number;
  projectedYearly: number;
  goalAchievementDate?: Date;
  recommendedAdjustments: string[];
  confidenceLevel: number;
}

interface SavingsProjectionCardProps {
  projection: SavingsProjection;
}

export const SavingsProjectionCard: React.FC<SavingsProjectionCardProps> = ({ projection }) => {
  const getConfidenceColor = (level: number) => {
    if (level >= 0.8) return 'text-green-600 bg-green-50 border-green-200';
    if (level >= 0.6) return 'text-yellow-600 bg-yellow-50 border-yellow-200';
    return 'text-red-600 bg-red-50 border-red-200';
  };

  const getConfidenceLabel = (level: number) => {
    if (level >= 0.8) return 'High Confidence';
    if (level >= 0.6) return 'Medium Confidence';
    return 'Low Confidence';
  };

  const formatDate = (date: Date) => {
    return date.toLocaleDateString('en-US', { 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    });
  };

  const getDaysUntilGoal = (goalDate: Date) => {
    const today = new Date();
    const diffTime = goalDate.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  };

  return (
    <div className="bg-white rounded-lg shadow-sm border p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">Savings Projections</h3>
          <p className="text-sm text-gray-600 mt-1">
            AI-powered predictions based on your current savings patterns
          </p>
        </div>
        <div className={`px-3 py-1 rounded-full border text-sm font-medium ${getConfidenceColor(projection.confidenceLevel)}`}>
          {getConfidenceLabel(projection.confidenceLevel)}
        </div>
      </div>

      {/* Current Savings Rate */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="text-center">
          <div className="flex items-center justify-center w-12 h-12 bg-blue-100 rounded-lg mx-auto mb-3">
            <TrendingUp className="w-6 h-6 text-blue-600" />
          </div>
          <div className="text-2xl font-bold text-gray-900">
            ${projection.currentSavingsRate.toFixed(2)}
          </div>
          <div className="text-sm text-gray-600">Daily Savings Rate</div>
        </div>

        <div className="text-center">
          <div className="flex items-center justify-center w-12 h-12 bg-green-100 rounded-lg mx-auto mb-3">
            <Calendar className="w-6 h-6 text-green-600" />
          </div>
          <div className="text-2xl font-bold text-gray-900">
            ${projection.projectedMonthly.toFixed(2)}
          </div>
          <div className="text-sm text-gray-600">Projected Monthly</div>
        </div>

        <div className="text-center">
          <div className="flex items-center justify-center w-12 h-12 bg-purple-100 rounded-lg mx-auto mb-3">
            <BarChart3 className="w-6 h-6 text-purple-600" />
          </div>
          <div className="text-2xl font-bold text-gray-900">
            ${projection.projectedYearly.toFixed(2)}
          </div>
          <div className="text-sm text-gray-600">Projected Yearly</div>
        </div>
      </div>

      {/* Goal Achievement */}
      {projection.goalAchievementDate && (
        <div className="mb-8 p-4 bg-gradient-to-r from-blue-50 to-green-50 rounded-lg border border-blue-200">
          <div className="flex items-center gap-3 mb-3">
            <Target className="w-5 h-5 text-blue-600" />
            <h4 className="font-medium text-gray-900">Goal Achievement Projection</h4>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <div className="text-sm text-gray-600 mb-1">Estimated Achievement Date</div>
              <div className="font-semibold text-gray-900">
                {formatDate(projection.goalAchievementDate)}
              </div>
            </div>
            <div>
              <div className="text-sm text-gray-600 mb-1">Days Until Goal</div>
              <div className="font-semibold text-gray-900">
                {getDaysUntilGoal(projection.goalAchievementDate)} days
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Projection Visualization */}
      <div className="mb-8">
        <h4 className="font-medium text-gray-900 mb-4">Savings Growth Projection</h4>
        <div className="space-y-4">
          {/* 3 Month Projection */}
          <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
            <div>
              <div className="font-medium text-gray-900">3 Months</div>
              <div className="text-sm text-gray-600">Short-term projection</div>
            </div>
            <div className="text-right">
              <div className="font-semibold text-gray-900">
                ${(projection.projectedMonthly * 3).toFixed(2)}
              </div>
              <div className="text-sm text-gray-600">Estimated savings</div>
            </div>
          </div>

          {/* 6 Month Projection */}
          <div className="flex items-center justify-between p-3 bg-blue-50 rounded-lg">
            <div>
              <div className="font-medium text-gray-900">6 Months</div>
              <div className="text-sm text-gray-600">Medium-term projection</div>
            </div>
            <div className="text-right">
              <div className="font-semibold text-gray-900">
                ${(projection.projectedMonthly * 6).toFixed(2)}
              </div>
              <div className="text-sm text-gray-600">Estimated savings</div>
            </div>
          </div>

          {/* 1 Year Projection */}
          <div className="flex items-center justify-between p-3 bg-green-50 rounded-lg">
            <div>
              <div className="font-medium text-gray-900">1 Year</div>
              <div className="text-sm text-gray-600">Long-term projection</div>
            </div>
            <div className="text-right">
              <div className="font-semibold text-gray-900">
                ${projection.projectedYearly.toFixed(2)}
              </div>
              <div className="text-sm text-gray-600">Estimated savings</div>
            </div>
          </div>
        </div>
      </div>

      {/* Recommended Adjustments */}
      {projection.recommendedAdjustments.length > 0 && (
        <div className="p-4 bg-yellow-50 rounded-lg border border-yellow-200">
          <div className="flex items-center gap-2 mb-3">
            <AlertCircle className="w-5 h-5 text-yellow-600" />
            <h4 className="font-medium text-yellow-900">Recommended Adjustments</h4>
          </div>
          <div className="space-y-2">
            {projection.recommendedAdjustments.map((adjustment, index) => (
              <div key={index} className="flex items-start gap-2">
                <div className="w-1.5 h-1.5 bg-yellow-600 rounded-full mt-2 flex-shrink-0"></div>
                <p className="text-sm text-yellow-800">{adjustment}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Confidence Level Explanation */}
      <div className="mt-6 pt-6 border-t border-gray-200">
        <div className="flex items-start gap-3">
          <div className="flex-shrink-0">
            <div className={`w-3 h-3 rounded-full mt-1 ${
              projection.confidenceLevel >= 0.8 ? 'bg-green-500' :
              projection.confidenceLevel >= 0.6 ? 'bg-yellow-500' : 'bg-red-500'
            }`}></div>
          </div>
          <div className="flex-1">
            <div className="text-sm font-medium text-gray-900 mb-1">
              Confidence Level: {(projection.confidenceLevel * 100).toFixed(0)}%
            </div>
            <div className="text-xs text-gray-600">
              {projection.confidenceLevel >= 0.8 
                ? 'High confidence based on consistent savings patterns and sufficient transaction history.'
                : projection.confidenceLevel >= 0.6
                ? 'Medium confidence. More transaction data would improve accuracy.'
                : 'Low confidence due to limited transaction history. Projections will improve over time.'
              }
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};