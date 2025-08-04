import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { NextRequest } from 'next/server';
import { GET as getAnalysis } from '../src/app/api/insights/analysis/route';
import { GET as getRecommendations } from '../src/app/api/insights/recommendations/route';
import { GET as getProjections } from '../src/app/api/insights/projections/route';
import { POST as postAnomalies } from '../src/app/api/insights/anomalies/route';

// Mock the auth middleware
jest.mock('../lib/middleware/auth', () => ({
  verifyAuth: jest.fn()
}));

// Mock the AI insights service
jest.mock('../lib/ai/insights', () => ({
  aiInsightsService: {
    analyzeSpending: jest.fn(),
    generateRecommendations: jest.fn(),
    predictSavingsGoals: jest.fn(),
    detectAnomalies: jest.fn()
  }
}));

// Mock Prisma
jest.mock('../lib/db/prisma', () => ({
  prisma: {
    savingsTransaction: {
      findMany: jest.fn(),
      findUnique: jest.fn()
    }
  }
}));

describe('AI Insights API Routes', () => {
  const { verifyAuth } = require('../lib/middleware/auth');
  const { aiInsightsService } = require('../lib/ai/insights');
  const { prisma } = require('../lib/db/prisma');

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Default successful auth
    verifyAuth.mockResolvedValue({
      success: true,
      userId: 'test-user-id'
    });
  });

  describe('GET /api/insights/analysis', () => {
    it('should return spending analysis successfully', async () => {
      const mockAnalysis = {
        totalSpent: 500,
        categoryBreakdown: [
          { category: 'Food & Dining', amount: 200, percentage: 40, transactionCount: 10, averageAmount: 20 }
        ],
        monthlyTrend: [],
        topMerchants: [],
        averageTransactionAmount: 25,
        spendingVelocity: 'stable' as const,
        insights: ['You spend most on food and dining']
      };

      prisma.savingsTransaction.findMany.mockResolvedValue([]);
      aiInsightsService.analyzeSpending.mockResolvedValue(mockAnalysis);

      const request = new NextRequest('http://localhost:3000/api/insights/analysis');
      const response = await getAnalysis(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data).toEqual(mockAnalysis);
      expect(verifyAuth).toHaveBeenCalledWith(request);
      expect(aiInsightsService.analyzeSpending).toHaveBeenCalledWith('test-user-id', []);
    });

    it('should return 401 for unauthorized requests', async () => {
      verifyAuth.mockResolvedValue({ success: false });

      const request = new NextRequest('http://localhost:3000/api/insights/analysis');
      const response = await getAnalysis(request);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe('Unauthorized');
    });

    it('should handle service errors gracefully', async () => {
      prisma.savingsTransaction.findMany.mockResolvedValue([]);
      aiInsightsService.analyzeSpending.mockRejectedValue(new Error('Service error'));

      const request = new NextRequest('http://localhost:3000/api/insights/analysis');
      const response = await getAnalysis(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe('Failed to analyze spending patterns');
    });
  });

  describe('GET /api/insights/recommendations', () => {
    it('should return recommendations successfully', async () => {
      const mockRecommendations = [
        {
          id: 'rec-1',
          type: 'savings_opportunity' as const,
          title: 'Reduce dining expenses',
          description: 'You could save $50/month by cooking more at home',
          impact: 'medium' as const,
          actionable: true,
          estimatedSavings: 50,
          createdAt: new Date()
        }
      ];

      aiInsightsService.generateRecommendations.mockResolvedValue(mockRecommendations);

      const request = new NextRequest('http://localhost:3000/api/insights/recommendations');
      const response = await getRecommendations(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data).toEqual(mockRecommendations);
      expect(aiInsightsService.generateRecommendations).toHaveBeenCalledWith('test-user-id');
    });

    it('should return 401 for unauthorized requests', async () => {
      verifyAuth.mockResolvedValue({ success: false });

      const request = new NextRequest('http://localhost:3000/api/insights/recommendations');
      const response = await getRecommendations(request);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe('Unauthorized');
    });

    it('should handle service errors gracefully', async () => {
      aiInsightsService.generateRecommendations.mockRejectedValue(new Error('Service error'));

      const request = new NextRequest('http://localhost:3000/api/insights/recommendations');
      const response = await getRecommendations(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe('Failed to generate recommendations');
    });
  });

  describe('GET /api/insights/projections', () => {
    it('should return savings projections successfully', async () => {
      const mockProjections = {
        currentSavingsRate: 5.5,
        projectedMonthly: 165,
        projectedYearly: 2007.5,
        goalAchievementDate: new Date('2024-12-31'),
        recommendedAdjustments: ['Increase round-up amount'],
        confidenceLevel: 0.8
      };

      aiInsightsService.predictSavingsGoals.mockResolvedValue(mockProjections);

      const request = new NextRequest('http://localhost:3000/api/insights/projections');
      const response = await getProjections(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data).toEqual(mockProjections);
      expect(aiInsightsService.predictSavingsGoals).toHaveBeenCalledWith('test-user-id');
    });

    it('should return 401 for unauthorized requests', async () => {
      verifyAuth.mockResolvedValue({ success: false });

      const request = new NextRequest('http://localhost:3000/api/insights/projections');
      const response = await getProjections(request);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe('Unauthorized');
    });

    it('should handle service errors gracefully', async () => {
      aiInsightsService.predictSavingsGoals.mockRejectedValue(new Error('Service error'));

      const request = new NextRequest('http://localhost:3000/api/insights/projections');
      const response = await getProjections(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe('Failed to generate savings projections');
    });
  });

  describe('POST /api/insights/anomalies', () => {
    it('should detect anomalies successfully', async () => {
      const mockTransaction = {
        id: 'tx-1',
        userId: 'test-user-id',
        type: 'ROUNDUP',
        amount: 0.5,
        originalTransactionAmount: 100,
        merchant: 'Test Store',
        category: 'Shopping'
      };

      const mockAnomaly = {
        type: 'large_transaction' as const,
        severity: 'high' as const,
        description: 'This transaction is unusually large',
        amount: 100,
        merchant: 'Test Store',
        recommendation: 'Review this transaction'
      };

      prisma.savingsTransaction.findUnique.mockResolvedValue(mockTransaction);
      aiInsightsService.detectAnomalies.mockResolvedValue(mockAnomaly);

      const request = new NextRequest('http://localhost:3000/api/insights/anomalies', {
        method: 'POST',
        body: JSON.stringify({ transactionId: 'tx-1' })
      });

      const response = await postAnomalies(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data).toEqual(mockAnomaly);
      expect(aiInsightsService.detectAnomalies).toHaveBeenCalledWith('test-user-id', mockTransaction);
    });

    it('should return 400 for missing transaction ID', async () => {
      const request = new NextRequest('http://localhost:3000/api/insights/anomalies', {
        method: 'POST',
        body: JSON.stringify({})
      });

      const response = await postAnomalies(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('Transaction ID is required');
    });

    it('should return 404 for non-existent transaction', async () => {
      prisma.savingsTransaction.findUnique.mockResolvedValue(null);

      const request = new NextRequest('http://localhost:3000/api/insights/anomalies', {
        method: 'POST',
        body: JSON.stringify({ transactionId: 'non-existent' })
      });

      const response = await postAnomalies(request);
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.error).toBe('Transaction not found');
    });

    it('should return 404 for transaction belonging to different user', async () => {
      const mockTransaction = {
        id: 'tx-1',
        userId: 'different-user-id',
        type: 'ROUNDUP'
      };

      prisma.savingsTransaction.findUnique.mockResolvedValue(mockTransaction);

      const request = new NextRequest('http://localhost:3000/api/insights/anomalies', {
        method: 'POST',
        body: JSON.stringify({ transactionId: 'tx-1' })
      });

      const response = await postAnomalies(request);
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.error).toBe('Transaction not found');
    });

    it('should return 401 for unauthorized requests', async () => {
      verifyAuth.mockResolvedValue({ success: false });

      const request = new NextRequest('http://localhost:3000/api/insights/anomalies', {
        method: 'POST',
        body: JSON.stringify({ transactionId: 'tx-1' })
      });

      const response = await postAnomalies(request);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe('Unauthorized');
    });

    it('should handle service errors gracefully', async () => {
      const mockTransaction = {
        id: 'tx-1',
        userId: 'test-user-id',
        type: 'ROUNDUP'
      };

      prisma.savingsTransaction.findUnique.mockResolvedValue(mockTransaction);
      aiInsightsService.detectAnomalies.mockRejectedValue(new Error('Service error'));

      const request = new NextRequest('http://localhost:3000/api/insights/anomalies', {
        method: 'POST',
        body: JSON.stringify({ transactionId: 'tx-1' })
      });

      const response = await postAnomalies(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe('Failed to detect anomalies');
    });
  });
});