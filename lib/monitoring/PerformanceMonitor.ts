import { NextRequest, NextResponse } from 'next/server';
import Redis from 'ioredis';
import { prisma } from '../db/prisma';

export interface PerformanceMetric {
  id: string;
  endpoint: string;
  method: string;
  responseTime: number;
  statusCode: number;
  timestamp: Date;
  userId?: string;
  userAgent?: string;
  clientIp?: string;
  memoryUsage?: number;
  cpuUsage?: number;
}

export interface SystemMetrics {
  memoryUsage: {
    used: number;
    total: number;
    percentage: number;
  };
  cpuUsage: {
    percentage: number;
    loadAverage: number[];
  };
  diskUsage: {
    used: number;
    total: number;
    percentage: number;
  };
  networkIO: {
    bytesIn: number;
    bytesOut: number;
  };
}

export interface AlertRule {
  id: string;
  name: string;
  metric: string;
  condition: 'greater_than' | 'less_than' | 'equals';
  threshold: number;
  duration: number; // in seconds
  enabled: boolean;
  channels: ('email' | 'slack' | 'webhook')[];
}

export class PerformanceMonitor {
  private redis: Redis;
  private alertRules: Map<string, AlertRule> = new Map();
  private alertStates: Map<string, { triggered: boolean; since: Date }> = new Map();

  constructor() {
    this.redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');
    this.loadAlertRules();
  }

  /**
   * Middleware to track request performance
   */
  async trackRequest(
    request: NextRequest,
    handler: (req: NextRequest) => Promise<NextResponse>
  ): Promise<NextResponse> {
    const startTime = Date.now();
    const startMemory = process.memoryUsage();
    
    try {
      const response = await handler(request);
      
      const endTime = Date.now();
      const responseTime = endTime - startTime;
      const endMemory = process.memoryUsage();
      
      // Track the performance metric
      await this.recordMetric({
        id: `perf_${endTime}_${Math.random().toString(36).substr(2, 9)}`,
        endpoint: new URL(request.url).pathname,
        method: request.method,
        responseTime,
        statusCode: response.status,
        timestamp: new Date(endTime),
        userAgent: request.headers.get('user-agent') || undefined,
        clientIp: this.getClientIp(request),
        memoryUsage: endMemory.heapUsed - startMemory.heapUsed
      });

      // Add performance headers
      response.headers.set('X-Response-Time', `${responseTime}ms`);
      response.headers.set('X-Memory-Usage', `${endMemory.heapUsed}`);

      return response;

    } catch (error) {
      const endTime = Date.now();
      const responseTime = endTime - startTime;

      // Track error metric
      await this.recordMetric({
        id: `perf_error_${endTime}_${Math.random().toString(36).substr(2, 9)}`,
        endpoint: new URL(request.url).pathname,
        method: request.method,
        responseTime,
        statusCode: 500,
        timestamp: new Date(endTime),
        userAgent: request.headers.get('user-agent') || undefined,
        clientIp: this.getClientIp(request)
      });

      throw error;
    }
  }

  /**
   * Record a performance metric
   */
  async recordMetric(metric: PerformanceMetric): Promise<void> {
    try {
      // Store in database for long-term analysis
      await prisma.performanceMetric.create({
        data: {
          id: metric.id,
          endpoint: metric.endpoint,
          method: metric.method,
          responseTime: metric.responseTime,
          statusCode: metric.statusCode,
          timestamp: metric.timestamp,
          userId: metric.userId,
          userAgent: metric.userAgent,
          clientIp: metric.clientIp,
          memoryUsage: metric.memoryUsage,
          cpuUsage: metric.cpuUsage
        }
      });

      // Store in Redis for real-time monitoring
      await this.storeRealTimeMetric(metric);

      // Check alert rules
      await this.checkAlerts(metric);

    } catch (error) {
      console.error('Failed to record performance metric:', error);
    }
  }

  /**
   * Get performance statistics
   */
  async getPerformanceStats(timeRange: number = 3600000): Promise<{
    averageResponseTime: number;
    p95ResponseTime: number;
    p99ResponseTime: number;
    errorRate: number;
    throughput: number;
    slowestEndpoints: Array<{ endpoint: string; averageTime: number; count: number }>;
    errorsByEndpoint: Array<{ endpoint: string; errors: number; total: number }>;
    statusCodeDistribution: Record<string, number>;
  }> {
    try {
      const startDate = new Date(Date.now() - timeRange);

      const metrics = await prisma.performanceMetric.findMany({
        where: {
          timestamp: { gte: startDate }
        },
        select: {
          endpoint: true,
          responseTime: true,
          statusCode: true
        }
      });

      if (metrics.length === 0) {
        return {
          averageResponseTime: 0,
          p95ResponseTime: 0,
          p99ResponseTime: 0,
          errorRate: 0,
          throughput: 0,
          slowestEndpoints: [],
          errorsByEndpoint: [],
          statusCodeDistribution: {}
        };
      }

      // Calculate response time statistics
      const responseTimes = metrics.map(m => m.responseTime).sort((a, b) => a - b);
      const averageResponseTime = responseTimes.reduce((sum, time) => sum + time, 0) / responseTimes.length;
      const p95Index = Math.floor(responseTimes.length * 0.95);
      const p99Index = Math.floor(responseTimes.length * 0.99);
      const p95ResponseTime = responseTimes[p95Index] || 0;
      const p99ResponseTime = responseTimes[p99Index] || 0;

      // Calculate error rate
      const errors = metrics.filter(m => m.statusCode >= 400);
      const errorRate = (errors.length / metrics.length) * 100;

      // Calculate throughput (requests per second)
      const throughput = metrics.length / (timeRange / 1000);

      // Group by endpoint
      const endpointStats: Record<string, { times: number[]; errors: number; total: number }> = {};
      metrics.forEach(metric => {
        if (!endpointStats[metric.endpoint]) {
          endpointStats[metric.endpoint] = { times: [], errors: 0, total: 0 };
        }
        endpointStats[metric.endpoint].times.push(metric.responseTime);
        endpointStats[metric.endpoint].total++;
        if (metric.statusCode >= 400) {
          endpointStats[metric.endpoint].errors++;
        }
      });

      // Calculate slowest endpoints
      const slowestEndpoints = Object.entries(endpointStats)
        .map(([endpoint, stats]) => ({
          endpoint,
          averageTime: stats.times.reduce((sum, time) => sum + time, 0) / stats.times.length,
          count: stats.total
        }))
        .sort((a, b) => b.averageTime - a.averageTime)
        .slice(0, 10);

      // Calculate errors by endpoint
      const errorsByEndpoint = Object.entries(endpointStats)
        .map(([endpoint, stats]) => ({
          endpoint,
          errors: stats.errors,
          total: stats.total
        }))
        .filter(stat => stat.errors > 0)
        .sort((a, b) => b.errors - a.errors)
        .slice(0, 10);

      // Status code distribution
      const statusCodeDistribution: Record<string, number> = {};
      metrics.forEach(metric => {
        const statusGroup = `${Math.floor(metric.statusCode / 100)}xx`;
        statusCodeDistribution[statusGroup] = (statusCodeDistribution[statusGroup] || 0) + 1;
      });

      return {
        averageResponseTime,
        p95ResponseTime,
        p99ResponseTime,
        errorRate,
        throughput,
        slowestEndpoints,
        errorsByEndpoint,
        statusCodeDistribution
      };

    } catch (error) {
      console.error('Failed to get performance stats:', error);
      return {
        averageResponseTime: 0,
        p95ResponseTime: 0,
        p99ResponseTime: 0,
        errorRate: 0,
        throughput: 0,
        slowestEndpoints: [],
        errorsByEndpoint: [],
        statusCodeDistribution: {}
      };
    }
  }

  /**
   * Get system metrics
   */
  async getSystemMetrics(): Promise<SystemMetrics> {
    try {
      const memoryUsage = process.memoryUsage();
      const cpuUsage = process.cpuUsage();
      const loadAverage = require('os').loadavg();

      // Get system memory info
      const totalMemory = require('os').totalmem();
      const freeMemory = require('os').freemem();
      const usedMemory = totalMemory - freeMemory;

      // Get disk usage (simplified - would need platform-specific implementation)
      const diskUsage = await this.getDiskUsage();

      // Get network I/O (from Redis cache)
      const networkIO = await this.getNetworkIO();

      return {
        memoryUsage: {
          used: usedMemory,
          total: totalMemory,
          percentage: (usedMemory / totalMemory) * 100
        },
        cpuUsage: {
          percentage: this.calculateCpuPercentage(cpuUsage),
          loadAverage
        },
        diskUsage,
        networkIO
      };

    } catch (error) {
      console.error('Failed to get system metrics:', error);
      return {
        memoryUsage: { used: 0, total: 0, percentage: 0 },
        cpuUsage: { percentage: 0, loadAverage: [0, 0, 0] },
        diskUsage: { used: 0, total: 0, percentage: 0 },
        networkIO: { bytesIn: 0, bytesOut: 0 }
      };
    }
  }

  /**
   * Get real-time performance data
   */
  async getRealTimeMetrics(): Promise<{
    currentRPS: number;
    averageResponseTime: number;
    errorRate: number;
    activeConnections: number;
    memoryUsage: number;
    cpuUsage: number;
  }> {
    try {
      const now = Date.now();
      const oneMinuteAgo = now - 60000;

      // Get metrics from Redis
      const [
        requestCount,
        responseTimeSum,
        errorCount,
        activeConnections,
        memoryUsage,
        cpuUsage
      ] = await Promise.all([
        this.redis.get('metrics:requests:count') || '0',
        this.redis.get('metrics:response_time:sum') || '0',
        this.redis.get('metrics:errors:count') || '0',
        this.redis.get('metrics:connections:active') || '0',
        this.redis.get('metrics:memory:usage') || '0',
        this.redis.get('metrics:cpu:usage') || '0'
      ]);

      const requests = parseInt(requestCount);
      const totalResponseTime = parseInt(responseTimeSum);
      const errors = parseInt(errorCount);

      return {
        currentRPS: requests / 60, // requests per second over last minute
        averageResponseTime: requests > 0 ? totalResponseTime / requests : 0,
        errorRate: requests > 0 ? (errors / requests) * 100 : 0,
        activeConnections: parseInt(activeConnections),
        memoryUsage: parseInt(memoryUsage),
        cpuUsage: parseFloat(cpuUsage)
      };

    } catch (error) {
      console.error('Failed to get real-time metrics:', error);
      return {
        currentRPS: 0,
        averageResponseTime: 0,
        errorRate: 0,
        activeConnections: 0,
        memoryUsage: 0,
        cpuUsage: 0
      };
    }
  }

  /**
   * Create alert rule
   */
  async createAlertRule(rule: Omit<AlertRule, 'id'>): Promise<string> {
    const id = `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const alertRule: AlertRule = { ...rule, id };

    this.alertRules.set(id, alertRule);
    
    // Store in database
    await prisma.alertRule.create({
      data: {
        id,
        name: rule.name,
        metric: rule.metric,
        condition: rule.condition,
        threshold: rule.threshold,
        duration: rule.duration,
        enabled: rule.enabled,
        channels: rule.channels
      }
    });

    return id;
  }

  /**
   * Update alert rule
   */
  async updateAlertRule(id: string, updates: Partial<AlertRule>): Promise<void> {
    const existingRule = this.alertRules.get(id);
    if (!existingRule) {
      throw new Error('Alert rule not found');
    }

    const updatedRule = { ...existingRule, ...updates };
    this.alertRules.set(id, updatedRule);

    // Update in database
    await prisma.alertRule.update({
      where: { id },
      data: {
        name: updatedRule.name,
        metric: updatedRule.metric,
        condition: updatedRule.condition,
        threshold: updatedRule.threshold,
        duration: updatedRule.duration,
        enabled: updatedRule.enabled,
        channels: updatedRule.channels
      }
    });
  }

  /**
   * Delete alert rule
   */
  async deleteAlertRule(id: string): Promise<void> {
    this.alertRules.delete(id);
    this.alertStates.delete(id);

    await prisma.alertRule.delete({
      where: { id }
    });
  }

  /**
   * Get all alert rules
   */
  getAlertRules(): AlertRule[] {
    return Array.from(this.alertRules.values());
  }

  /**
   * Store real-time metric in Redis
   */
  private async storeRealTimeMetric(metric: PerformanceMetric): Promise<void> {
    try {
      const pipeline = this.redis.pipeline();

      // Update counters
      pipeline.incr('metrics:requests:count');
      pipeline.incrby('metrics:response_time:sum', metric.responseTime);
      
      if (metric.statusCode >= 400) {
        pipeline.incr('metrics:errors:count');
      }

      // Set expiration for counters (1 minute)
      pipeline.expire('metrics:requests:count', 60);
      pipeline.expire('metrics:response_time:sum', 60);
      pipeline.expire('metrics:errors:count', 60);

      // Store endpoint-specific metrics
      const endpointKey = `endpoint:${metric.endpoint}`;
      pipeline.lpush(`${endpointKey}:response_times`, metric.responseTime);
      pipeline.ltrim(`${endpointKey}:response_times`, 0, 99); // Keep last 100
      pipeline.expire(`${endpointKey}:response_times`, 300); // 5 minutes

      await pipeline.exec();

    } catch (error) {
      console.error('Failed to store real-time metric:', error);
    }
  }

  /**
   * Check alert rules against metric
   */
  private async checkAlerts(metric: PerformanceMetric): Promise<void> {
    for (const [ruleId, rule] of this.alertRules) {
      if (!rule.enabled) continue;

      let metricValue: number;
      
      // Get the metric value based on rule type
      switch (rule.metric) {
        case 'response_time':
          metricValue = metric.responseTime;
          break;
        case 'error_rate':
          // Would need to calculate error rate over time window
          continue;
        case 'memory_usage':
          metricValue = metric.memoryUsage || 0;
          break;
        default:
          continue;
      }

      // Check condition
      let conditionMet = false;
      switch (rule.condition) {
        case 'greater_than':
          conditionMet = metricValue > rule.threshold;
          break;
        case 'less_than':
          conditionMet = metricValue < rule.threshold;
          break;
        case 'equals':
          conditionMet = metricValue === rule.threshold;
          break;
      }

      const alertState = this.alertStates.get(ruleId) || { triggered: false, since: new Date() };

      if (conditionMet && !alertState.triggered) {
        // Alert condition met for the first time
        this.alertStates.set(ruleId, { triggered: true, since: new Date() });
      } else if (conditionMet && alertState.triggered) {
        // Check if duration threshold is met
        const durationMs = Date.now() - alertState.since.getTime();
        if (durationMs >= rule.duration * 1000) {
          await this.triggerAlert(rule, metricValue);
        }
      } else if (!conditionMet && alertState.triggered) {
        // Condition no longer met, reset alert state
        this.alertStates.set(ruleId, { triggered: false, since: new Date() });
      }
    }
  }

  /**
   * Trigger an alert
   */
  private async triggerAlert(rule: AlertRule, value: number): Promise<void> {
    try {
      const alertData = {
        ruleName: rule.name,
        metric: rule.metric,
        value,
        threshold: rule.threshold,
        condition: rule.condition,
        timestamp: new Date()
      };

      // Send alerts through configured channels
      for (const channel of rule.channels) {
        switch (channel) {
          case 'email':
            await this.sendEmailAlert(alertData);
            break;
          case 'slack':
            await this.sendSlackAlert(alertData);
            break;
          case 'webhook':
            await this.sendWebhookAlert(alertData);
            break;
        }
      }

      // Log the alert
      console.warn('Performance Alert Triggered:', alertData);

    } catch (error) {
      console.error('Failed to trigger alert:', error);
    }
  }

  /**
   * Load alert rules from database
   */
  private async loadAlertRules(): Promise<void> {
    try {
      const rules = await prisma.alertRule.findMany({
        where: { enabled: true }
      });

      rules.forEach(rule => {
        this.alertRules.set(rule.id, {
          id: rule.id,
          name: rule.name,
          metric: rule.metric,
          condition: rule.condition as any,
          threshold: rule.threshold,
          duration: rule.duration,
          enabled: rule.enabled,
          channels: rule.channels as any
        });
      });

    } catch (error) {
      console.error('Failed to load alert rules:', error);
    }
  }

  /**
   * Get client IP address
   */
  private getClientIp(request: NextRequest): string {
    const forwarded = request.headers.get('x-forwarded-for');
    const realIp = request.headers.get('x-real-ip');
    
    if (forwarded) {
      return forwarded.split(',')[0].trim();
    }
    if (realIp) {
      return realIp;
    }
    
    return 'unknown';
  }

  /**
   * Calculate CPU percentage
   */
  private calculateCpuPercentage(cpuUsage: NodeJS.CpuUsage): number {
    // This is a simplified calculation
    // In a real implementation, you'd track CPU usage over time
    return ((cpuUsage.user + cpuUsage.system) / 1000000) * 100;
  }

  /**
   * Get disk usage (simplified)
   */
  private async getDiskUsage(): Promise<{ used: number; total: number; percentage: number }> {
    // This would need platform-specific implementation
    // For now, return mock data
    return {
      used: 50 * 1024 * 1024 * 1024, // 50GB
      total: 100 * 1024 * 1024 * 1024, // 100GB
      percentage: 50
    };
  }

  /**
   * Get network I/O metrics
   */
  private async getNetworkIO(): Promise<{ bytesIn: number; bytesOut: number }> {
    try {
      const [bytesIn, bytesOut] = await Promise.all([
        this.redis.get('metrics:network:bytes_in') || '0',
        this.redis.get('metrics:network:bytes_out') || '0'
      ]);

      return {
        bytesIn: parseInt(bytesIn),
        bytesOut: parseInt(bytesOut)
      };

    } catch (error) {
      return { bytesIn: 0, bytesOut: 0 };
    }
  }

  /**
   * Send email alert
   */
  private async sendEmailAlert(alertData: any): Promise<void> {
    // Implement email alert sending
    console.log('Email alert would be sent:', alertData);
  }

  /**
   * Send Slack alert
   */
  private async sendSlackAlert(alertData: any): Promise<void> {
    // Implement Slack alert sending
    console.log('Slack alert would be sent:', alertData);
  }

  /**
   * Send webhook alert
   */
  private async sendWebhookAlert(alertData: any): Promise<void> {
    // Implement webhook alert sending
    console.log('Webhook alert would be sent:', alertData);
  }

  /**
   * Clean up old performance data
   */
  async cleanup(olderThanDays: number = 30): Promise<void> {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - olderThanDays);

      await prisma.performanceMetric.deleteMany({
        where: {
          timestamp: { lt: cutoffDate }
        }
      });

    } catch (error) {
      console.error('Failed to cleanup performance data:', error);
    }
  }
}

// Export singleton instance
export const performanceMonitor = new PerformanceMonitor();