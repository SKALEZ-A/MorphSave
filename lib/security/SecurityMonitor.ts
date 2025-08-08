import Redis from 'ioredis';
import { AuditLogger } from './AuditLogger';

export interface SecurityMonitorConfig {
  enabled: boolean;
  alertThreshold: number;
}

export interface SecurityIncident {
  type: string;
  clientIp: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  details: string;
  timestamp?: Date;
}

export interface RequestMetrics {
  clientIp: string;
  statusCode: number;
  duration: number;
  endpoint: string;
  timestamp?: Date;
}

export interface SecurityAlert {
  id: string;
  type: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  message: string;
  details: Record<string, any>;
  timestamp: Date;
  resolved: boolean;
}

export class SecurityMonitor {
  private redis: Redis;
  private config: SecurityMonitorConfig;
  private auditLogger: AuditLogger;

  constructor(config: SecurityMonitorConfig) {
    this.config = config;
    this.redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');
    this.auditLogger = new AuditLogger({ enabled: true, logLevel: 'detailed' });
  }

  /**
   * Record request metrics
   */
  async recordRequest(metrics: RequestMetrics): Promise<void> {
    if (!this.config.enabled) return;

    try {
      const timestamp = Date.now();
      const key = `metrics:${metrics.clientIp}:${Math.floor(timestamp / 60000)}`; // 1-minute buckets

      // Store request metrics
      await this.redis.pipeline()
        .hincrby(key, 'total_requests', 1)
        .hincrby(key, `status_${metrics.statusCode}`, 1)
        .hincrby(key, 'total_duration', metrics.duration)
        .expire(key, 3600) // Keep for 1 hour
        .exec();

      // Check for anomalies
      await this.checkRequestAnomalies(metrics);

    } catch (error) {
      console.error('Failed to record request metrics:', error);
    }
  }

  /**
   * Record security incident
   */
  async recordIncident(incident: SecurityIncident): Promise<void> {
    if (!this.config.enabled) return;

    try {
      const timestamp = incident.timestamp || new Date();
      const incidentKey = `incident:${incident.clientIp}:${timestamp.getTime()}`;

      // Store incident
      await this.redis.setex(
        incidentKey,
        86400, // Keep for 24 hours
        JSON.stringify({
          type: incident.type,
          severity: incident.severity,
          details: incident.details,
          timestamp: timestamp.toISOString()
        })
      );

      // Update incident counters
      const counterKey = `incident_count:${incident.clientIp}`;
      const count = await this.redis.incr(counterKey);
      await this.redis.expire(counterKey, 3600); // 1 hour window

      // Check if we need to create an alert
      if (count >= this.config.alertThreshold) {
        await this.createAlert({
          type: 'multiple_incidents',
          severity: 'high',
          message: `Multiple security incidents from IP ${incident.clientIp}`,
          details: {
            clientIp: incident.clientIp,
            incidentCount: count,
            latestIncident: incident
          }
        });
      }

      // Log the incident
      await this.auditLogger.logSecurityEvent({
        type: 'security_incident',
        clientIp: incident.clientIp,
        userAgent: 'monitor',
        requestId: `monitor_${timestamp.getTime()}`,
        details: {
          incidentType: incident.type,
          incidentDetails: incident.details
        },
        severity: incident.severity,
        timestamp
      });

    } catch (error) {
      console.error('Failed to record security incident:', error);
    }
  }

  /**
   * Get request count for IP in time window
   */
  async getRequestCount(clientIp: string, windowMs: number): Promise<number> {
    try {
      const now = Date.now();
      const windowStart = Math.floor((now - windowMs) / 60000);
      const windowEnd = Math.floor(now / 60000);

      let totalRequests = 0;

      for (let minute = windowStart; minute <= windowEnd; minute++) {
        const key = `metrics:${clientIp}:${minute}`;
        const requests = await this.redis.hget(key, 'total_requests');
        totalRequests += parseInt(requests || '0');
      }

      return totalRequests;

    } catch (error) {
      console.error('Failed to get request count:', error);
      return 0;
    }
  }

  /**
   * Get security metrics
   */
  async getSecurityMetrics(timeRange: number = 3600000): Promise<{
    totalRequests: number;
    errorRate: number;
    averageResponseTime: number;
    topIps: Array<{ ip: string; requests: number; errors: number }>;
    recentIncidents: Array<{ type: string; count: number }>;
    activeAlerts: SecurityAlert[];
  }> {
    try {
      const now = Date.now();
      const windowStart = Math.floor((now - timeRange) / 60000);
      const windowEnd = Math.floor(now / 60000);

      // Get all metric keys in the time range
      const keys = [];
      for (let minute = windowStart; minute <= windowEnd; minute++) {
        const pattern = `metrics:*:${minute}`;
        const minuteKeys = await this.redis.keys(pattern);
        keys.push(...minuteKeys);
      }

      // Aggregate metrics
      let totalRequests = 0;
      let totalErrors = 0;
      let totalDuration = 0;
      const ipMetrics: Record<string, { requests: number; errors: number }> = {};

      for (const key of keys) {
        const metrics = await this.redis.hgetall(key);
        const ip = key.split(':')[1];

        const requests = parseInt(metrics.total_requests || '0');
        const duration = parseInt(metrics.total_duration || '0');
        
        totalRequests += requests;
        totalDuration += duration;

        // Count errors (4xx and 5xx status codes)
        let errors = 0;
        Object.keys(metrics).forEach(field => {
          if (field.startsWith('status_') && (field.startsWith('status_4') || field.startsWith('status_5'))) {
            errors += parseInt(metrics[field] || '0');
          }
        });

        totalErrors += errors;

        if (!ipMetrics[ip]) {
          ipMetrics[ip] = { requests: 0, errors: 0 };
        }
        ipMetrics[ip].requests += requests;
        ipMetrics[ip].errors += errors;
      }

      // Get top IPs
      const topIps = Object.entries(ipMetrics)
        .sort(([, a], [, b]) => b.requests - a.requests)
        .slice(0, 10)
        .map(([ip, metrics]) => ({ ip, ...metrics }));

      // Get recent incidents
      const incidentKeys = await this.redis.keys('incident:*');
      const recentIncidents: Record<string, number> = {};

      for (const key of incidentKeys.slice(-100)) { // Last 100 incidents
        const incidentData = await this.redis.get(key);
        if (incidentData) {
          const incident = JSON.parse(incidentData);
          recentIncidents[incident.type] = (recentIncidents[incident.type] || 0) + 1;
        }
      }

      // Get active alerts
      const activeAlerts = await this.getActiveAlerts();

      return {
        totalRequests,
        errorRate: totalRequests > 0 ? (totalErrors / totalRequests) * 100 : 0,
        averageResponseTime: totalRequests > 0 ? totalDuration / totalRequests : 0,
        topIps,
        recentIncidents: Object.entries(recentIncidents).map(([type, count]) => ({ type, count })),
        activeAlerts
      };

    } catch (error) {
      console.error('Failed to get security metrics:', error);
      return {
        totalRequests: 0,
        errorRate: 0,
        averageResponseTime: 0,
        topIps: [],
        recentIncidents: [],
        activeAlerts: []
      };
    }
  }

  /**
   * Create security alert
   */
  async createAlert(alertData: Omit<SecurityAlert, 'id' | 'timestamp' | 'resolved'>): Promise<void> {
    try {
      const alert: SecurityAlert = {
        id: `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        timestamp: new Date(),
        resolved: false,
        ...alertData
      };

      // Store alert
      await this.redis.setex(
        `alert:${alert.id}`,
        86400 * 7, // Keep for 7 days
        JSON.stringify(alert)
      );

      // Add to active alerts list
      await this.redis.zadd('active_alerts', Date.now(), alert.id);

      // Log the alert
      await this.auditLogger.logSystemEvent(
        'security_alert_created',
        {
          alertId: alert.id,
          alertType: alert.type,
          severity: alert.severity,
          message: alert.message
        },
        alert.severity
      );

      // Send notification if critical
      if (alert.severity === 'critical') {
        await this.sendCriticalAlert(alert);
      }

    } catch (error) {
      console.error('Failed to create security alert:', error);
    }
  }

  /**
   * Resolve security alert
   */
  async resolveAlert(alertId: string, resolvedBy: string): Promise<void> {
    try {
      const alertData = await this.redis.get(`alert:${alertId}`);
      if (!alertData) return;

      const alert: SecurityAlert = JSON.parse(alertData);
      alert.resolved = true;

      // Update alert
      await this.redis.setex(`alert:${alertId}`, 86400 * 7, JSON.stringify(alert));

      // Remove from active alerts
      await this.redis.zrem('active_alerts', alertId);

      // Log resolution
      await this.auditLogger.logSystemEvent(
        'security_alert_resolved',
        {
          alertId,
          resolvedBy,
          alertType: alert.type
        },
        'low'
      );

    } catch (error) {
      console.error('Failed to resolve security alert:', error);
    }
  }

  /**
   * Get active alerts
   */
  async getActiveAlerts(): Promise<SecurityAlert[]> {
    try {
      const alertIds = await this.redis.zrevrange('active_alerts', 0, -1);
      const alerts: SecurityAlert[] = [];

      for (const alertId of alertIds) {
        const alertData = await this.redis.get(`alert:${alertId}`);
        if (alertData) {
          const alert = JSON.parse(alertData);
          if (!alert.resolved) {
            alerts.push(alert);
          }
        }
      }

      return alerts;

    } catch (error) {
      console.error('Failed to get active alerts:', error);
      return [];
    }
  }

  /**
   * Check for request anomalies
   */
  private async checkRequestAnomalies(metrics: RequestMetrics): Promise<void> {
    try {
      // Check for high error rates
      const errorRate = await this.getErrorRate(metrics.clientIp, 300000); // 5 minutes
      if (errorRate > 50) { // More than 50% errors
        await this.recordIncident({
          type: 'high_error_rate',
          clientIp: metrics.clientIp,
          severity: 'medium',
          details: `Error rate: ${errorRate.toFixed(2)}%`
        });
      }

      // Check for slow responses
      if (metrics.duration > 10000) { // More than 10 seconds
        await this.recordIncident({
          type: 'slow_response',
          clientIp: metrics.clientIp,
          severity: 'low',
          details: `Response time: ${metrics.duration}ms`
        });
      }

      // Check for suspicious endpoints
      if (this.isSuspiciousEndpoint(metrics.endpoint)) {
        await this.recordIncident({
          type: 'suspicious_endpoint_access',
          clientIp: metrics.clientIp,
          severity: 'medium',
          details: `Endpoint: ${metrics.endpoint}`
        });
      }

    } catch (error) {
      console.error('Failed to check request anomalies:', error);
    }
  }

  /**
   * Get error rate for IP
   */
  private async getErrorRate(clientIp: string, windowMs: number): Promise<number> {
    try {
      const now = Date.now();
      const windowStart = Math.floor((now - windowMs) / 60000);
      const windowEnd = Math.floor(now / 60000);

      let totalRequests = 0;
      let totalErrors = 0;

      for (let minute = windowStart; minute <= windowEnd; minute++) {
        const key = `metrics:${clientIp}:${minute}`;
        const metrics = await this.redis.hgetall(key);

        totalRequests += parseInt(metrics.total_requests || '0');

        // Count errors
        Object.keys(metrics).forEach(field => {
          if (field.startsWith('status_') && (field.startsWith('status_4') || field.startsWith('status_5'))) {
            totalErrors += parseInt(metrics[field] || '0');
          }
        });
      }

      return totalRequests > 0 ? (totalErrors / totalRequests) * 100 : 0;

    } catch (error) {
      console.error('Failed to get error rate:', error);
      return 0;
    }
  }

  /**
   * Check if endpoint is suspicious
   */
  private isSuspiciousEndpoint(endpoint: string): boolean {
    const suspiciousPatterns = [
      /\/admin/i,
      /\/wp-admin/i,
      /\/phpmyadmin/i,
      /\.php$/i,
      /\.asp$/i,
      /\.jsp$/i,
      /\/config/i,
      /\/backup/i,
      /\/test/i,
      /\/debug/i
    ];

    return suspiciousPatterns.some(pattern => pattern.test(endpoint));
  }

  /**
   * Send critical alert
   */
  private async sendCriticalAlert(alert: SecurityAlert): Promise<void> {
    try {
      // Implement your critical alert mechanism here
      // Examples:
      // - Send email to security team
      // - Send Slack/Discord webhook
      // - Trigger PagerDuty incident
      // - Send SMS alert

      console.error('CRITICAL SECURITY ALERT:', {
        id: alert.id,
        type: alert.type,
        message: alert.message,
        details: alert.details,
        timestamp: alert.timestamp
      });

      // You could integrate with external services here
      // await this.sendSlackAlert(alert);
      // await this.sendEmailAlert(alert);

    } catch (error) {
      console.error('Failed to send critical alert:', error);
    }
  }

  /**
   * Cleanup old data
   */
  async cleanup(): Promise<void> {
    try {
      // Clean up old metrics (older than 24 hours)
      const cutoff = Math.floor((Date.now() - 86400000) / 60000);
      const oldKeys = await this.redis.keys(`metrics:*:${cutoff - 1440}`); // 24 hours ago

      if (oldKeys.length > 0) {
        await this.redis.del(...oldKeys);
      }

      // Clean up old incidents (older than 7 days)
      const oldIncidentKeys = await this.redis.keys('incident:*');
      for (const key of oldIncidentKeys) {
        const ttl = await this.redis.ttl(key);
        if (ttl === -1) { // No expiration set
          await this.redis.expire(key, 86400); // Set 24 hour expiration
        }
      }

      // Clean up resolved alerts older than 7 days
      const oldAlertIds = await this.redis.zrangebyscore(
        'active_alerts',
        0,
        Date.now() - (86400000 * 7)
      );

      for (const alertId of oldAlertIds) {
        await this.redis.del(`alert:${alertId}`);
        await this.redis.zrem('active_alerts', alertId);
      }

    } catch (error) {
      console.error('Failed to cleanup security monitor data:', error);
    }
  }
}