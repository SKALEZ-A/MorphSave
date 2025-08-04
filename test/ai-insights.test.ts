import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { AIInsightsService } from '../lib/ai/insights';
import { TransactionType, TransactionStatus } from '@prisma/client';

// Mock OpenAI
jest.mock('openai', () => {
  return {
    __esModule: true,
    default: jest.fn().mockImplementation(() => ({
      chat: {
        completions: {
          create: jest.fn().mockResolvedValue({
            choices: [{
              message: {
                content: 'Mocked AI response with insights and recommendations.'
              }
            }]
          })
        }
      }
    }))
  };
});

// Mock Prisma
jest.mock('../lib/db/prisma', () => ({
  prisma: {
    user: {
      findUnique: jest.fn()
    },
    savingsTransaction: {
      findMany: jest.fn()
    }
  }
}));

describe('AIInsightsService', () => {
  let aiInsightsService: AIInsightsService;
  
  beforeEach(() => {
    aiInsightsService = new AIInsightsService();
    jest.clearAllMocks();
  });

  describe('analyzeSpending', () => {
    it('should analyze spending patterns correctly', async () => {
      const mockTransactions = [
        {
          id: '1',
          userId: 'user1',
          type: TransactionType.ROUNDUP,
          amount: 0.50,
          currency: 'USD',
          status: TransactionStatus.CONFIRMED,
          originalTransactionAmount: 15.50,
          merchant: 'Starbucks',
          category: 'Food & Dining',
          createdAt: new Date('2024-01-15'),
          blockchainTxHash: null,
          yieldProtocol: null,
          apy: null
        },
        {
          id: '2',
          userId: 'user1',
          type: TransactionType.ROUNDUP,
          amount: 0.25,
          currency: 'USD',
          status: TransactionStatus.CONFIRMED,
          originalTransactionAmount: 8.75,
          merchant: 'McDonald\'s',
          category: 'Food & Dining',
          createdAt: new Date('2024-01-16'),
          blockchainTxHash: null,
          yieldProtocol: null,
          apy: null
        },
        {
          id: '3',
          userId: 'user1',
          type: TransactionType.ROUNDUP,
          amount: 0.80,
          currency: 'USD',
          status: TransactionStatus.CONFIRMED,
          originalTransactionAmount: 45.20,
          merchant: 'Gas Station',
          category: 'Transportation',
          createdAt: new Date('2024-01-17'),
          blockchainTxHash: null,
          yieldProtocol: null,
          apy: null
        }
      ];

      const analysis = await aiInsightsService.analyzeSpending('user1', mockTransactions);

      expect(analysis).toBeDefined();
      expect(analysis.totalSpent).toBe(69.45); // 15.50 + 8.75 + 45.20
      expect(analysis.averageTransactionAmount).toBe(23.15); // 69.45 / 3
      expect(analysis.categoryBreakdown).toHaveLength(2);
      expect(analysis.categoryBreakdown[0].category).toBe('Transportation'); // Highest amount
      expect(analysis.categoryBreakdown[0].amount).toBe(45.20);
      expect(analysis.categoryBreakdown[1].category).toBe('Food & Dining');
      expect(analysis.categoryBreakdown[1].amount).toBe(24.25); // 15.50 + 8.75
      expect(analysis.topMerchants).toHaveLength(3);
      expect(analysis.insights).toBeDefined();
      expect(Array.isArray(analysis.insights)).toBe(true);
    });

    it('should handle empty transaction list', async () => {
      const analysis = await aiInsightsService.analyzeSpending('user1', []);

      expect(analysis.totalSpent).toBe(0);
      expect(analysis.categoryBreakdown).toHaveLength(0);
      expect(analysis.monthlyTrend).toHaveLength(0);
      expect(analysis.topMerchants).toHaveLength(0);
      expect(analysis.averageTransactionAmount).toBe(0);
      expect(analysis.spendingVelocity).toBe('stable');
      expect(analysis.insights).toContain('Not enough transaction data available for analysis. Start using the app to see insights!');
    });

    it('should filter out non-roundup transactions', async () => {
      const mockTransactions = [
        {
          id: '1',
          userId: 'user1',
          type: TransactionType.MANUAL,
          amount: 100,
          currency: 'USD',
          status: TransactionStatus.CONFIRMED,
          originalTransactionAmount: null,
          merchant: null,
          category: null,
          createdAt: new Date('2024-01-15'),
          blockchainTxHash: null,
          yieldProtocol: null,
          apy: null
        },
        {
          id: '2',
          userId: 'user1',
          type: TransactionType.ROUNDUP,
          amount: 0.50,
          currency: 'USD',
          status: TransactionStatus.CONFIRMED,
          originalTransactionAmount: 15.50,
          merchant: 'Starbucks',
          category: 'Food & Dining',
          createdAt: new Date('2024-01-16'),
          blockchainTxHash: null,
          yieldProtocol: null,
          apy: null
        }
      ];

      const analysis = await aiInsightsService.analyzeSpending('user1', mockTransactions);

      expect(analysis.totalSpent).toBe(15.50); // Only the roundup transaction
      expect(analysis.categoryBreakdown).toHaveLength(1);
      expect(analysis.categoryBreakdown[0].category).toBe('Food & Dining');
    });
  });

  describe('detectAnomalies', () => {
    const { prisma } = require('../lib/db/prisma');

    beforeEach(() => {
      // Mock historical transactions for anomaly detection
      prisma.savingsTransaction.findMany.mockResolvedValue([
        {
          originalTransactionAmount: 10,
          merchant: 'Regular Store',
          category: 'Shopping'
        },
        {
          originalTransactionAmount: 12,
          merchant: 'Regular Store',
          category: 'Shopping'
        },
        {
          originalTransactionAmount: 8,
          merchant: 'Another Store',
          category: 'Shopping'
        },
        {
          originalTransactionAmount: 15,
          merchant: 'Regular Store',
          category: 'Food & Dining'
        },
        {
          originalTransactionAmount: 11,
          merchant: 'Regular Store',
          category: 'Shopping'
        }
      ]);
    });

    it('should detect large transaction anomaly', async () => {
      const largeTransaction = {
        id: '1',
        userId: 'user1',
        type: TransactionType.ROUNDUP,
        amount: 0.50,
        currency: 'USD',
        status: TransactionStatus.CONFIRMED,
        originalTransactionAmount: 500, // Much larger than historical average
        merchant: 'Expensive Store',
        category: 'Shopping',
        createdAt: new Date(),
        blockchainTxHash: null,
        yieldProtocol: null,
        apy: null
      };

      const anomaly = await aiInsightsService.detectAnomalies('user1', largeTransaction);

      expect(anomaly).toBeDefined();
      expect(anomaly?.type).toBe('large_transaction');
      expect(anomaly?.severity).toBe('high');
      expect(anomaly?.amount).toBe(500);
      expect(anomaly?.description).toContain('significantly larger');
    });

    it('should detect new merchant', async () => {
      const newMerchantTransaction = {
        id: '1',
        userId: 'user1',
        type: TransactionType.ROUNDUP,
        amount: 0.50,
        currency: 'USD',
        status: TransactionStatus.CONFIRMED,
        originalTransactionAmount: 10,
        merchant: 'Brand New Store', // Not in historical data
        category: 'Shopping',
        createdAt: new Date(),
        blockchainTxHash: null,
        yieldProtocol: null,
        apy: null
      };

      const anomaly = await aiInsightsService.detectAnomalies('user1', newMerchantTransaction);

      expect(anomaly).toBeDefined();
      expect(anomaly?.type).toBe('new_merchant');
      expect(anomaly?.severity).toBe('low');
      expect(anomaly?.merchant).toBe('Brand New Store');
      expect(anomaly?.description).toContain('First time spending');
    });

    it('should detect category spending spike', async () => {
      const categorySpike = {
        id: '1',
        userId: 'user1',
        type: TransactionType.ROUNDUP,
        amount: 0.50,
        currency: 'USD',
        status: TransactionStatus.CONFIRMED,
        originalTransactionAmount: 50, // Much higher than category average
        merchant: 'Regular Store',
        category: 'Shopping',
        createdAt: new Date(),
        blockchainTxHash: null,
        yieldProtocol: null,
        apy: null
      };

      const anomaly = await aiInsightsService.detectAnomalies('user1', categorySpike);

      expect(anomaly).toBeDefined();
      expect(anomaly?.type).toBe('category_spike');
      expect(anomaly?.severity).toBe('medium');
      expect(anomaly?.category).toBe('Shopping');
      expect(anomaly?.description).toContain('much higher than your usual spending');
    });

    it('should return null for normal transactions', async () => {
      const normalTransaction = {
        id: '1',
        userId: 'user1',
        type: TransactionType.ROUNDUP,
        amount: 0.50,
        currency: 'USD',
        status: TransactionStatus.CONFIRMED,
        originalTransactionAmount: 10, // Within normal range
        merchant: 'Regular Store',
        category: 'Shopping',
        createdAt: new Date(),
        blockchainTxHash: null,
        yieldProtocol: null,
        apy: null
      };

      const anomaly = await aiInsightsService.detectAnomalies('user1', normalTransaction);

      expect(anomaly).toBeNull();
    });

    it('should return null for non-roundup transactions', async () => {
      const manualTransaction = {
        id: '1',
        userId: 'user1',
        type: TransactionType.MANUAL,
        amount: 100,
        currency: 'USD',
        status: TransactionStatus.CONFIRMED,
        originalTransactionAmount: null,
        merchant: null,
        category: null,
        createdAt: new Date(),
        blockchainTxHash: null,
        yieldProtocol: null,
        apy: null
      };

      const anomaly = await aiInsightsService.detectAnomalies('user1', manualTransaction);

      expect(anomaly).toBeNull();
    });
  });

  describe('predictSavingsGoals', () => {
    const { prisma } = require('../lib/db/prisma');

    it('should predict savings goals correctly', async () => {
      const mockUser = {
        id: 'user1',
        totalSaved: 500,
        savingsGoal: 1000,
        savingsTransactions: [
          {
            amount: 10,
            createdAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000) // 10 days ago
          },
          {
            amount: 15,
            createdAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000) // 5 days ago
          },
          {
            amount: 20,
            createdAt: new Date() // Today
          }
        ]
      };

      prisma.user.findUnique.mockResolvedValue(mockUser);

      const projection = await aiInsightsService.predictSavingsGoals('user1');

      expect(projection).toBeDefined();
      expect(projection.currentSavingsRate).toBeGreaterThan(0);
      expect(projection.projectedMonthly).toBeGreaterThan(0);
      expect(projection.projectedYearly).toBeGreaterThan(0);
      expect(projection.goalAchievementDate).toBeDefined();
      expect(projection.recommendedAdjustments).toBeDefined();
      expect(Array.isArray(projection.recommendedAdjustments)).toBe(true);
      expect(projection.confidenceLevel).toBeGreaterThan(0);
      expect(projection.confidenceLevel).toBeLessThanOrEqual(1);
    });

    it('should handle user with no savings goal', async () => {
      const mockUser = {
        id: 'user1',
        totalSaved: 100,
        savingsGoal: null,
        savingsTransactions: [
          {
            amount: 10,
            createdAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000)
          }
        ]
      };

      prisma.user.findUnique.mockResolvedValue(mockUser);

      const projection = await aiInsightsService.predictSavingsGoals('user1');

      expect(projection.goalAchievementDate).toBeUndefined();
      expect(projection.currentSavingsRate).toBeGreaterThan(0);
    });

    it('should throw error for non-existent user', async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      await expect(aiInsightsService.predictSavingsGoals('nonexistent')).rejects.toThrow('User not found');
    });
  });

  describe('generateRecommendations', () => {
    const { prisma } = require('../lib/db/prisma');

    it('should generate recommendations successfully', async () => {
      const mockUser = {
        id: 'user1',
        totalSaved: 500,
        savingsGoal: 1000,
        monthlyTarget: 100,
        riskTolerance: 'MEDIUM',
        roundUpEnabled: true,
        autoInvestEnabled: false,
        savingsTransactions: []
      };

      prisma.user.findUnique.mockResolvedValue(mockUser);

      const recommendations = await aiInsightsService.generateRecommendations('user1');

      expect(recommendations).toBeDefined();
      expect(Array.isArray(recommendations)).toBe(true);
      expect(recommendations.length).toBeGreaterThan(0);
      expect(recommendations.length).toBeLessThanOrEqual(5);
      
      recommendations.forEach(rec => {
        expect(rec).toHaveProperty('id');
        expect(rec).toHaveProperty('type');
        expect(rec).toHaveProperty('title');
        expect(rec).toHaveProperty('description');
        expect(rec).toHaveProperty('impact');
        expect(rec).toHaveProperty('actionable');
        expect(rec).toHaveProperty('createdAt');
        expect(['savings_opportunity', 'spending_alert', 'goal_adjustment', 'investment_advice']).toContain(rec.type);
        expect(['high', 'medium', 'low']).toContain(rec.impact);
      });
    });

    it('should return fallback recommendations on AI failure', async () => {
      const mockUser = {
        id: 'user1',
        totalSaved: 0,
        savingsGoal: null,
        savingsTransactions: []
      };

      prisma.user.findUnique.mockResolvedValue(mockUser);

      // Mock OpenAI to throw an error
      const OpenAI = require('openai').default;
      const mockOpenAI = new OpenAI();
      mockOpenAI.chat.completions.create.mockRejectedValue(new Error('API Error'));

      const recommendations = await aiInsightsService.generateRecommendations('user1');

      expect(recommendations).toBeDefined();
      expect(Array.isArray(recommendations)).toBe(true);
      expect(recommendations.length).toBe(3); // Fallback recommendations
      expect(recommendations[0].title).toBe('Enable Round-up Savings');
    });
  });
});