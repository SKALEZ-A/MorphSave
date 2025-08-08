import { prisma } from '../db/prisma';
import { analyticsService } from '../analytics/AnalyticsService';

export interface ErrorReport {
  id: string;
  name: string;
  message: string;
  stack?: string;
  url?: string;
  lineNumber?: number;
  columnNumber?: number;
  userId?: string;
  sessionId?: string;
  userAgent?: string;
  clientIp?: string;
  timestamp: Date;
  severity: 'low' | 'medium' | 'high' | 'critical';
  tags: string[];
  context: Record<string, any>;
  fingerprint: string;
  resolved: boolean;
  occurrences: number;
}

export interface ErrorStats {
  totalErrors: number;
  uniqueErrors: number;
  errorRate: number;
  topErrors: Array<{
    fingerprint: string;
    name: string;
    message: string;
    occurrences: number;
    lastSeen: Date;
  }>;
  errorsByType: Record<string, number>;
  errorsByPage: Record<string, number>;
  errorTrends: Array<{
    date: Date;
    count: number;
  }>;
}

export class ErrorTracker {
  /**
   * Track a JavaScript error
   */
  async trackError(
    error: Error,
    context: {
      userId?: string;
      sessionId?: string;
      url?: string;
      userAgent?: string;
      clientIp?: string;
      additionalContext?: Record<string, any>;
    }
  ): Promise<string> {
    try {
      const fingerprint = this.generateFingerprint(error, context.url);
      const severity = this.determineSeverity(error);
      const tags = this.extractTags(error, context);

      const errorReport: Omit<ErrorReport, 'id' | 'occurrences' | 'resolved'> = {
        name: error.name,
        message: error.message,
        stack: error.stack,
        url: context.url,
        lineNumber: this.extractLineNumber(error.stack),
        columnNumber: this.extractColumnNumber(error.stack),
        userId: context.userId,
        sessionId: context.sessionId,
        userAgent: context.userAgent,
        clientIp: context.clientIp,
        timestamp: new Date(),
        severity,
        tags,
        context: context.additionalContext || {},
        fingerprint
      };

      // Check if this error already exists
      const existingError = await prisma.errorReport.findUnique({
        where: { fingerprint }
      });

      let errorId: string;

      if (existingError) {
        // Update existing error
        await prisma.errorReport.update({
          where: { fingerprint },
          data: {
            occurrences: { increment: 1 },
            timestamp: errorReport.timestamp, // Update last seen
            resolved: false // Mark as unresolved if it occurs again
          }
        });
        errorId = existingError.id;
      } else {
        // Create new error report
        const newError = await prisma.errorReport.create({
          data: {
            id: `error_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            ...errorReport,
            occurrences: 1,
            resolved: false
          }
        });
        errorId = newError.id;
      }

      // Track in analytics
      await analyticsService.trackError(error, context.userId, context.sessionId, {
        errorId,
        fingerprint,
        severity,
        url: context.url
      });

      // Send alerts for critical errors
      if (severity === 'critical') {
        await this.sendCriticalErrorAlert(errorReport, errorId);
      }

      return errorId;

    } catch (trackingError) {
      console.error('Failed to track error:', trackingError);
      return 'tracking_failed';
    }
  }

  /**
   * Track API error
   */
  async trackApiError(
    error: Error,
    request: {
      method: string;
      url: string;
      headers: Record<string, string>;
      body?: any;
    },
    response: {
      statusCode: number;
      headers: Record<string, string>;
    },
    context: {
      userId?: string;
      duration: number;
      clientIp?: string;
    }
  ): Promise<string> {
    const apiContext = {
      request: {
        method: request.method,
        url: request.url,
        headers: this.sanitizeHeaders(request.headers),
        body: this.sanitizeBody(request.body)
      },
      response: {
        statusCode: response.statusCode,
        headers: this.sanitizeHeaders(response.headers)
      },
      duration: context.duration
    };

    return this.trackError(error, {
      userId: context.userId,
      sessionId: `api_${Date.now()}`,
      url: request.url,
      userAgent: request.headers['user-agent'],
      clientIp: context.clientIp,
      additionalContext: apiContext
    });
  }

  /**
   * Get error statistics
   */
  async getErrorStats(timeRange: number = 86400000): Promise<ErrorStats> {
    try {
      const startDate = new Date(Date.now() - timeRange);

      const [
        totalErrors,
        uniqueErrors,
        topErrors,
        errorsByType,
        errorsByPage,
        errorTrends
      ] = await Promise.all([
        prisma.errorReport.aggregate({
          where: { timestamp: { gte: startDate } },
          _sum: { occurrences: true }
        }),
        prisma.errorReport.count({
          where: { timestamp: { gte: startDate } }
        }),
        prisma.errorReport.findMany({
          where: { timestamp: { gte: startDate } },
          orderBy: { occurrences: 'desc' },
          take: 10,
          select: {
            fingerprint: true,
            name: true,
            message: true,
            occurrences: true,
            timestamp: true
          }
        }),
        this.getErrorsByType(startDate),
        this.getErrorsByPage(startDate),
        this.getErrorTrends(startDate, timeRange)
      ]);

      // Calculate error rate (errors per total requests)
      const totalRequests = await this.getTotalRequests(startDate);
      const errorRate = totalRequests > 0 ? (totalErrors._sum.occurrences || 0) / totalRequests * 100 : 0;

      return {
        totalErrors: totalErrors._sum.occurrences || 0,
        uniqueErrors,
        errorRate,
        topErrors: topErrors.map(error => ({
          fingerprint: error.fingerprint,
          name: error.name,
          message: error.message,
          occurrences: error.occurrences,
          lastSeen: error.timestamp
        })),
        errorsByType,
        errorsByPage,
        errorTrends
      };

    } catch (error) {
      console.error('Failed to get error stats:', error);
      return {
        totalErrors: 0,
        uniqueErrors: 0,
        errorRate: 0,
        topErrors: [],
        errorsByType: {},
        errorsByPage: {},
        errorTrends: []
      };
    }
  }

  /**
   * Get error details
   */
  async getErrorDetails(fingerprint: string): Promise<ErrorReport | null> {
    try {
      const error = await prisma.errorReport.findUnique({
        where: { fingerprint }
      });

      if (!error) return null;

      return {
        id: error.id,
        name: error.name,
        message: error.message,
        stack: error.stack,
        url: error.url,
        lineNumber: error.lineNumber,
        columnNumber: error.columnNumber,
        userId: error.userId,
        sessionId: error.sessionId,
        userAgent: error.userAgent,
        clientIp: error.clientIp,
        timestamp: error.timestamp,
        severity: error.severity as any,
        tags: error.tags,
        context: error.context as any,
        fingerprint: error.fingerprint,
        resolved: error.resolved,
        occurrences: error.occurrences
      };

    } catch (error) {
      console.error('Failed to get error details:', error);
      return null;
    }
  }

  /**
   * Resolve error
   */
  async resolveError(fingerprint: string, resolvedBy: string): Promise<void> {
    try {
      await prisma.errorReport.update({
        where: { fingerprint },
        data: {
          resolved: true,
          resolvedAt: new Date(),
          resolvedBy
        }
      });

    } catch (error) {
      console.error('Failed to resolve error:', error);
    }
  }

  /**
   * Get error occurrences
   */
  async getErrorOccurrences(
    fingerprint: string,
    limit: number = 50
  ): Promise<Array<{
    timestamp: Date;
    userId?: string;
    url?: string;
    userAgent?: string;
    context: Record<string, any>;
  }>> {
    try {
      // In a full implementation, you'd store individual occurrences
      // For now, return the main error record
      const error = await prisma.errorReport.findUnique({
        where: { fingerprint }
      });

      if (!error) return [];

      return [{
        timestamp: error.timestamp,
        userId: error.userId,
        url: error.url,
        userAgent: error.userAgent,
        context: error.context as any
      }];

    } catch (error) {
      console.error('Failed to get error occurrences:', error);
      return [];
    }
  }

  /**
   * Search errors
   */
  async searchErrors(
    query: string,
    filters: {
      severity?: string;
      resolved?: boolean;
      timeRange?: number;
    } = {}
  ): Promise<ErrorReport[]> {
    try {
      const where: any = {};

      if (query) {
        where.OR = [
          { name: { contains: query, mode: 'insensitive' } },
          { message: { contains: query, mode: 'insensitive' } },
          { url: { contains: query, mode: 'insensitive' } }
        ];
      }

      if (filters.severity) {
        where.severity = filters.severity;
      }

      if (filters.resolved !== undefined) {
        where.resolved = filters.resolved;
      }

      if (filters.timeRange) {
        where.timestamp = {
          gte: new Date(Date.now() - filters.timeRange)
        };
      }

      const errors = await prisma.errorReport.findMany({
        where,
        orderBy: { timestamp: 'desc' },
        take: 100
      });

      return errors.map(error => ({
        id: error.id,
        name: error.name,
        message: error.message,
        stack: error.stack,
        url: error.url,
        lineNumber: error.lineNumber,
        columnNumber: error.columnNumber,
        userId: error.userId,
        sessionId: error.sessionId,
        userAgent: error.userAgent,
        clientIp: error.clientIp,
        timestamp: error.timestamp,
        severity: error.severity as any,
        tags: error.tags,
        context: error.context as any,
        fingerprint: error.fingerprint,
        resolved: error.resolved,
        occurrences: error.occurrences
      }));

    } catch (error) {
      console.error('Failed to search errors:', error);
      return [];
    }
  }

  /**
   * Generate error fingerprint for grouping
   */
  private generateFingerprint(error: Error, url?: string): string {
    const components = [
      error.name,
      error.message.replace(/\d+/g, 'N'), // Replace numbers with N
      url ? new URL(url).pathname : '',
      this.extractLineNumber(error.stack)?.toString() || ''
    ];

    const fingerprint = components.join('|');
    return Buffer.from(fingerprint).toString('base64').slice(0, 32);
  }

  /**
   * Determine error severity
   */
  private determineSeverity(error: Error): 'low' | 'medium' | 'high' | 'critical' {
    const criticalErrors = [
      'SecurityError',
      'ReferenceError',
      'TypeError'
    ];

    const highErrors = [
      'NetworkError',
      'TimeoutError',
      'AuthenticationError'
    ];

    const mediumErrors = [
      'ValidationError',
      'NotFoundError'
    ];

    if (criticalErrors.includes(error.name)) return 'critical';
    if (highErrors.includes(error.name)) return 'high';
    if (mediumErrors.includes(error.name)) return 'medium';

    // Check error message for severity indicators
    const message = error.message.toLowerCase();
    if (message.includes('critical') || message.includes('fatal')) return 'critical';
    if (message.includes('security') || message.includes('unauthorized')) return 'high';
    if (message.includes('warning') || message.includes('deprecated')) return 'low';

    return 'medium';
  }

  /**
   * Extract tags from error and context
   */
  private extractTags(error: Error, context: any): string[] {
    const tags = [error.name];

    if (context.url) {
      const url = new URL(context.url);
      tags.push(`page:${url.pathname}`);
    }

    if (context.userAgent) {
      const browser = this.extractBrowser(context.userAgent);
      if (browser) tags.push(`browser:${browser}`);
    }

    return tags;
  }

  /**
   * Extract line number from stack trace
   */
  private extractLineNumber(stack?: string): number | undefined {
    if (!stack) return undefined;

    const match = stack.match(/:(\d+):\d+/);
    return match ? parseInt(match[1]) : undefined;
  }

  /**
   * Extract column number from stack trace
   */
  private extractColumnNumber(stack?: string): number | undefined {
    if (!stack) return undefined;

    const match = stack.match(/:(\d+):(\d+)/);
    return match ? parseInt(match[2]) : undefined;
  }

  /**
   * Extract browser from user agent
   */
  private extractBrowser(userAgent: string): string | undefined {
    if (userAgent.includes('Chrome')) return 'Chrome';
    if (userAgent.includes('Firefox')) return 'Firefox';
    if (userAgent.includes('Safari')) return 'Safari';
    if (userAgent.includes('Edge')) return 'Edge';
    return undefined;
  }

  /**
   * Sanitize headers for storage
   */
  private sanitizeHeaders(headers: Record<string, string>): Record<string, string> {
    const sanitized = { ...headers };
    
    // Remove sensitive headers
    delete sanitized.authorization;
    delete sanitized.cookie;
    delete sanitized['x-api-key'];
    
    return sanitized;
  }

  /**
   * Sanitize request body for storage
   */
  private sanitizeBody(body: any): any {
    if (!body) return body;

    const sanitized = { ...body };
    
    // Remove sensitive fields
    delete sanitized.password;
    delete sanitized.token;
    delete sanitized.apiKey;
    delete sanitized.secret;
    
    return sanitized;
  }

  /**
   * Get errors by type
   */
  private async getErrorsByType(startDate: Date): Promise<Record<string, number>> {
    const errors = await prisma.errorReport.groupBy({
      by: ['name'],
      where: { timestamp: { gte: startDate } },
      _sum: { occurrences: true }
    });

    const result: Record<string, number> = {};
    errors.forEach(error => {
      result[error.name] = error._sum.occurrences || 0;
    });

    return result;
  }

  /**
   * Get errors by page
   */
  private async getErrorsByPage(startDate: Date): Promise<Record<string, number>> {
    const errors = await prisma.errorReport.findMany({
      where: { 
        timestamp: { gte: startDate },
        url: { not: null }
      },
      select: { url: true, occurrences: true }
    });

    const result: Record<string, number> = {};
    errors.forEach(error => {
      if (error.url) {
        const path = new URL(error.url).pathname;
        result[path] = (result[path] || 0) + error.occurrences;
      }
    });

    return result;
  }

  /**
   * Get error trends over time
   */
  private async getErrorTrends(startDate: Date, timeRange: number): Promise<Array<{ date: Date; count: number }>> {
    const bucketSize = Math.max(3600000, timeRange / 24); // At least 1 hour buckets
    const buckets: Array<{ date: Date; count: number }> = [];

    for (let time = startDate.getTime(); time < Date.now(); time += bucketSize) {
      const bucketStart = new Date(time);
      const bucketEnd = new Date(time + bucketSize);

      const count = await prisma.errorReport.aggregate({
        where: {
          timestamp: {
            gte: bucketStart,
            lt: bucketEnd
          }
        },
        _sum: { occurrences: true }
      });

      buckets.push({
        date: bucketStart,
        count: count._sum.occurrences || 0
      });
    }

    return buckets;
  }

  /**
   * Get total requests for error rate calculation
   */
  private async getTotalRequests(startDate: Date): Promise<number> {
    // This would come from your analytics or performance monitoring
    // For now, return a mock value
    return 10000;
  }

  /**
   * Send critical error alert
   */
  private async sendCriticalErrorAlert(error: any, errorId: string): Promise<void> {
    try {
      console.error('CRITICAL ERROR ALERT:', {
        errorId,
        name: error.name,
        message: error.message,
        url: error.url,
        timestamp: error.timestamp
      });

      // In a real implementation, you'd send alerts via:
      // - Email
      // - Slack
      // - PagerDuty
      // - SMS
      // etc.

    } catch (alertError) {
      console.error('Failed to send critical error alert:', alertError);
    }
  }

  /**
   * Clean up old error data
   */
  async cleanup(olderThanDays: number = 90): Promise<void> {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - olderThanDays);

      // Keep critical errors longer
      await prisma.errorReport.deleteMany({
        where: {
          timestamp: { lt: cutoffDate },
          severity: { not: 'critical' },
          resolved: true
        }
      });

    } catch (error) {
      console.error('Failed to cleanup error data:', error);
    }
  }
}

// Export singleton instance
export const errorTracker = new ErrorTracker();