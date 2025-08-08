import { prisma } from '../db/prisma';
import Redis from 'ioredis';

export interface AnalyticsEvent {
  userId?: string;
  sessionId: string;
  eventType: string;
  eventName: string;
  properties: Record<string, any>;
  timestamp?: Date;
  clientIp?: string;
  userAgent?: string;
  url?: string;
  referrer?: string;
}

export interface UserBehaviorMetrics {
  totalUsers: number;
  activeUsers: number;
  newUsers: number;
  returningUsers: number;
  averageSessionDuration: number;
  bounceRate: number;
  topPages: Array<{ page: string; views: number }>;
  userFlow: Array<{ from: string; to: string; count: number }>;
}

export interface PerformanceMetrics {
  averageResponseTime: number;
  errorRate: number;
  throughput: number;
  apdex: number;
  slowestEndpoints: Array<{ endpoint: string; averageTime: number }>;
  errorsByType: Record<string, number>;
}

export interface BusinessMetrics {
  totalSavings: number;
  totalUsers: number;
  activeUsers: number;
  savingsGrowthRate: number;
  userRetentionRate: number;
  averageSavingsPerUser: number;
  challengeParticipationRate: number;
  achievementUnlockRate: number;
}

export class AnalyticsService {
  private redis: Redis;

  constructor() {
    this.redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');
  }

  /**
   * Track an analytics event
   */
  async trackEvent(event: AnalyticsEvent): Promise<void> {
    try {
      const timestamp = event.timestamp || new Date();
      const eventId = `event_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

      // Store event in database for long-term analytics
      await prisma.analyticsEvent.create({
        data: {
          id: eventId,
          userId: event.userId,
          sessionId: event.sessionId,
          eventType: event.eventType,
          eventName: event.eventName,
          properties: event.properties,
          timestamp,
          clientIp: event.clientIp,
          userAgent: event.userAgent,
          url: event.url,
          referrer: event.referrer
        }
      });

      // Store in Redis for real-time analytics
      await this.storeRealTimeEvent(event, timestamp);

      // Update user session
      if (event.userId) {
        await this.updateUserSession(event.userId, event.sessionId, timestamp);
      }

    } catch (error) {
      console.error('Failed to track analytics event:', error);
    }
  }

  /**
   * Track page view
   */
  async trackPageView(
    userId: string | undefined,
    sessionId: string,
    page: string,
    title: string,
    referrer?: string,
    clientIp?: string,
    userAgent?: string
  ): Promise<void> {
    await this.trackEvent({
      userId,
      sessionId,
      eventType: 'page_view',
      eventName: 'page_viewed',
      properties: {
        page,
        title,
        referrer
      },
      clientIp,
      userAgent,
      url: page,
      referrer
    });
  }

  /**
   * Track user action
   */
  async trackUserAction(
    userId: string,
    sessionId: string,
    action: string,
    properties: Record<string, any> = {},
    clientIp?: string,
    userAgent?: string
  ): Promise<void> {
    await this.trackEvent({
      userId,
      sessionId,
      eventType: 'user_action',
      eventName: action,
      properties,
      clientIp,
      userAgent
    });
  }

  /**
   * Track business event
   */
  async trackBusinessEvent(
    userId: string,
    sessionId: string,
    eventName: string,
    value: number,
    properties: Record<string, any> = {}
  ): Promise<void> {
    await this.trackEvent({
      userId,
      sessionId,
      eventType: 'business',
      eventName,
      properties: {
        ...properties,
        value
      }
    });
  }

  /**
   * Track error
   */
  async trackError(
    error: Error,
    userId?: string,
    sessionId?: string,
    context?: Record<string, any>
  ): Promise<void> {
    await this.trackEvent({
      userId,
      sessionId: sessionId || 'unknown',
      eventType: 'error',
      eventName: 'error_occurred',
      properties: {
        errorName: error.name,
        errorMessage: error.message,
        errorStack: error.stack,
        context
      }
    });
  }

  /**
   * Get user behavior metrics
   */
  async getUserBehaviorMetrics(timeRange: number = 86400000): Promise<UserBehaviorMetrics> {
    try {
      const startDate = new Date(Date.now() - timeRange);

      const [
        totalUsers,
        activeUsers,
        newUsers,
        pageViews,
        sessions
      ] = await Promise.all([
        prisma.user.count(),
        prisma.user.count({
          where: {
            lastActiveAt: { gte: startDate }
          }
        }),
        prisma.user.count({
          where: {
            createdAt: { gte: startDate }
          }
        }),
        prisma.analyticsEvent.findMany({
          where: {
            eventType: 'page_view',
            timestamp: { gte: startDate }
          },
          select: {
            properties: true,
            userId: true,
            sessionId: true,
            timestamp: true
          }
        }),
        prisma.analyticsEvent.groupBy({
          by: ['sessionId'],
          where: {
            timestamp: { gte: startDate }
          },
          _min: { timestamp: true },
          _max: { timestamp: true }
        })
      ]);

      // Calculate session durations
      const sessionDurations = sessions.map(session => {
        const start = session._min.timestamp?.getTime() || 0;
        const end = session._max.timestamp?.getTime() || 0;
        return end - start;
      });

      const averageSessionDuration = sessionDurations.length > 0
        ? sessionDurations.reduce((sum, duration) => sum + duration, 0) / sessionDurations.length
        : 0;

      // Calculate bounce rate (sessions with only one page view)
      const singlePageSessions = sessions.filter(session => {
        const sessionPageViews = pageViews.filter(pv => pv.sessionId === session.sessionId);
        return sessionPageViews.length === 1;
      });

      const bounceRate = sessions.length > 0 ? (singlePageSessions.length / sessions.length) * 100 : 0;

      // Get top pages
      const pageViewCounts: Record<string, number> = {};
      pageViews.forEach(pv => {
        const page = pv.properties?.page || 'unknown';
        pageViewCounts[page] = (pageViewCounts[page] || 0) + 1;
      });

      const topPages = Object.entries(pageViewCounts)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 10)
        .map(([page, views]) => ({ page, views }));

      // Calculate user flow (simplified)
      const userFlow = await this.calculateUserFlow(startDate);

      const returningUsers = activeUsers - newUsers;

      return {
        totalUsers,
        activeUsers,
        newUsers,
        returningUsers,
        averageSessionDuration,
        bounceRate,
        topPages,
        userFlow
      };

    } catch (error) {
      console.error('Failed to get user behavior metrics:', error);
      return {
        totalUsers: 0,
        activeUsers: 0,
        newUsers: 0,
        returningUsers: 0,
        averageSessionDuration: 0,
        bounceRate: 0,
        topPages: [],
        userFlow: []
      };
    }
  }

  /**
   * Get performance metrics
   */
  async getPerformanceMetrics(timeRange: number = 86400000): Promise<PerformanceMetrics> {
    try {
      const startDate = new Date(Date.now() - timeRange);

      // Get performance data from Redis and database
      const [
        responseTimeData,
        errorData,
        requestData
      ] = await Promise.all([
        this.getResponseTimeMetrics(startDate),
        this.getErrorMetrics(startDate),
        this.getRequestMetrics(startDate)
      ]);

      const averageResponseTime = responseTimeData.average;
      const errorRate = requestData.total > 0 ? (errorData.total / requestData.total) * 100 : 0;
      const throughput = requestData.total / (timeRange / 1000); // requests per second

      // Calculate Apdex score (Application Performance Index)
      // Apdex = (Satisfied + Tolerating/2) / Total
      const satisfiedThreshold = 500; // 500ms
      const toleratingThreshold = 2000; // 2000ms
      
      const apdex = this.calculateApdex(
        responseTimeData.distribution,
        satisfiedThreshold,
        toleratingThreshold
      );

      return {
        averageResponseTime,
        errorRate,
        throughput,
        apdex,
        slowestEndpoints: responseTimeData.slowestEndpoints,
        errorsByType: errorData.byType
      };

    } catch (error) {
      console.error('Failed to get performance metrics:', error);
      return {
        averageResponseTime: 0,
        errorRate: 0,
        throughput: 0,
        apdex: 0,
        slowestEndpoints: [],
        errorsByType: {}
      };
    }
  }

  /**
   * Get business metrics
   */
  async getBusinessMetrics(timeRange: number = 86400000): Promise<BusinessMetrics> {
    try {
      const startDate = new Date(Date.now() - timeRange);
      const previousPeriodStart = new Date(startDate.getTime() - timeRange);

      const [
        totalSavings,
        totalUsers,
        activeUsers,
        previousPeriodSavings,
        savingsTransactions,
        challengeParticipants,
        achievements
      ] = await Promise.all([
        prisma.savingsTransaction.aggregate({
          where: {
            type: { not: 'withdrawal' },
            status: 'confirmed'
          },
          _sum: { amount: true }
        }),
        prisma.user.count(),
        prisma.user.count({
          where: {
            lastActiveAt: { gte: startDate }
          }
        }),
        prisma.savingsTransaction.aggregate({
          where: {
            type: { not: 'withdrawal' },
            status: 'confirmed',
            createdAt: { gte: previousPeriodStart, lt: startDate }
          },
          _sum: { amount: true }
        }),
        prisma.savingsTransaction.findMany({
          where: {
            type: { not: 'withdrawal' },
            status: 'confirmed',
            createdAt: { gte: startDate }
          },
          select: { userId: true, amount: true }
        }),
        prisma.challengeParticipant.count({
          where: {
            joinedAt: { gte: startDate }
          }
        }),
        prisma.userAchievement.count({
          where: {
            unlockedAt: { gte: startDate }
          }
        })
      ]);

      const currentSavings = totalSavings._sum.amount || 0;
      const previousSavings = previousPeriodSavings._sum.amount || 0;
      
      const savingsGrowthRate = previousSavings > 0 
        ? ((currentSavings - previousSavings) / previousSavings) * 100 
        : 0;

      const averageSavingsPerUser = totalUsers > 0 ? currentSavings / totalUsers : 0;

      // Calculate user retention rate (simplified)
      const userRetentionRate = await this.calculateUserRetentionRate(timeRange);

      // Calculate participation rates
      const challengeParticipationRate = activeUsers > 0 
        ? (challengeParticipants / activeUsers) * 100 
        : 0;

      const achievementUnlockRate = activeUsers > 0 
        ? (achievements / activeUsers) * 100 
        : 0;

      return {
        totalSavings: currentSavings,
        totalUsers,
        activeUsers,
        savingsGrowthRate,
        userRetentionRate,
        averageSavingsPerUser,
        challengeParticipationRate,
        achievementUnlockRate
      };

    } catch (error) {
      console.error('Failed to get business metrics:', error);
      return {
        totalSavings: 0,
        totalUsers: 0,
        activeUsers: 0,
        savingsGrowthRate: 0,
        userRetentionRate: 0,
        averageSavingsPerUser: 0,
        challengeParticipationRate: 0,
        achievementUnlockRate: 0
      };
    }
  }

  /**
   * Get real-time analytics data
   */
  async getRealTimeMetrics(): Promise<{
    activeUsers: number;
    currentRequests: number;
    averageResponseTime: number;
    errorRate: number;
    topPages: Array<{ page: string; views: number }>;
  }> {
    try {
      const now = Date.now();
      const fiveMinutesAgo = now - (5 * 60 * 1000);

      // Get data from Redis (real-time cache)
      const [
        activeUsers,
        requestMetrics,
        pageViews
      ] = await Promise.all([
        this.redis.scard('active_users'), // Set of active user IDs
        this.redis.hgetall('request_metrics'),
        this.redis.zrevrange('page_views', 0, 9, 'WITHSCORES')
      ]);

      const currentRequests = parseInt(requestMetrics.current_requests || '0');
      const totalRequests = parseInt(requestMetrics.total_requests || '0');
      const totalResponseTime = parseInt(requestMetrics.total_response_time || '0');
      const totalErrors = parseInt(requestMetrics.total_errors || '0');

      const averageResponseTime = totalRequests > 0 ? totalResponseTime / totalRequests : 0;
      const errorRate = totalRequests > 0 ? (totalErrors / totalRequests) * 100 : 0;

      // Parse page views from Redis sorted set
      const topPages = [];
      for (let i = 0; i < pageViews.length; i += 2) {
        const page = pageViews[i];
        const views = parseInt(pageViews[i + 1]);
        topPages.push({ page, views });
      }

      return {
        activeUsers,
        currentRequests,
        averageResponseTime,
        errorRate,
        topPages
      };

    } catch (error) {
      console.error('Failed to get real-time metrics:', error);
      return {
        activeUsers: 0,
        currentRequests: 0,
        averageResponseTime: 0,
        errorRate: 0,
        topPages: []
      };
    }
  }

  /**
   * Get funnel analysis
   */
  async getFunnelAnalysis(
    steps: string[],
    timeRange: number = 86400000
  ): Promise<Array<{ step: string; users: number; conversionRate: number }>> {
    try {
      const startDate = new Date(Date.now() - timeRange);
      const funnelData = [];

      let previousStepUsers = 0;

      for (let i = 0; i < steps.length; i++) {
        const step = steps[i];
        
        const users = await prisma.analyticsEvent.groupBy({
          by: ['userId'],
          where: {
            eventName: step,
            timestamp: { gte: startDate },
            userId: { not: null }
          }
        });

        const userCount = users.length;
        const conversionRate = i === 0 ? 100 : previousStepUsers > 0 ? (userCount / previousStepUsers) * 100 : 0;

        funnelData.push({
          step,
          users: userCount,
          conversionRate
        });

        previousStepUsers = userCount;
      }

      return funnelData;

    } catch (error) {
      console.error('Failed to get funnel analysis:', error);
      return steps.map(step => ({ step, users: 0, conversionRate: 0 }));
    }
  }

  /**
   * Get cohort analysis
   */
  async getCohortAnalysis(timeRange: number = 86400000 * 30): Promise<any> {
    try {
      const startDate = new Date(Date.now() - timeRange);

      // Get user cohorts by registration week
      const cohorts = await prisma.user.groupBy({
        by: ['createdAt'],
        where: {
          createdAt: { gte: startDate }
        },
        _count: true
      });

      // This is a simplified cohort analysis
      // In a full implementation, you'd track user retention over time
      return cohorts.map(cohort => ({
        period: cohort.createdAt,
        users: cohort._count,
        retention: {} // Would contain retention rates for each period
      }));

    } catch (error) {
      console.error('Failed to get cohort analysis:', error);
      return [];
    }
  }

  /**
   * Store real-time event data in Redis
   */
  private async storeRealTimeEvent(event: AnalyticsEvent, timestamp: Date): Promise<void> {
    try {
      const pipeline = this.redis.pipeline();

      // Track active users
      if (event.userId) {
        pipeline.sadd('active_users', event.userId);
        pipeline.expire('active_users', 300); // 5 minutes
      }

      // Track page views
      if (event.eventType === 'page_view' && event.properties?.page) {
        pipeline.zincrby('page_views', 1, event.properties.page);
        pipeline.expire('page_views', 300);
      }

      // Track events by type
      pipeline.hincrby('event_counts', event.eventType, 1);
      pipeline.expire('event_counts', 300);

      await pipeline.exec();

    } catch (error) {
      console.error('Failed to store real-time event:', error);
    }
  }

  /**
   * Update user session data
   */
  private async updateUserSession(userId: string, sessionId: string, timestamp: Date): Promise<void> {
    try {
      await prisma.user.update({
        where: { id: userId },
        data: { lastActiveAt: timestamp }
      });

      // Update session in Redis
      await this.redis.setex(`session:${sessionId}`, 1800, JSON.stringify({
        userId,
        lastActivity: timestamp.toISOString()
      }));

    } catch (error) {
      console.error('Failed to update user session:', error);
    }
  }

  /**
   * Calculate user flow between pages
   */
  private async calculateUserFlow(startDate: Date): Promise<Array<{ from: string; to: string; count: number }>> {
    try {
      const pageViews = await prisma.analyticsEvent.findMany({
        where: {
          eventType: 'page_view',
          timestamp: { gte: startDate }
        },
        select: {
          sessionId: true,
          properties: true,
          timestamp: true
        },
        orderBy: { timestamp: 'asc' }
      });

      const flows: Record<string, number> = {};
      const sessionFlows: Record<string, string[]> = {};

      // Group page views by session
      pageViews.forEach(pv => {
        const page = pv.properties?.page || 'unknown';
        if (!sessionFlows[pv.sessionId]) {
          sessionFlows[pv.sessionId] = [];
        }
        sessionFlows[pv.sessionId].push(page);
      });

      // Calculate flows
      Object.values(sessionFlows).forEach(pages => {
        for (let i = 0; i < pages.length - 1; i++) {
          const from = pages[i];
          const to = pages[i + 1];
          const flowKey = `${from} -> ${to}`;
          flows[flowKey] = (flows[flowKey] || 0) + 1;
        }
      });

      return Object.entries(flows)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 10)
        .map(([flow, count]) => {
          const [from, to] = flow.split(' -> ');
          return { from, to, count };
        });

    } catch (error) {
      console.error('Failed to calculate user flow:', error);
      return [];
    }
  }

  /**
   * Get response time metrics
   */
  private async getResponseTimeMetrics(startDate: Date): Promise<{
    average: number;
    distribution: number[];
    slowestEndpoints: Array<{ endpoint: string; averageTime: number }>;
  }> {
    // This would typically come from your application performance monitoring
    // For now, return mock data
    return {
      average: 250,
      distribution: [100, 200, 300, 400, 500, 600, 700, 800, 900, 1000],
      slowestEndpoints: [
        { endpoint: '/api/insights/analysis', averageTime: 1200 },
        { endpoint: '/api/savings/summary', averageTime: 800 },
        { endpoint: '/api/challenges', averageTime: 600 }
      ]
    };
  }

  /**
   * Get error metrics
   */
  private async getErrorMetrics(startDate: Date): Promise<{
    total: number;
    byType: Record<string, number>;
  }> {
    try {
      const errors = await prisma.analyticsEvent.findMany({
        where: {
          eventType: 'error',
          timestamp: { gte: startDate }
        },
        select: { properties: true }
      });

      const byType: Record<string, number> = {};
      errors.forEach(error => {
        const errorName = error.properties?.errorName || 'Unknown';
        byType[errorName] = (byType[errorName] || 0) + 1;
      });

      return {
        total: errors.length,
        byType
      };

    } catch (error) {
      console.error('Failed to get error metrics:', error);
      return { total: 0, byType: {} };
    }
  }

  /**
   * Get request metrics
   */
  private async getRequestMetrics(startDate: Date): Promise<{ total: number }> {
    try {
      const total = await prisma.analyticsEvent.count({
        where: {
          eventType: { in: ['page_view', 'user_action'] },
          timestamp: { gte: startDate }
        }
      });

      return { total };

    } catch (error) {
      console.error('Failed to get request metrics:', error);
      return { total: 0 };
    }
  }

  /**
   * Calculate Apdex score
   */
  private calculateApdex(
    responseTimes: number[],
    satisfiedThreshold: number,
    toleratingThreshold: number
  ): number {
    if (responseTimes.length === 0) return 0;

    let satisfied = 0;
    let tolerating = 0;

    responseTimes.forEach(time => {
      if (time <= satisfiedThreshold) {
        satisfied++;
      } else if (time <= toleratingThreshold) {
        tolerating++;
      }
    });

    return (satisfied + tolerating / 2) / responseTimes.length;
  }

  /**
   * Calculate user retention rate
   */
  private async calculateUserRetentionRate(timeRange: number): Promise<number> {
    try {
      const startDate = new Date(Date.now() - timeRange);
      const previousPeriodStart = new Date(startDate.getTime() - timeRange);

      const [currentPeriodUsers, previousPeriodUsers] = await Promise.all([
        prisma.user.findMany({
          where: {
            createdAt: { gte: previousPeriodStart, lt: startDate }
          },
          select: { id: true }
        }),
        prisma.user.count({
          where: {
            createdAt: { gte: previousPeriodStart, lt: startDate },
            lastActiveAt: { gte: startDate }
          }
        })
      ]);

      return currentPeriodUsers.length > 0 
        ? (previousPeriodUsers / currentPeriodUsers.length) * 100 
        : 0;

    } catch (error) {
      console.error('Failed to calculate user retention rate:', error);
      return 0;
    }
  }

  /**
   * Clean up old analytics data
   */
  async cleanup(olderThanDays: number = 90): Promise<void> {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - olderThanDays);

      await prisma.analyticsEvent.deleteMany({
        where: {
          timestamp: { lt: cutoffDate }
        }
      });

    } catch (error) {
      console.error('Failed to cleanup analytics data:', error);
    }
  }
}

// Export singleton instance
export const analyticsService = new AnalyticsService();