import winston from 'winston';
import 'winston-daily-rotate-file';

interface LogContext {
  userId?: string;
  requestId?: string;
  sessionId?: string;
  walletAddress?: string;
  transactionHash?: string;
  [key: string]: any;
}

class ProductionLogger {
  private logger: winston.Logger;

  constructor() {
    const logLevel = process.env.LOG_LEVEL || 'info';
    const logFormat = process.env.LOG_FORMAT || 'json';

    // Create formatters
    const jsonFormat = winston.format.combine(
      winston.format.timestamp(),
      winston.format.errors({ stack: true }),
      winston.format.json(),
      winston.format.printf(({ timestamp, level, message, ...meta }) => {
        return JSON.stringify({
          timestamp,
          level,
          message,
          service: 'morphsave',
          environment: process.env.NODE_ENV,
          version: process.env.npm_package_version,
          ...meta
        });
      })
    );

    const textFormat = winston.format.combine(
      winston.format.timestamp(),
      winston.format.errors({ stack: true }),
      winston.format.printf(({ timestamp, level, message, ...meta }) => {
        const metaStr = Object.keys(meta).length ? JSON.stringify(meta) : '';
        return `${timestamp} [${level.toUpperCase()}] ${message} ${metaStr}`;
      })
    );

    // Configure transports
    const transports: winston.transport[] = [
      // Console transport
      new winston.transports.Console({
        format: logFormat === 'json' ? jsonFormat : textFormat,
        level: logLevel
      })
    ];

    // File transport for production
    if (process.env.NODE_ENV === 'production') {
      transports.push(
        new winston.transports.DailyRotateFile({
          filename: process.env.LOG_FILE_PATH || '/var/log/morphsave/app-%DATE%.log',
          datePattern: 'YYYY-MM-DD',
          maxSize: process.env.LOG_MAX_SIZE || '100m',
          maxFiles: process.env.LOG_MAX_FILES || '10',
          format: jsonFormat,
          level: logLevel
        })
      );

      // Error log file
      transports.push(
        new winston.transports.DailyRotateFile({
          filename: '/var/log/morphsave/error-%DATE%.log',
          datePattern: 'YYYY-MM-DD',
          maxSize: '100m',
          maxFiles: '30',
          format: jsonFormat,
          level: 'error'
        })
      );

      // Security log file
      transports.push(
        new winston.transports.DailyRotateFile({
          filename: '/var/log/morphsave/security-%DATE%.log',
          datePattern: 'YYYY-MM-DD',
          maxSize: '100m',
          maxFiles: '90',
          format: jsonFormat,
          level: 'warn'
        })
      );
    }

    // Create logger instance
    this.logger = winston.createLogger({
      level: logLevel,
      transports,
      exitOnError: false,
      // Handle uncaught exceptions and rejections
      exceptionHandlers: [
        new winston.transports.File({ filename: '/var/log/morphsave/exceptions.log' })
      ],
      rejectionHandlers: [
        new winston.transports.File({ filename: '/var/log/morphsave/rejections.log' })
      ]
    });
  }

  // Standard logging methods
  debug(message: string, context?: LogContext) {
    this.logger.debug(message, context);
  }

  info(message: string, context?: LogContext) {
    this.logger.info(message, context);
  }

  warn(message: string, context?: LogContext) {
    this.logger.warn(message, context);
  }

  error(message: string, error?: Error, context?: LogContext) {
    this.logger.error(message, {
      error: error ? {
        name: error.name,
        message: error.message,
        stack: error.stack
      } : undefined,
      ...context
    });
  }

  // Specialized logging methods
  logUserAction(action: string, userId: string, context?: LogContext) {
    this.info(`User action: ${action}`, {
      category: 'user_action',
      userId,
      ...context
    });
  }

  logSecurityEvent(event: string, severity: 'low' | 'medium' | 'high' | 'critical', context?: LogContext) {
    const logMethod = severity === 'critical' ? 'error' : 'warn';
    this.logger[logMethod](`Security event: ${event}`, {
      category: 'security',
      severity,
      ...context
    });
  }

  logBlockchainTransaction(type: string, hash: string, context?: LogContext) {
    this.info(`Blockchain transaction: ${type}`, {
      category: 'blockchain',
      transactionHash: hash,
      ...context
    });
  }

  logAPIRequest(method: string, path: string, statusCode: number, duration: number, context?: LogContext) {
    const level = statusCode >= 500 ? 'error' : statusCode >= 400 ? 'warn' : 'info';
    this.logger[level](`API request: ${method} ${path}`, {
      category: 'api',
      method,
      path,
      statusCode,
      duration,
      ...context
    });
  }

  logDatabaseQuery(query: string, duration: number, context?: LogContext) {
    this.debug(`Database query executed`, {
      category: 'database',
      query: query.substring(0, 200), // Truncate long queries
      duration,
      ...context
    });
  }

  logPerformanceMetric(metric: string, value: number, unit: string, context?: LogContext) {
    this.info(`Performance metric: ${metric}`, {
      category: 'performance',
      metric,
      value,
      unit,
      ...context
    });
  }

  logBusinessEvent(event: string, data: any, context?: LogContext) {
    this.info(`Business event: ${event}`, {
      category: 'business',
      event,
      data,
      ...context
    });
  }

  // Structured logging for different components
  logAuth(event: string, userId?: string, success: boolean = true, context?: LogContext) {
    const level = success ? 'info' : 'warn';
    this.logger[level](`Auth: ${event}`, {
      category: 'auth',
      userId,
      success,
      ...context
    });
  }

  logPayment(event: string, amount: number, currency: string, context?: LogContext) {
    this.info(`Payment: ${event}`, {
      category: 'payment',
      amount,
      currency,
      ...context
    });
  }

  logGamification(event: string, userId: string, points?: number, context?: LogContext) {
    this.info(`Gamification: ${event}`, {
      category: 'gamification',
      userId,
      points,
      ...context
    });
  }

  // Health check logging
  logHealthCheck(component: string, status: 'healthy' | 'unhealthy', details?: any) {
    const level = status === 'healthy' ? 'debug' : 'error';
    this.logger[level](`Health check: ${component}`, {
      category: 'health',
      component,
      status,
      details
    });
  }

  // Create child logger with persistent context
  child(context: LogContext) {
    return {
      debug: (message: string, additionalContext?: LogContext) => 
        this.debug(message, { ...context, ...additionalContext }),
      info: (message: string, additionalContext?: LogContext) => 
        this.info(message, { ...context, ...additionalContext }),
      warn: (message: string, additionalContext?: LogContext) => 
        this.warn(message, { ...context, ...additionalContext }),
      error: (message: string, error?: Error, additionalContext?: LogContext) => 
        this.error(message, error, { ...context, ...additionalContext })
    };
  }
}

// Export singleton instance
export const logger = new ProductionLogger();
export default logger;