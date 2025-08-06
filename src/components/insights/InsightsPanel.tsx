'use client';

import React, { useState, useEffect } from 'react';
import { SpendingAnalysisChart } from './SpendingAnalysisChart';
import { RecommendationsCard } from './RecommendationsCard';
import { SavingsProjectionCard } from './SavingsProjectionCard';
import { CategoryBredownChart } from './CategoryBreakdownChart';
import { TrendAnalysisChart } from './TrendAnalysisChart';
import { Button } from '../ui/Button';
import { RefreshCw, TrendingUp, Target, AlertTriangle } from 'lucide-react';

interface SpendingAnalysis {
  totalSpent: number;
  categoryBreakdown: CategorySpending[];
  monthlyTrend: MonthlySpending[];
  topMerchants: MerchantSpending[];
  averageTransactionAmount: number;
  spendingVelocity: 'increasing' | 'decreasing' | 'stable';
  insights: string[];
}

interface CategorySpending {
  category: string;
  amount: number;
  percentage: number;
  transactionCount: number;
  averageAmount: number;
}

interface MonthlySpending {
  month: string;
  amount: number;
  transactionCount: number;
  savingsAmount: number;
}

interface MerchantSpending {
  merchant: string;
  amount: number;
  transactionCount: number;
  category: string;
}

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

interface SavingsProjection {
  currentSavingsRate: number;
  projectedMonthly: number;
  projectedYearly: number;
  goalAchievementDate?: Date;
  recommendedAdjustments: string[];
  confidenceLevel: number;
}

export const InsightsPanel: React.FC = () => {
  const [spendingAnalysis, setSpendingAnalysis] = useState<SpendingAnalysis | null>(null);
  const [recommendations, setRecommendations] = useState<FinancialRecommendation[]>([]);
  const [savingsProjection, setSavingsProjection] = useState<SavingsProjection | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<'overview' | 'spending' | 'recommendations' | 'projections'>('overview');

  useEffect(() => {
    loadInsightsData();
  }, []);

  const loadInsightsData = async () => {
    try {
      setLoading(true);
      
      // Load spending analysis
      const analysisResponse = await fetch('/api/insights/analysis');
      if (analysisResponse.ok) {
        const analysisData = await analysisResponse.json();
        setSpendingAnalysis(analysisData.data);
      }

      // Load recommendations
      const recommendationsResponse = await fetch('/api/insights/recommendations');
      if (recommendationsResponse.ok) {
        const recommendationsData = await recommendationsResponse.json();
        setRecommendations(recommendationsData.data);
      }

      // Load savings projections
      const projectionsResponse = await fetch('/api/insights/projections');
      if (projectionsResponse.ok) {
        const projectionsData = await projectionsResponse.json();
        setSavingsProjection(projectionsData.data);
      }
    } catch (error) {
      console.error('Error loading insights data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadInsightsData();
    setRefreshing(false);
  };

  const getVelocityIcon = (velocity: string) => {
    switch (velocity) {
      case 'increasing':
        return <TrendingUp className="w-4 h-4 text-red-500" />;
      case 'decreasing':
        return <TrendingUp className="w-4 h-4 text-green-500 rotate-180" />;
      default:
        return <Target className="w-4 h-4 text-blue-500" />;
    }
  };

  const getVelocityColor = (velocity: string) => {
    switch (velocity) {
      case 'increasing':
        return 'text-red-600 bg-red-50';
      case 'decreasing':
        return 'text-green-600 bg-green-50';
      default:
        return 'text-blue-600 bg-blue-50';
    }
  };

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow-sm border p-6">
        <div className="animate-pulse">
          <div className="h-6 bg-gray-200 rounded w-1/4 mb-4"></div>
          <div className="space-y-3">
            <div className="h-4 bg-gray-200 rounded w-full"></div>
            <div className="h-4 bg-gray-200 rounded w-3/4"></div>
            <div className="h-4 bg-gray-200 rounded w-1/2"></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">AI Financial Insights</h2>
          <p className="text-gray-600 mt-1">Personalized analysis and recommendations</p>
        </div>
        <Button
          onClick={handleRefresh}
          disabled={refreshing}
          variant="outline"
          className="flex items-center gap-2"
        >
          <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {/* Tab Navigation */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-8">
          {[
            { id: 'overview', label: 'Overview' },
            { id: 'spending', label: 'Spending Analysis' },
            { id: 'recommendations', label: 'Recommendations' },
            { id: 'projections', label: 'Projections' }
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`py-2 px-1 border-b-2 font-medium text-sm ${
                activeTab === tab.id
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab Content */}
      {activeTab === 'overview' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Quick Stats */}
          {spendingAnalysis && (
            <div className="bg-white rounded-lg shadow-sm border p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Spending Overview</h3>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-gray-600">Total Spent (90 days)</span>
                  <span className="font-semibold">${spendingAnalysis.totalSpent.toFixed(2)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-gray-600">Average Transaction</span>
                  <span className="font-semibold">${spendingAnalysis.averageTransactionAmount.toFixed(2)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-gray-600">Spending Trend</span>
                  <div className={`flex items-center gap-2 px-2 py-1 rounded-full text-sm ${getVelocityColor(spendingAnalysis.spendingVelocity)}`}>
                    {getVelocityIcon(spendingAnalysis.spendingVelocity)}
                    <span className="capitalize">{spendingAnalysis.spendingVelocity}</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Key Insights */}
          {spendingAnalysis && spendingAnalysis.insights.length > 0 && (
            <div className="bg-white rounded-lg shadow-sm border p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Key Insights</h3>
              <div className="space-y-3">
                {spendingAnalysis.insights.slice(0, 3).map((insight, index) => (
                  <div key={index} className="flex items-start gap-3">
                    <div className="w-2 h-2 bg-blue-500 rounded-full mt-2 flex-shrink-0"></div>
                    <p className="text-gray-700 text-sm">{insight}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Top Recommendations */}
          {recommendations.length > 0 && (
            <div className="bg-white rounded-lg shadow-sm border p-6 lg:col-span-2">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Top Recommendations</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {recommendations.slice(0, 2).map((rec) => (
                  <div key={rec.id} className="border rounded-lg p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <div className={`w-2 h-2 rounded-full ${
                        rec.impact === 'high' ? 'bg-red-500' : 
                        rec.impact === 'medium' ? 'bg-yellow-500' : 'bg-green-500'
                      }`}></div>
                      <h4 className="font-medium text-gray-900">{rec.title}</h4>
                    </div>
                    <p className="text-gray-600 text-sm">{rec.description}</p>
                    {rec.estimatedSavings && (
                      <p className="text-green-600 text-sm mt-2 font-medium">
                        Potential savings: ${rec.estimatedSavings}/month
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {activeTab === 'spending' && spendingAnalysis && (
        <div className="space-y-6">
          <SpendingAnalysisChart data={spendingAnalysis} />
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <CategoryBredownChart categories={spendingAnalysis.categoryBreakdown} />
            <TrendAnalysisChart monthlyData={spendingAnalysis.monthlyTrend} />
          </div>
        </div>
      )}

      {activeTab === 'recommendations' && (
        <RecommendationsCard recommendations={recommendations} onRefresh={handleRefresh} />
      )}

      {activeTab === 'projections' && savingsProjection && (
        <SavingsProjectionCard projection={savingsProjection} />
      )}
    </div>
  );
};