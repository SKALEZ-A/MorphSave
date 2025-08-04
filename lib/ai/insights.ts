import OpenAI from 'openai';
import { prisma } from '../db/prisma';
import { SavingsTransaction, TransactionType } from '@prisma/client';

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export interface SpendingAnalysis {
  totalSpent: number;
  categoryBreakdown: CategorySpending[];
  monthlyTrend: MonthlySpending[];
  topMerchants: MerchantSpending[];
  averageTransactionAmount: number;
  spendingVelocity: 'increasing' | 'decreasing' | 'stable';
  insights: string[];
}

export interface CategorySpending {
  category: string;
  amount: number;
  percentage: number;
  transactionCount: number;
  averageAmount: number;
}

export interface MonthlySpending {
  month: string;
  amount: number;
  transactionCount: number;
  savingsAmount: number;
}

export interface MerchantSpending {
  merchant: string;
  amount: number;
  transactionCount: number;
  category: string;
}

export interface FinancialRecommendation {
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

export interface SavingsProjection {
  currentSavingsRate: number;
  projectedMonthly: number;
  projectedYearly: number;
  goalAchievementDate?: Date;
  recommendedAdjustments: string[];
  confidenceLevel: number;
}

export interface AnomalyAlert {
  type: 'unusual_spending' | 'large_transaction' | 'new_merchant' | 'category_spike';
  severity: 'low' | 'medium' | 'high';
  description: string;
  amount?: number;
  merchant?: string;
  category?: string;
  recommendation: string;
}

export class AIInsightsService {
  /**
   * Analyze user's spending patterns and generate insights
   */
  async analyzeSpending(userId: string, transactions: SavingsTransaction[]): Promise<SpendingAnalysis> {
    try {
      // Filter out non-spending transactions (only roundups indicate spending)
      const spendingTransactions = transactions.filter(t => 
        t.type === TransactionType.ROUNDUP && 
        t.originalTransactionAmount && 
        t.merchant && 
        t.category
      );

      if (spendingTransactions.length === 0) {
        return this.getEmptySpendingAnalysis();
      }

      // Calculate basic metrics
      const totalSpent = spendingTransactions.reduce((sum, t) => sum + (t.originalTransactionAmount || 0), 0);
      const averageTransactionAmount = totalSpent / spendingTransactions.length;

      // Category breakdown
      const categoryMap = new Map<string, { amount: number; count: number }>();
      spendingTransactions.forEach(t => {
        const category = t.category || 'Other';
        const existing = categoryMap.get(category) || { amount: 0, count: 0 };
        categoryMap.set(category, {
          amount: existing.amount + (t.originalTransactionAmount || 0),
          count: existing.count + 1
        });
      });

      const categoryBreakdown: CategorySpending[] = Array.from(categoryMap.entries()).map(([category, data]) => ({
        category,
        amount: data.amount,
        percentage: (data.amount / totalSpent) * 100,
        transactionCount: data.count,
        averageAmount: data.amount / data.count
      })).sort((a, b) => b.amount - a.amount);

      // Monthly trend analysis
      const monthlyMap = new Map<string, { spent: number; count: number; saved: number }>();
      spendingTransactions.forEach(t => {
        const month = t.createdAt.toISOString().substring(0, 7); // YYYY-MM
        const existing = monthlyMap.get(month) || { spent: 0, count: 0, saved: 0 };
        monthlyMap.set(month, {
          spent: existing.spent + (t.originalTransactionAmount || 0),
          count: existing.count + 1,
          saved: existing.saved + t.amount // roundup amount
        });
      });

      const monthlyTrend: MonthlySpending[] = Array.from(monthlyMap.entries()).map(([month, data]) => ({
        month,
        amount: data.spent,
        transactionCount: data.count,
        savingsAmount: data.saved
      })).sort((a, b) => a.month.localeCompare(b.month));

      // Top merchants
      const merchantMap = new Map<string, { amount: number; count: number; category: string }>();
      spendingTransactions.forEach(t => {
        const merchant = t.merchant || 'Unknown';
        const existing = merchantMap.get(merchant) || { amount: 0, count: 0, category: t.category || 'Other' };
        merchantMap.set(merchant, {
          amount: existing.amount + (t.originalTransactionAmount || 0),
          count: existing.count + 1,
          category: existing.category
        });
      });

      const topMerchants: MerchantSpending[] = Array.from(merchantMap.entries())
        .map(([merchant, data]) => ({
          merchant,
          amount: data.amount,
          transactionCount: data.count,
          category: data.category
        }))
        .sort((a, b) => b.amount - a.amount)
        .slice(0, 10);

      // Determine spending velocity
      const spendingVelocity = this.calculateSpendingVelocity(monthlyTrend);

      // Generate AI insights
      const insights = await this.generateSpendingInsights(categoryBreakdown, monthlyTrend, spendingVelocity);

      return {
        totalSpent,
        categoryBreakdown,
        monthlyTrend,
        topMerchants,
        averageTransactionAmount,
        spendingVelocity,
        insights
      };
    } catch (error) {
      console.error('Error analyzing spending:', error);
      throw new Error('Failed to analyze spending patterns');
    }
  }

  /**
   * Generate personalized financial recommendations
   */
  async generateRecommendations(userId: string): Promise<FinancialRecommendation[]> {
    try {
      // Get user data and recent transactions
      const user = await prisma.user.findUnique({
        where: { id: userId },
        include: {
          savingsTransactions: {
            orderBy: { createdAt: 'desc' },
            take: 100
          }
        }
      });

      if (!user) {
        throw new Error('User not found');
      }

      const spendingAnalysis = await this.analyzeSpending(userId, user.savingsTransactions);
      
      // Generate AI-powered recommendations
      const prompt = this.buildRecommendationPrompt(user, spendingAnalysis);
      
      const completion = await openai.chat.completions.create({
        model: "gpt-4",
        messages: [
          {
            role: "system",
            content: "You are a financial advisor AI that provides personalized, actionable financial recommendations. Focus on practical advice that can help users save more money and improve their financial habits."
          },
          {
            role: "user",
            content: prompt
          }
        ],
        temperature: 0.7,
        max_tokens: 1000
      });

      const aiResponse = completion.choices[0]?.message?.content || '';
      
      // Parse AI response and create structured recommendations
      const recommendations = this.parseRecommendations(aiResponse);
      
      return recommendations;
    } catch (error) {
      console.error('Error generating recommendations:', error);
      // Return fallback recommendations
      return this.getFallbackRecommendations(userId);
    }
  }  /**

   * Predict savings goals and projections
   */
  async predictSavingsGoals(userId: string): Promise<SavingsProjection> {
    try {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        include: {
          savingsTransactions: {
            where: {
              type: {
                in: [TransactionType.ROUNDUP, TransactionType.MANUAL, TransactionType.DEPOSIT]
              }
            },
            orderBy: { createdAt: 'desc' },
            take: 90 // Last 90 transactions for analysis
          }
        }
      });

      if (!user) {
        throw new Error('User not found');
      }

      // Calculate current savings rate
      const savingsTransactions = user.savingsTransactions;
      const totalSavings = savingsTransactions.reduce((sum, t) => sum + t.amount, 0);
      const daysActive = this.calculateDaysActive(savingsTransactions);
      const currentSavingsRate = daysActive > 0 ? totalSavings / daysActive : 0;

      // Project monthly and yearly savings
      const projectedMonthly = currentSavingsRate * 30;
      const projectedYearly = currentSavingsRate * 365;

      // Calculate goal achievement date
      let goalAchievementDate: Date | undefined;
      if (user.savingsGoal && currentSavingsRate > 0) {
        const remainingAmount = user.savingsGoal - user.totalSaved;
        const daysToGoal = remainingAmount / currentSavingsRate;
        goalAchievementDate = new Date(Date.now() + daysToGoal * 24 * 60 * 60 * 1000);
      }

      // Generate AI-powered recommendations for improvement
      const recommendedAdjustments = await this.generateSavingsAdjustments(user, currentSavingsRate);

      // Calculate confidence level based on data consistency
      const confidenceLevel = this.calculateConfidenceLevel(savingsTransactions);

      return {
        currentSavingsRate,
        projectedMonthly,
        projectedYearly,
        goalAchievementDate,
        recommendedAdjustments,
        confidenceLevel
      };
    } catch (error) {
      console.error('Error predicting savings goals:', error);
      throw new Error('Failed to predict savings goals');
    }
  }

  /**
   * Detect spending anomalies and unusual patterns
   */
  async detectAnomalies(userId: string, transaction: SavingsTransaction): Promise<AnomalyAlert | null> {
    try {
      if (transaction.type !== TransactionType.ROUNDUP || !transaction.originalTransactionAmount) {
        return null; // Only analyze spending transactions
      }

      // Get user's historical spending data
      const historicalTransactions = await prisma.savingsTransaction.findMany({
        where: {
          userId,
          type: TransactionType.ROUNDUP,
          createdAt: {
            gte: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000) // Last 90 days
          }
        }
      });

      if (historicalTransactions.length < 10) {
        return null; // Not enough data for anomaly detection
      }

      // Calculate baseline metrics
      const amounts = historicalTransactions.map(t => t.originalTransactionAmount || 0);
      const avgAmount = amounts.reduce((sum, amt) => sum + amt, 0) / amounts.length;
      const stdDev = Math.sqrt(amounts.reduce((sum, amt) => sum + Math.pow(amt - avgAmount, 2), 0) / amounts.length);

      // Check for large transaction anomaly
      const transactionAmount = transaction.originalTransactionAmount;
      if (transactionAmount > avgAmount + 3 * stdDev) {
        return {
          type: 'large_transaction',
          severity: transactionAmount > avgAmount + 5 * stdDev ? 'high' : 'medium',
          description: `This transaction of $${transactionAmount.toFixed(2)} is significantly larger than your usual spending pattern.`,
          amount: transactionAmount,
          merchant: transaction.merchant || undefined,
          category: transaction.category || undefined,
          recommendation: 'Review this transaction to ensure it was intentional and consider if this affects your savings goals.'
        };
      }

      // Check for new merchant
      const knownMerchants = new Set(historicalTransactions.map(t => t.merchant).filter(Boolean));
      if (transaction.merchant && !knownMerchants.has(transaction.merchant)) {
        return {
          type: 'new_merchant',
          severity: 'low',
          description: `First time spending at ${transaction.merchant}.`,
          merchant: transaction.merchant,
          category: transaction.category || undefined,
          recommendation: 'New spending location detected. Monitor future transactions here to stay on budget.'
        };
      }

      // Check for category spending spike
      const categoryTransactions = historicalTransactions.filter(t => t.category === transaction.category);
      if (categoryTransactions.length >= 5) {
        const categoryAmounts = categoryTransactions.map(t => t.originalTransactionAmount || 0);
        const categoryAvg = categoryAmounts.reduce((sum, amt) => sum + amt, 0) / categoryAmounts.length;
        
        if (transactionAmount > categoryAvg * 2) {
          return {
            type: 'category_spike',
            severity: 'medium',
            description: `This ${transaction.category} purchase is much higher than your usual spending in this category.`,
            amount: transactionAmount,
            category: transaction.category || undefined,
            recommendation: `Consider if this ${transaction.category} expense aligns with your budget and savings goals.`
          };
        }
      }

      return null; // No anomalies detected
    } catch (error) {
      console.error('Error detecting anomalies:', error);
      return null;
    }
  }

  // Private helper methods
  private getEmptySpendingAnalysis(): SpendingAnalysis {
    return {
      totalSpent: 0,
      categoryBreakdown: [],
      monthlyTrend: [],
      topMerchants: [],
      averageTransactionAmount: 0,
      spendingVelocity: 'stable',
      insights: ['Not enough transaction data available for analysis. Start using the app to see insights!']
    };
  }

  private calculateSpendingVelocity(monthlyTrend: MonthlySpending[]): 'increasing' | 'decreasing' | 'stable' {
    if (monthlyTrend.length < 2) return 'stable';
    
    const recent = monthlyTrend.slice(-3); // Last 3 months
    const older = monthlyTrend.slice(-6, -3); // Previous 3 months
    
    if (recent.length === 0 || older.length === 0) return 'stable';
    
    const recentAvg = recent.reduce((sum, m) => sum + m.amount, 0) / recent.length;
    const olderAvg = older.reduce((sum, m) => sum + m.amount, 0) / older.length;
    
    const changePercent = ((recentAvg - olderAvg) / olderAvg) * 100;
    
    if (changePercent > 10) return 'increasing';
    if (changePercent < -10) return 'decreasing';
    return 'stable';
  }

  private async generateSpendingInsights(
    categoryBreakdown: CategorySpending[],
    monthlyTrend: MonthlySpending[],
    spendingVelocity: string
  ): Promise<string[]> {
    try {
      const prompt = `Based on this spending data, provide 3-5 concise financial insights:
      
      Top spending categories: ${categoryBreakdown.slice(0, 3).map(c => `${c.category}: $${c.amount.toFixed(2)} (${c.percentage.toFixed(1)}%)`).join(', ')}
      
      Monthly trend: ${monthlyTrend.length} months of data, spending velocity is ${spendingVelocity}
      
      Provide actionable insights that help the user understand their spending patterns and save more money.`;

      const completion = await openai.chat.completions.create({
        model: "gpt-3.5-turbo",
        messages: [
          {
            role: "system",
            content: "You are a financial advisor. Provide brief, actionable insights about spending patterns. Each insight should be one sentence and focus on practical advice."
          },
          {
            role: "user",
            content: prompt
          }
        ],
        temperature: 0.7,
        max_tokens: 300
      });

      const response = completion.choices[0]?.message?.content || '';
      return response.split('\n').filter(line => line.trim().length > 0).slice(0, 5);
    } catch (error) {
      console.error('Error generating AI insights:', error);
      return this.getFallbackInsights(categoryBreakdown, spendingVelocity);
    }
  }

  private getFallbackInsights(categoryBreakdown: CategorySpending[], spendingVelocity: string): string[] {
    const insights: string[] = [];
    
    if (categoryBreakdown.length > 0) {
      const topCategory = categoryBreakdown[0];
      insights.push(`Your highest spending category is ${topCategory.category} at $${topCategory.amount.toFixed(2)} (${topCategory.percentage.toFixed(1)}% of total spending).`);
    }
    
    if (spendingVelocity === 'increasing') {
      insights.push('Your spending has been increasing recently - consider reviewing your budget to stay on track with savings goals.');
    } else if (spendingVelocity === 'decreasing') {
      insights.push('Great job! Your spending has been decreasing, which means more money available for savings.');
    }
    
    insights.push('Round-up savings are automatically helping you save with every purchase.');
    
    return insights;
  } 
 private buildRecommendationPrompt(user: any, spendingAnalysis: SpendingAnalysis): string {
    return `Generate 3-5 personalized financial recommendations for this user:

User Profile:
- Total Saved: $${user.totalSaved}
- Savings Goal: ${user.savingsGoal ? `$${user.savingsGoal}` : 'Not set'}
- Monthly Target: ${user.monthlyTarget ? `$${user.monthlyTarget}` : 'Not set'}
- Risk Tolerance: ${user.riskTolerance}
- Round-up Enabled: ${user.roundUpEnabled}
- Auto-invest Enabled: ${user.autoInvestEnabled}

Spending Analysis:
- Total Spent: $${spendingAnalysis.totalSpent}
- Average Transaction: $${spendingAnalysis.averageTransactionAmount.toFixed(2)}
- Spending Trend: ${spendingAnalysis.spendingVelocity}
- Top Categories: ${spendingAnalysis.categoryBreakdown.slice(0, 3).map(c => `${c.category} ($${c.amount.toFixed(2)})`).join(', ')}

Provide specific, actionable recommendations that could help them save more money or improve their financial habits. Focus on practical steps they can take.`;
  }

  private parseRecommendations(aiResponse: string): FinancialRecommendation[] {
    const recommendations: FinancialRecommendation[] = [];
    const lines = aiResponse.split('\n').filter(line => line.trim().length > 0);
    
    let currentRec: Partial<FinancialRecommendation> = {};
    
    for (const line of lines) {
      const trimmed = line.trim();
      
      // Check if this is a new recommendation (starts with number or bullet)
      if (/^[\d\-\*]/.test(trimmed)) {
        // Save previous recommendation if exists
        if (currentRec.title && currentRec.description) {
          recommendations.push({
            id: Math.random().toString(36).substr(2, 9),
            type: this.inferRecommendationType(currentRec.description || ''),
            title: currentRec.title,
            description: currentRec.description,
            impact: this.inferImpact(currentRec.description || ''),
            actionable: true,
            createdAt: new Date()
          });
        }
        
        // Start new recommendation
        currentRec = {
          title: trimmed.replace(/^[\d\-\*\.\s]+/, '').split(':')[0] || trimmed,
          description: trimmed.replace(/^[\d\-\*\.\s]+/, '')
        };
      } else if (currentRec.title) {
        // Continue description
        currentRec.description = (currentRec.description || '') + ' ' + trimmed;
      }
    }
    
    // Add the last recommendation
    if (currentRec.title && currentRec.description) {
      recommendations.push({
        id: Math.random().toString(36).substr(2, 9),
        type: this.inferRecommendationType(currentRec.description || ''),
        title: currentRec.title,
        description: currentRec.description,
        impact: this.inferImpact(currentRec.description || ''),
        actionable: true,
        createdAt: new Date()
      });
    }
    
    return recommendations.slice(0, 5); // Limit to 5 recommendations
  }

  private inferRecommendationType(description: string): FinancialRecommendation['type'] {
    const lower = description.toLowerCase();
    
    if (lower.includes('save') || lower.includes('budget') || lower.includes('cut')) {
      return 'savings_opportunity';
    } else if (lower.includes('spend') || lower.includes('alert') || lower.includes('watch')) {
      return 'spending_alert';
    } else if (lower.includes('goal') || lower.includes('target')) {
      return 'goal_adjustment';
    } else if (lower.includes('invest') || lower.includes('yield') || lower.includes('return')) {
      return 'investment_advice';
    }
    
    return 'savings_opportunity';
  }

  private inferImpact(description: string): 'high' | 'medium' | 'low' {
    const lower = description.toLowerCase();
    
    if (lower.includes('significant') || lower.includes('major') || lower.includes('substantial')) {
      return 'high';
    } else if (lower.includes('moderate') || lower.includes('some') || lower.includes('consider')) {
      return 'medium';
    }
    
    return 'low';
  }

  private async getFallbackRecommendations(userId: string): Promise<FinancialRecommendation[]> {
    return [
      {
        id: 'fallback-1',
        type: 'savings_opportunity',
        title: 'Enable Round-up Savings',
        description: 'Automatically round up your purchases to the nearest dollar and save the difference.',
        impact: 'medium',
        actionable: true,
        estimatedSavings: 50,
        createdAt: new Date()
      },
      {
        id: 'fallback-2',
        type: 'goal_adjustment',
        title: 'Set a Monthly Savings Goal',
        description: 'Having a specific target helps you stay motivated and track your progress.',
        impact: 'high',
        actionable: true,
        createdAt: new Date()
      },
      {
        id: 'fallback-3',
        type: 'investment_advice',
        title: 'Enable Auto-investing',
        description: 'Let your savings earn yield automatically through DeFi protocols.',
        impact: 'medium',
        actionable: true,
        createdAt: new Date()
      }
    ];
  }

  private calculateDaysActive(transactions: SavingsTransaction[]): number {
    if (transactions.length === 0) return 0;
    
    const oldest = transactions[transactions.length - 1].createdAt;
    const newest = transactions[0].createdAt;
    
    return Math.max(1, Math.ceil((newest.getTime() - oldest.getTime()) / (24 * 60 * 60 * 1000)));
  }

  private async generateSavingsAdjustments(user: any, currentSavingsRate: number): Promise<string[]> {
    try {
      const prompt = `Suggest 3-4 specific adjustments to improve savings rate:
      
Current savings rate: $${currentSavingsRate.toFixed(2)} per day
Current settings: Round-up ${user.roundUpEnabled ? 'enabled' : 'disabled'}, Auto-invest ${user.autoInvestEnabled ? 'enabled' : 'disabled'}
Savings goal: ${user.savingsGoal ? `$${user.savingsGoal}` : 'Not set'}

Provide specific, actionable adjustments to increase savings.`;

      const completion = await openai.chat.completions.create({
        model: "gpt-3.5-turbo",
        messages: [
          {
            role: "system",
            content: "Provide brief, specific savings improvement suggestions. Each suggestion should be one sentence."
          },
          {
            role: "user",
            content: prompt
          }
        ],
        temperature: 0.7,
        max_tokens: 200
      });

      const response = completion.choices[0]?.message?.content || '';
      return response.split('\n').filter(line => line.trim().length > 0).slice(0, 4);
    } catch (error) {
      console.error('Error generating savings adjustments:', error);
      return [
        'Increase your round-up amount to save more with each transaction',
        'Set up automatic weekly transfers to boost your savings rate',
        'Review and reduce spending in your top expense categories',
        'Enable auto-investing to earn yield on your savings'
      ];
    }
  }

  private calculateConfidenceLevel(transactions: SavingsTransaction[]): number {
    if (transactions.length < 5) return 0.3;
    if (transactions.length < 20) return 0.6;
    if (transactions.length < 50) return 0.8;
    return 0.9;
  }
}

// Export singleton instance
export const aiInsightsService = new AIInsightsService();