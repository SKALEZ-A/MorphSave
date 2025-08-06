'use client';

import React, { useState } from 'react';
import { Button } from '../ui/Button';
import { 
  Lightbulb, 
  AlertTriangle, 
  Target, 
  TrendingUp, 
  CheckCircle, 
  Clock,
  DollarSign,
  ArrowRight
} from 'lucide-react';

interface FinancialRecommendation {
  id: string;
  type: 'savings_opportunity' | 'spending_alert' | 'goal_adjustment' | 'investment_advice';
  title: string;
  description: string;
  impact: 'high' | 'medium' | 'low';
  actionable: boolean;
  estimatedSavings?: number;
  category?: string;
  createdAt: Date;
}

interface RecommendationsCardProps {
  recommendations: FinancialRecommendation[];
  onRefresh: () => void;
}

export const RecommendationsCard: React.FC<RecommendationsCardProps> = ({ 
  recommendations, 
  onRefresh 
}) => {
  const [completedRecommendations, setCompletedRecommendations] = useState<Set<string>>(new Set());
  const [expandedRecommendation, setExpandedRecommendation] = useState<string | null>(null);

  const getRecommendationIcon = (type: FinancialRecommendation['type']) => {
    switch (type) {
      case 'savings_opportunity':
        return <Lightbulb className="w-5 h-5 text-yellow-600" />;
      case 'spending_alert':
        return <AlertTriangle className="w-5 h-5 text-red-600" />;
      case 'goal_adjustment':
        return <Target className="w-5 h-5 text-blue-600" />;
      case 'investment_advice':
        return <TrendingUp className="w-5 h-5 text-green-600" />;
      default:
        return <Lightbulb className="w-5 h-5 text-gray-600" />;
    }
  };

  const getImpactColor = (impact: FinancialRecommendation['impact']) => {
    switch (impact) {
      case 'high':
        return 'bg-red-100 text-red-800 border-red-200';
      case 'medium':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'low':
        return 'bg-green-100 text-green-800 border-green-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getTypeLabel = (type: FinancialRecommendation['type']) => {
    switch (type) {
      case 'savings_opportunity':
        return 'Savings Opportunity';
      case 'spending_alert':
        return 'Spending Alert';
      case 'goal_adjustment':
        return 'Goal Adjustment';
      case 'investment_advice':
        return 'Investment Advice';
      default:
        return 'Recommendation';
    }
  };

  const handleMarkCompleted = (recommendationId: string) => {
    setCompletedRecommendations(prev => new Set([...prev, recommendationId]));
  };

  const handleToggleExpanded = (recommendationId: string) => {
    setExpandedRecommendation(
      expandedRecommendation === recommendationId ? null : recommendationId
    );
  };

  const activeRecommendations = recommendations.filter(rec => !completedRecommendations.has(rec.id));
  const completedCount = completedRecommendations.size;

  return (
    <div className="bg-white rounded-lg shadow-sm border p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">Financial Recommendations</h3>
          <p className="text-sm text-gray-600 mt-1">
            AI-powered suggestions to improve your financial health
          </p>
        </div>
        <div className="flex items-center gap-3">
          {completedCount > 0 && (
            <div className="flex items-center gap-2 text-green-600">
              <CheckCircle className="w-4 h-4" />
              <span className="text-sm font-medium">{completedCount} completed</span>
            </div>
          )}
          <Button onClick={onRefresh} variant="outline" size="sm">
            Get New Recommendations
          </Button>
        </div>
      </div>

      {activeRecommendations.length === 0 ? (
        <div className="text-center py-8">
          <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-4" />
          <h4 className="text-lg font-medium text-gray-900 mb-2">All caught up!</h4>
          <p className="text-gray-600 mb-4">
            You've completed all available recommendations. Great job!
          </p>
          <Button onClick={onRefresh} variant="primary">
            Check for New Recommendations
          </Button>
        </div>
      ) : (
        <div className="space-y-4">
          {activeRecommendations.map((recommendation) => (
            <div
              key={recommendation.id}
              className="border rounded-lg p-4 hover:shadow-md transition-shadow"
            >
              <div className="flex items-start gap-4">
                <div className="flex-shrink-0 mt-1">
                  {getRecommendationIcon(recommendation.type)}
                </div>
                
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-4 mb-2">
                    <div className="flex-1">
                      <h4 className="font-medium text-gray-900 mb-1">
                        {recommendation.title}
                      </h4>
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-xs text-gray-500">
                          {getTypeLabel(recommendation.type)}
                        </span>
                        <span className={`px-2 py-1 rounded-full text-xs font-medium border ${getImpactColor(recommendation.impact)}`}>
                          {recommendation.impact} impact
                        </span>
                      </div>
                    </div>
                    
                    {recommendation.estimatedSavings && (
                      <div className="text-right flex-shrink-0">
                        <div className="flex items-center gap-1 text-green-600">
                          <DollarSign className="w-4 h-4" />
                          <span className="font-semibold">${recommendation.estimatedSavings}</span>
                        </div>
                        <div className="text-xs text-gray-500">potential savings</div>
                      </div>
                    )}
                  </div>

                  <p className="text-gray-700 text-sm mb-3">
                    {expandedRecommendation === recommendation.id 
                      ? recommendation.description
                      : recommendation.description.length > 120
                        ? `${recommendation.description.substring(0, 120)}...`
                        : recommendation.description
                    }
                  </p>

                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {recommendation.description.length > 120 && (
                        <button
                          onClick={() => handleToggleExpanded(recommendation.id)}
                          className="text-blue-600 hover:text-blue-700 text-sm font-medium"
                        >
                          {expandedRecommendation === recommendation.id ? 'Show less' : 'Read more'}
                        </button>
                      )}
                      
                      {recommendation.category && (
                        <span className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded">
                          {recommendation.category}
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-2">
                      <div className="flex items-center gap-1 text-gray-500 text-xs">
                        <Clock className="w-3 h-3" />
                        <span>
                          {new Date(recommendation.createdAt).toLocaleDateString()}
                        </span>
                      </div>
                      
                      {recommendation.actionable && (
                        <Button
                          onClick={() => handleMarkCompleted(recommendation.id)}
                          size="sm"
                          variant="primary"
                          className="flex items-center gap-1"
                        >
                          <span>Mark Done</span>
                          <ArrowRight className="w-3 h-3" />
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Summary Stats */}
      {recommendations.length > 0 && (
        <div className="mt-6 pt-6 border-t border-gray-200">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
            <div>
              <div className="text-2xl font-bold text-blue-600">{recommendations.length}</div>
              <div className="text-sm text-gray-600">Total Recommendations</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-green-600">{completedCount}</div>
              <div className="text-sm text-gray-600">Completed</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-yellow-600">
                {recommendations.filter(r => r.impact === 'high').length}
              </div>
              <div className="text-sm text-gray-600">High Impact</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-purple-600">
                ${recommendations.reduce((sum, r) => sum + (r.estimatedSavings || 0), 0)}
              </div>
              <div className="text-sm text-gray-600">Potential Savings</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};