import { prisma } from '../db/prisma';
import fs from 'fs/promises';
import path from 'path';

export interface AuditLogConfig {
  enabled: boolean;
  logLevel: 'basic' | 'detailed' | 'full';
}

export interface SecurityEvent {
  type: string;
  clientIp: string;
  userAgent: string;
  requestId: string;
  userId?: string;
  details: Record<string, any>;
  severity?: 'low' | 'medium' | 'high' | 'critical';
  timestamp?: Date;
}

export interface RequestLog {
  requestId: string;
  method: string;
  url: string;
  clientIp: string;
  userAgent: string;
  userId?: string;
  statusCode: number;
  duration: number;
  success: boolean;
  timestamp?: Date;
}

export interface AuditLogEntry {
  id: string;
  type: 'security_event' | 'request_log' | 'user_action' | 'system_event';
  event: string;
  userId?: string;
  clientIp: string;
  userAgent: string;
  details: Record<string, any>;
  severity: 'low' | 'medium' | 'high' | 'critical';
  timestamp: Date;
}

export class AuditLogger {
  private config: AuditLogConfig;
  private logDir: string;

  constructor(config: AuditLogConfig) {
    this.config = config;
    this.logDir = path.join(process.cwd(), 'logs');
    this.ensureLogDirectory();
  }

  /**
   * Log security event
   */
  async logSecurityEvent(event: SecurityEvent): Promise<void> {
    if (!this.config.enabled) return;

    const logEntry: AuditLogEntry = {
      id: this.generateId(),
      type: 'security_event',
      event: event.type,
      userId: event.userId,
      clientIp: event.clientIp,
      userAgent: event.userAgent,
      details: {
        requestId: event.requestId,
        ...event.details
      },
      severity: event.severity || 'medium',
      timestamp: event.timestamp || new Date()
    };

    await Promise.all([
      this.writeToDatabase(logEntry),
      this.writeToFile(logEntry),
      this.handleCriticalEvent(logEntry)
    ]);
  }

  /**
   * Log request
   */
  async logRequest(request: RequestLog): Promise<void> {
    if (!this.config.enabled || this.config.logLevel === 'basic') return;

    const logEntry: AuditLogEntry = {
      id: this.generateId(),
      type: 'request_log',
      event: 'http_request',
      userId: request.userId,
      clientIp: request.clientIp,
      userAgent: request.userAgent,
      details: {
        requestId: request.requestId,
        method: request.method,
        url: request.url,
        statusCode: request.statusCode,
        duration: request.duration,
        success: request.success
      },
      severity: request.success ? 'low' : 'medium',
      timestamp: request.timestamp || new Date()
    };

    await Promise.all([
      this.writeToDatabase(logEntry),
      this.config.logLevel === 'full' ? this.writeToFile(logEntry) : Promise.resolve()
    ]);
  }

  /**
   * Log user action
   */
  async logUserAction(
    userId: string,
    action: string,
    details: Record<string, any>,
    clientIp: string,
    userAgent: string
  ): Promise<void> {
    if (!this.config.enabled) return;

    const logEntry: AuditLogEntry = {
      id: this.generateId(),
      type: 'user_action',
      event: action,
      userId,
      clientIp,
      userAgent,
      details,
      severity: this.getActionSeverity(action),
      timestamp: new Date()
    };

    await Promise.all([
      this.writeToDatabase(logEntry),
      this.writeToFile(logEntry)
    ]);
  }

  /**
   * Log system event
   */
  async logSystemEvent(
    event: string,
    details: Record<string, any>,
    severity: 'low' | 'medium' | 'high' | 'critical' = 'medium'
  ): Promise<void> {
    if (!this.config.enabled) return;

    const logEntry: AuditLogEntry = {
      id: this.generateId(),
      type: 'system_event',
      event,
      clientIp: 'system',
      userAgent: 'system',
      details,
      severity,
      timestamp: new Date()
    };

    await Promise.all([
      this.writeToDatabase(logEntry),
      this.writeToFile(logEntry),
      this.handleCriticalEvent(logEntry)
    ]);
  }

  /**
   * Log authentication event
   */
  async logAuthEvent(
    type: 'login' | 'logout' | 'register' | 'password_reset' | 'mfa_enabled' | 'mfa_disabled',
    userId: string,
    clientIp: string,
    userAgent: string,
    success: boolean,
    details?: Record<string, any>
  ): Promise<void> {
    const logEntry: AuditLogEntry = {
      id: this.generateId(),
      type: 'user_action',
      event: `auth_${type}`,
      userId,
      clientIp,
      userAgent,
      details: {
        success,
        ...details
      },
      severity: success ? 'low' : 'medium',
      timestamp: new Date()
    };

    await Promise.all([
      this.writeToDatabase(logEntry),
      this.writeToFile(logEntry)
    ]);
  }

  /**
   * Log financial transaction
   */
  async logFinancialTransaction(
    userId: string,
    transactionType: string,
    amount: number,
    clientIp: string,
    userAgent: string,
    details: Record<string, any>
  ): Promise<void> {
    const logEntry: AuditLogEntry = {
      id: this.generateId(),
      type: 'user_action',
      event: `financial_${transactionType}`,
      userId,
      clientIp,
      userAgent,
      details: {
        amount,
        ...details
      },
      severity: 'high', // Financial transactions are always high severity
      timestamp: new Date()
    };

    await Promise.all([
      this.writeToDatabase(logEntry),
      this.writeToFile(logEntry)
    ]);
  }

  /**
   * Get audit logs with filtering
   */
  async getAuditLogs(filters: {
    type?: string;
    event?: string;
    userId?: string;
    clientIp?: string;
    severity?: string;
    startDate?: Date;
    endDate?: Date;
    limit?: number;
    offset?: number;
  }): Promise<{ logs: AuditLogEntry[]; total: number }> {
    try {
      const where: any = {};

      if (filters.type) where.type = filters.type;
      if (filters.event) where.event = filters.event;
      if (filters.userId) where.userId = filters.userId;
      if (filters.clientIp) where.clientIp = filters.clientIp;
      if (filters.severity) where.severity = filters.severity;
      
      if (filters.startDate || filters.endDate) {
        where.timestamp = {};
        if (filters.startDate) where.timestamp.gte = filters.startDate;
        if (filters.endDate) where.timestamp.lte = filters.endDate;
      }

      const [logs, total] = await Promise.all([
        prisma.auditLog.findMany({
          where,
          orderBy: { timestamp: 'desc' },
          take: filters.limit || 100,
          skip: filters.offset || 0
        }),
        prisma.auditLog.count({ where })
      ]);

      return { logs: logs as AuditLogEntry[], total };

    } catch (error) {
      console.error('Failed to get audit logs:', error);
      return { logs: [], total: 0 };
    }
  }

  /**
   * Get security statistics
   */
  async getSecurityStats(timeRange: number = 24 * 60 * 60 * 1000): Promise<{
    totalEvents: number;
    eventsByType: Record<string, number>;
    eventsBySeverity: Record<string, number>;
    topIps: Array<{ ip: string; events: number }>;
    recentCriticalEvents: AuditLogEntry[];
  }> {
    try {
      const startDate = new Date(Date.now() - timeRange);

      const [
        totalEvents,
        eventsByType,
        eventsBySeverity,
        topIps,
        recentCriticalEvents
      ] = await Promise.all([
        prisma.auditLog.count({
          where: { timestamp: { gte: startDate } }
        }),
        prisma.auditLog.groupBy({
          by: ['type'],
          where: { timestamp: { gte: startDate } },
          _count: true
        }),
        prisma.auditLog.groupBy({
          by: ['severity'],
          where: { timestamp: { gte: startDate } },
          _count: true
        }),
        prisma.auditLog.groupBy({
          by: ['clientIp'],
          where: { 
            timestamp: { gte: startDate },
            clientIp: { not: 'system' }
          },
          _count: true,
          orderBy: { _count: { clientIp: 'desc' } },
          take: 10
        }),
        prisma.auditLog.findMany({
          where: {
            severity: 'critical',
            timestamp: { gte: startDate }
          },
          orderBy: { timestamp: 'desc' },
          take: 10
        })
      ]);

      return {
        totalEvents,
        eventsByType: eventsByType.reduce((acc, item) => {
          acc[item.type] = item._count;
          return acc;
        }, {} as Record<string, number>),
        eventsBySeverity: eventsBySeverity.reduce((acc, item) => {
          acc[item.severity] = item._count;
          return acc;
        }, {} as Record<string, number>),
        topIps: topIps.map(item => ({
          ip: item.clientIp,
          events: item._count
        })),
        recentCriticalEvents: recentCriticalEvents as AuditLogEntry[]
      };

    } catch (error) {
      console.error('Failed to get security stats:', error);
      return {
        totalEvents: 0,
        eventsByType: {},
        eventsBySeverity: {},
        topIps: [],
        recentCriticalEvents: []
      };
    }
  }

  /**
   * Export audit logs
   */
  async exportLogs(
    format: 'json' | 'csv',
    filters: any = {},
    limit: number = 10000
  ): Promise<string> {
    try {
      const { logs } = await this.getAuditLogs({ ...filters, limit });

      if (format === 'csv') {
        return this.convertToCSV(logs);
      } else {
        return JSON.stringify(logs, null, 2);
      }

    } catch (error) {
      console.error('Failed to export logs:', error);
      throw error;
    }
  }

  /**
   * Clean up old logs
   */
  async cleanupOldLogs(olderThanDays: number = 90): Promise<void> {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - olderThanDays);

      const deletedCount = await prisma.auditLog.deleteMany({
        where: {
          timestamp: { lt: cutoffDate },
          severity: { not: 'critical' } // Keep critical events longer
        }
      });

      await this.logSystemEvent('audit_cleanup', {
        deletedCount: deletedCount.count,
        cutoffDate: cutoffDate.toISOString()
      });

    } catch (error) {
      console.error('Failed to cleanup old logs:', error);
    }
  }

  /**
   * Write to database
   */
  private async writeToDatabase(logEntry: AuditLogEntry): Promise<void> {
    try {
      await prisma.auditLog.create({
        data: {
          id: logEntry.id,
          type: logEntry.type,
          event: logEntry.event,
          userId: logEntry.userId,
          clientIp: logEntry.clientIp,
          userAgent: logEntry.userAgent,
          details: logEntry.details,
          severity: logEntry.severity,
          timestamp: logEntry.timestamp
        }
      });
    } catch (error) {
      console.error('Failed to write audit log to database:', error);
      // Fallback to file logging
      await this.writeToFile(logEntry);
    }
  }

  /**
   * Write to file
   */
  private async writeToFile(logEntry: AuditLogEntry): Promise<void> {
    try {
      const date = logEntry.timestamp.toISOString().split('T')[0];
      const filename = `audit-${date}.log`;
      const filepath = path.join(this.logDir, filename);
      
      const logLine = JSON.stringify(logEntry) + '\n';
      await fs.appendFile(filepath, logLine);

    } catch (error) {
      console.error('Failed to write audit log to file:', error);
    }
  }

  /**
   * Handle critical events
   */
  private async handleCriticalEvent(logEntry: AuditLogEntry): Promise<void> {
    if (logEntry.severity !== 'critical') return;

    try {
      // Send immediate alert (implement your alerting mechanism)
      console.error('CRITICAL SECURITY EVENT:', logEntry);
      
      // You could integrate with services like:
      // - Slack/Discord webhooks
      // - Email alerts
      // - PagerDuty
      // - SMS alerts
      
    } catch (error) {
      console.error('Failed to handle critical event:', error);
    }
  }

  /**
   * Ensure log directory exists
   */
  private async ensureLogDirectory(): Promise<void> {
    try {
      await fs.mkdir(this.logDir, { recursive: true });
    } catch (error) {
      console.error('Failed to create log directory:', error);
    }
  }

  /**
   * Generate unique ID
   */
  private generateId(): string {
    return `audit_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Get action severity
   */
  private getActionSeverity(action: string): 'low' | 'medium' | 'high' | 'critical' {
    const highSeverityActions = [
      'password_change', 'email_change', 'mfa_disable',
      'account_delete', 'admin_action'
    ];

    const criticalSeverityActions = [
      'financial_withdrawal', 'financial_transfer',
      'security_settings_change', 'api_key_create'
    ];

    if (criticalSeverityActions.includes(action)) return 'critical';
    if (highSeverityActions.includes(action)) return 'high';
    if (action.startsWith('financial_')) return 'high';
    if (action.startsWith('auth_')) return 'medium';
    
    return 'low';
  }

  /**
   * Convert logs to CSV format
   */
  private convertToCSV(logs: AuditLogEntry[]): string {
    if (logs.length === 0) return '';

    const headers = ['id', 'type', 'event', 'userId', 'clientIp', 'userAgent', 'severity', 'timestamp', 'details'];
    const csvLines = [headers.join(',')];

    logs.forEach(log => {
      const row = [
        log.id,
        log.type,
        log.event,
        log.userId || '',
        log.clientIp,
        `"${log.userAgent.replace(/"/g, '""')}"`,
        log.severity,
        log.timestamp.toISOString(),
        `"${JSON.stringify(log.details).replace(/"/g, '""')}"`
      ];
      csvLines.push(row.join(','));
    });

    return csvLines.join('\n');
  }
}