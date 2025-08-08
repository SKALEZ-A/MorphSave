import { NextRequest, NextResponse } from 'next/server';
import { RateLimiter } from './RateLimiter';
import { InputValidator } from './InputValidator';
import { AuditLogger } from './AuditLogger';
import { SecurityMonitor } from './SecurityMonitor';

export interface SecurityConfig {
  rateLimit: {
    windowMs: number;
    maxRequests: number;
    skipSuccessfulRequests?: boolean;
  };
  ddosProtection: {
    enabled: boolean;
    threshold: number;
    banDuration: number;
  };
  inputValidation: {
    enabled: boolean;
    maxBodySize: number;
    sanitizeHtml: boolean;
  };
  auditLogging: {
    enabled: boolean;
    logLevel: 'basic' | 'detailed' | 'full';
  };
  monitoring: {
    enabled: boolean;
    alertThreshold: number;
  };
}

export class SecurityMiddleware {
  private rateLimiter: RateLimiter;
  private inputValidator: InputValidator;
  private auditLogger: AuditLogger;
  private securityMonitor: SecurityMonitor;
  private config: SecurityConfig;

  constructor(config: SecurityConfig) {
    this.config = config;
    this.rateLimiter = new RateLimiter(config.rateLimit);
    this.inputValidator = new InputValidator(config.inputValidation);
    this.auditLogger = new AuditLogger(config.auditLogging);
    this.securityMonitor = new SecurityMonitor(config.monitoring);
  }

  /**
   * Main security middleware function
   */
  async apply(
    request: NextRequest,
    handler: (req: NextRequest) => Promise<NextResponse>
  ): Promise<NextResponse> {
    const startTime = Date.now();
    const clientIp = this.getClientIp(request);
    const userAgent = request.headers.get('user-agent') || 'unknown';
    const requestId = this.generateRequestId();

    try {
      // 1. DDoS Protection
      if (this.config.ddosProtection.enabled) {
        const ddosCheck = await this.checkDDoSProtection(clientIp, request);
        if (!ddosCheck.allowed) {
          await this.auditLogger.logSecurityEvent({
            type: 'ddos_blocked',
            clientIp,
            userAgent,
            requestId,
            details: { reason: ddosCheck.reason }
          });
          return this.createSecurityResponse('DDoS protection activated', 429);
        }
      }

      // 2. Rate Limiting
      const rateLimitResult = await this.rateLimiter.checkLimit(clientIp, request);
      if (!rateLimitResult.allowed) {
        await this.auditLogger.logSecurityEvent({
          type: 'rate_limit_exceeded',
          clientIp,
          userAgent,
          requestId,
          details: { 
            limit: rateLimitResult.limit,
            remaining: rateLimitResult.remaining,
            resetTime: rateLimitResult.resetTime
          }
        });
        return this.createRateLimitResponse(rateLimitResult);
      }

      // 3. Input Validation and Sanitization
      if (this.config.inputValidation.enabled) {
        const validationResult = await this.inputValidator.validate(request);
        if (!validationResult.valid) {
          await this.auditLogger.logSecurityEvent({
            type: 'input_validation_failed',
            clientIp,
            userAgent,
            requestId,
            details: { errors: validationResult.errors }
          });
          return this.createSecurityResponse('Invalid input detected', 400);
        }
      }

      // 4. Security Headers Check
      const securityHeadersResult = this.validateSecurityHeaders(request);
      if (!securityHeadersResult.valid) {
        await this.auditLogger.logSecurityEvent({
          type: 'security_headers_violation',
          clientIp,
          userAgent,
          requestId,
          details: { violations: securityHeadersResult.violations }
        });
      }

      // 5. Execute the actual request handler
      const response = await handler(request);

      // 6. Add security headers to response
      this.addSecurityHeaders(response);

      // 7. Log successful request
      const duration = Date.now() - startTime;
      await this.auditLogger.logRequest({
        requestId,
        method: request.method,
        url: request.url,
        clientIp,
        userAgent,
        statusCode: response.status,
        duration,
        success: response.status < 400
      });

      // 8. Update security monitoring
      await this.securityMonitor.recordRequest({
        clientIp,
        statusCode: response.status,
        duration,
        endpoint: new URL(request.url).pathname
      });

      return response;

    } catch (error) {
      const duration = Date.now() - startTime;
      
      // Log security incident
      await this.auditLogger.logSecurityEvent({
        type: 'middleware_error',
        clientIp,
        userAgent,
        requestId,
        details: { 
          error: error instanceof Error ? error.message : 'Unknown error',
          duration
        }
      });

      // Alert security monitoring
      await this.securityMonitor.recordIncident({
        type: 'middleware_error',
        clientIp,
        severity: 'high',
        details: error instanceof Error ? error.message : 'Unknown error'
      });

      throw error;
    }
  }

  /**
   * DDoS Protection Check
   */
  private async checkDDoSProtection(
    clientIp: string, 
    request: NextRequest
  ): Promise<{ allowed: boolean; reason?: string }> {
    const windowMs = 60000; // 1 minute
    const threshold = this.config.ddosProtection.threshold;

    // Check request frequency
    const requestCount = await this.securityMonitor.getRequestCount(clientIp, windowMs);
    if (requestCount > threshold) {
      return { allowed: false, reason: 'Request frequency exceeded' };
    }

    // Check for suspicious patterns
    const suspiciousPatterns = [
      /bot|crawler|spider/i.test(request.headers.get('user-agent') || ''),
      request.headers.get('x-forwarded-for')?.split(',').length > 5,
      !request.headers.get('accept-language'),
      request.headers.get('connection')?.toLowerCase() === 'close'
    ];

    const suspiciousScore = suspiciousPatterns.filter(Boolean).length;
    if (suspiciousScore >= 3) {
      return { allowed: false, reason: 'Suspicious request pattern' };
    }

    return { allowed: true };
  }

  /**
   * Validate security headers
   */
  private validateSecurityHeaders(request: NextRequest): { valid: boolean; violations: string[] } {
    const violations: string[] = [];
    const headers = request.headers;

    // Check for required security headers in sensitive requests
    if (request.method === 'POST' || request.method === 'PUT' || request.method === 'DELETE') {
      if (!headers.get('content-type')) {
        violations.push('Missing Content-Type header');
      }

      if (!headers.get('x-requested-with') && !headers.get('authorization')) {
        violations.push('Missing authentication or AJAX headers');
      }
    }

    // Check for potentially malicious headers
    const maliciousPatterns = [
      { header: 'x-forwarded-for', pattern: /[<>'"&]/ },
      { header: 'user-agent', pattern: /[<>'"&]/ },
      { header: 'referer', pattern: /javascript:|data:|vbscript:/ }
    ];

    maliciousPatterns.forEach(({ header, pattern }) => {
      const value = headers.get(header);
      if (value && pattern.test(value)) {
        violations.push(`Malicious pattern in ${header} header`);
      }
    });

    return { valid: violations.length === 0, violations };
  }

  /**
   * Add security headers to response
   */
  private addSecurityHeaders(response: NextResponse): void {
    // Prevent XSS attacks
    response.headers.set('X-Content-Type-Options', 'nosniff');
    response.headers.set('X-Frame-Options', 'DENY');
    response.headers.set('X-XSS-Protection', '1; mode=block');
    
    // Content Security Policy
    const csp = [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://cdn.jsdelivr.net",
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      "font-src 'self' https://fonts.gstatic.com",
      "img-src 'self' data: https:",
      "connect-src 'self' wss: https:",
      "frame-ancestors 'none'"
    ].join('; ');
    response.headers.set('Content-Security-Policy', csp);

    // HTTPS enforcement
    if (process.env.NODE_ENV === 'production') {
      response.headers.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
    }

    // Prevent information disclosure
    response.headers.set('Server', 'MorphSave');
    response.headers.set('X-Powered-By', '');

    // CORS headers
    response.headers.set('Access-Control-Allow-Origin', process.env.FRONTEND_URL || '*');
    response.headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    response.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
    response.headers.set('Access-Control-Allow-Credentials', 'true');
  }

  /**
   * Create security response
   */
  private createSecurityResponse(message: string, status: number): NextResponse {
    const response = NextResponse.json(
      { error: message, timestamp: new Date().toISOString() },
      { status }
    );
    this.addSecurityHeaders(response);
    return response;
  }

  /**
   * Create rate limit response
   */
  private createRateLimitResponse(rateLimitResult: any): NextResponse {
    const response = NextResponse.json(
      { 
        error: 'Rate limit exceeded',
        limit: rateLimitResult.limit,
        remaining: rateLimitResult.remaining,
        resetTime: rateLimitResult.resetTime
      },
      { status: 429 }
    );

    response.headers.set('X-RateLimit-Limit', rateLimitResult.limit.toString());
    response.headers.set('X-RateLimit-Remaining', rateLimitResult.remaining.toString());
    response.headers.set('X-RateLimit-Reset', rateLimitResult.resetTime.toString());
    response.headers.set('Retry-After', Math.ceil((rateLimitResult.resetTime - Date.now()) / 1000).toString());

    this.addSecurityHeaders(response);
    return response;
  }

  /**
   * Get client IP address
   */
  private getClientIp(request: NextRequest): string {
    const forwarded = request.headers.get('x-forwarded-for');
    const realIp = request.headers.get('x-real-ip');
    const remoteAddr = request.headers.get('remote-addr');

    if (forwarded) {
      return forwarded.split(',')[0].trim();
    }
    if (realIp) {
      return realIp;
    }
    if (remoteAddr) {
      return remoteAddr;
    }

    return 'unknown';
  }

  /**
   * Generate unique request ID
   */
  private generateRequestId(): string {
    return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}

// Default security configuration
export const defaultSecurityConfig: SecurityConfig = {
  rateLimit: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    maxRequests: 100,
    skipSuccessfulRequests: false
  },
  ddosProtection: {
    enabled: true,
    threshold: 50,
    banDuration: 60 * 60 * 1000 // 1 hour
  },
  inputValidation: {
    enabled: true,
    maxBodySize: 10 * 1024 * 1024, // 10MB
    sanitizeHtml: true
  },
  auditLogging: {
    enabled: true,
    logLevel: 'detailed'
  },
  monitoring: {
    enabled: true,
    alertThreshold: 10
  }
};

// Export singleton instance
export const securityMiddleware = new SecurityMiddleware(defaultSecurityConfig);