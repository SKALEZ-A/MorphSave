import { NextRequest, NextResponse } from 'next/server';
import { logger } from './ProductionLogger';
import { v4 as uuidv4 } from 'uuid';

interface RequestContext {
  requestId: string;
  userId?: string;
  sessionId?: string;
  userAgent?: string;
  ip?: string;
  startTime: number;
}

export class RequestLogger {
  static middleware() {
    return async (request: NextRequest) => {
      const startTime = Date.now();
      const requestId = uuidv4();
      
      // Extract request information
      const method = request.method;
      const url = request.url;
      const userAgent = request.headers.get('user-agent') || 'unknown';
      const ip = request.headers.get('x-forwarded-for') || 
                 request.headers.get('x-real-ip') || 
                 'unknown';
      
      // Create request context
      const context: RequestContext = {
        requestId,
        userAgent,
        ip,
        startTime
      };

      // Log incoming request
      logger.info(`Incoming request: ${method} ${url}`, {
        category: 'request',
        method,
        url,
        userAgent,
        ip,
        requestId
      });

      // Add request ID to headers for tracing
      const response = NextResponse.next();
      response.headers.set('X-Request-ID', requestId);

      return response;
    };
  }

  static logResponse(
    request: NextRequest,
    response: NextResponse,
    context: RequestContext
  ) {
    const duration = Date.now() - context.startTime;
    const statusCode = response.status;
    
    logger.logAPIRequest(
      request.method,
      request.url,
      statusCode,
      duration,
      {
        requestId: context.requestId,
        userAgent: context.userAgent,
        ip: context.ip,
        responseSize: response.headers.get('content-length') || 'unknown'
      }
    );

    // Log slow requests
    if (duration > 5000) {
      logger.warn(`Slow request detected: ${request.method} ${request.url}`, {
        category: 'performance',
        duration,
        requestId: context.requestId
      });
    }

    // Log errors
    if (statusCode >= 500) {
      logger.error(`Server error: ${request.method} ${request.url}`, undefined, {
        statusCode,
        requestId: context.requestId
      });
    } else if (statusCode >= 400) {
      logger.warn(`Client error: ${request.method} ${request.url}`, {
        statusCode,
        requestId: context.requestId
      });
    }
  }

  static createRequestLogger(requestId: string) {
    return logger.child({ requestId });
  }
}

// Express.js middleware for API routes
export function expressRequestLogger(req: any, res: any, next: any) {
  const startTime = Date.now();
  const requestId = uuidv4();
  
  // Add request ID to request object
  req.requestId = requestId;
  req.startTime = startTime;
  
  // Add request ID to response headers
  res.setHeader('X-Request-ID', requestId);
  
  // Log incoming request
  logger.info(`Incoming request: ${req.method} ${req.originalUrl}`, {
    category: 'request',
    method: req.method,
    url: req.originalUrl,
    userAgent: req.get('User-Agent'),
    ip: req.ip || req.connection.remoteAddress,
    requestId
  });

  // Override res.end to log response
  const originalEnd = res.end;
  res.end = function(chunk: any, encoding: any) {
    const duration = Date.now() - startTime;
    
    logger.logAPIRequest(
      req.method,
      req.originalUrl,
      res.statusCode,
      duration,
      {
        requestId,
        userAgent: req.get('User-Agent'),
        ip: req.ip || req.connection.remoteAddress,
        responseSize: res.get('content-length') || 'unknown'
      }
    );

    originalEnd.call(this, chunk, encoding);
  };

  next();
}

export default RequestLogger;