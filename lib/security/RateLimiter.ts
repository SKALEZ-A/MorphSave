import { NextRequest } from 'next/server';
import Redis from 'ioredis';

export interface RateLimitConfig {
  windowMs: number;
  maxRequests: number;
  skipSuccessfulRequests?: boolean;
}

export interface RateLimitResult {
  allowed: boolean;
  limit: number;
  remaining: number;
  resetTime: number;
  retryAfter?: number;
}

export class RateLimiter {
  private redis: Redis;
  private config: RateLimitConfig;

  constructor(config: RateLimitConfig) {
    this.config = config;
    this.redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');
  }

  /**
   * Check if request is within rate limit
   */
  async checkLimit(clientIp: string, request: NextRequest): Promise<RateLimitResult> {
    const key = this.generateKey(clientIp, request);
    const window = Math.floor(Date.now() / this.config.windowMs);
    const redisKey = `rate_limit:${key}:${window}`;

    try {
      // Use Redis pipeline for atomic operations
      const pipeline = this.redis.pipeline();
      pipeline.incr(redisKey);
      pipeline.expire(redisKey, Math.ceil(this.config.windowMs / 1000));
      
      const results = await pipeline.exec();
      const count = results?.[0]?.[1] as number || 0;

      const remaining = Math.max(0, this.config.maxRequests - count);
      const resetTime = (window + 1) * this.config.windowMs;

      if (count > this.config.maxRequests) {
        return {
          allowed: false,
          limit: this.config.maxRequests,
          remaining: 0,
          resetTime,
          retryAfter: Math.ceil((resetTime - Date.now()) / 1000)
        };
      }

      return {
        allowed: true,
        limit: this.config.maxRequests,
        remaining,
        resetTime
      };

    } catch (error) {
      console.error('Rate limiter error:', error);
      // Fail open - allow request if Redis is down
      return {
        allowed: true,
        limit: this.config.maxRequests,
        remaining: this.config.maxRequests,
        resetTime: Date.now() + this.config.windowMs
      };
    }
  }

  /**
   * Check rate limit for specific endpoint
   */
  async checkEndpointLimit(
    clientIp: string, 
    endpoint: string, 
    customLimit?: number
  ): Promise<RateLimitResult> {
    const limit = customLimit || this.getEndpointLimit(endpoint);
    const key = `${clientIp}:${endpoint}`;
    const window = Math.floor(Date.now() / this.config.windowMs);
    const redisKey = `endpoint_limit:${key}:${window}`;

    try {
      const pipeline = this.redis.pipeline();
      pipeline.incr(redisKey);
      pipeline.expire(redisKey, Math.ceil(this.config.windowMs / 1000));
      
      const results = await pipeline.exec();
      const count = results?.[0]?.[1] as number || 0;

      const remaining = Math.max(0, limit - count);
      const resetTime = (window + 1) * this.config.windowMs;

      return {
        allowed: count <= limit,
        limit,
        remaining,
        resetTime,
        retryAfter: count > limit ? Math.ceil((resetTime - Date.now()) / 1000) : undefined
      };

    } catch (error) {
      console.error('Endpoint rate limiter error:', error);
      return {
        allowed: true,
        limit,
        remaining: limit,
        resetTime: Date.now() + this.config.windowMs
      };
    }
  }

  /**
   * Check rate limit for authenticated user
   */
  async checkUserLimit(userId: string, action: string): Promise<RateLimitResult> {
    const limit = this.getUserActionLimit(action);
    const key = `user:${userId}:${action}`;
    const window = Math.floor(Date.now() / this.config.windowMs);
    const redisKey = `user_limit:${key}:${window}`;

    try {
      const pipeline = this.redis.pipeline();
      pipeline.incr(redisKey);
      pipeline.expire(redisKey, Math.ceil(this.config.windowMs / 1000));
      
      const results = await pipeline.exec();
      const count = results?.[0]?.[1] as number || 0;

      const remaining = Math.max(0, limit - count);
      const resetTime = (window + 1) * this.config.windowMs;

      return {
        allowed: count <= limit,
        limit,
        remaining,
        resetTime,
        retryAfter: count > limit ? Math.ceil((resetTime - Date.now()) / 1000) : undefined
      };

    } catch (error) {
      console.error('User rate limiter error:', error);
      return {
        allowed: true,
        limit,
        remaining: limit,
        resetTime: Date.now() + this.config.windowMs
      };
    }
  }

  /**
   * Temporarily ban an IP address
   */
  async banIp(clientIp: string, durationMs: number, reason: string): Promise<void> {
    const key = `banned_ip:${clientIp}`;
    const banData = {
      reason,
      bannedAt: Date.now(),
      expiresAt: Date.now() + durationMs
    };

    try {
      await this.redis.setex(key, Math.ceil(durationMs / 1000), JSON.stringify(banData));
    } catch (error) {
      console.error('Failed to ban IP:', error);
    }
  }

  /**
   * Check if IP is banned
   */
  async isIpBanned(clientIp: string): Promise<{ banned: boolean; reason?: string; expiresAt?: number }> {
    const key = `banned_ip:${clientIp}`;

    try {
      const banData = await this.redis.get(key);
      if (!banData) {
        return { banned: false };
      }

      const parsed = JSON.parse(banData);
      return {
        banned: true,
        reason: parsed.reason,
        expiresAt: parsed.expiresAt
      };

    } catch (error) {
      console.error('Failed to check IP ban:', error);
      return { banned: false };
    }
  }

  /**
   * Remove IP ban
   */
  async unbanIp(clientIp: string): Promise<void> {
    const key = `banned_ip:${clientIp}`;
    try {
      await this.redis.del(key);
    } catch (error) {
      console.error('Failed to unban IP:', error);
    }
  }

  /**
   * Get current rate limit status
   */
  async getStatus(clientIp: string, request: NextRequest): Promise<RateLimitResult> {
    const key = this.generateKey(clientIp, request);
    const window = Math.floor(Date.now() / this.config.windowMs);
    const redisKey = `rate_limit:${key}:${window}`;

    try {
      const count = await this.redis.get(redisKey);
      const currentCount = parseInt(count || '0');
      const remaining = Math.max(0, this.config.maxRequests - currentCount);
      const resetTime = (window + 1) * this.config.windowMs;

      return {
        allowed: currentCount < this.config.maxRequests,
        limit: this.config.maxRequests,
        remaining,
        resetTime
      };

    } catch (error) {
      console.error('Failed to get rate limit status:', error);
      return {
        allowed: true,
        limit: this.config.maxRequests,
        remaining: this.config.maxRequests,
        resetTime: Date.now() + this.config.windowMs
      };
    }
  }

  /**
   * Reset rate limit for IP
   */
  async resetLimit(clientIp: string, request: NextRequest): Promise<void> {
    const key = this.generateKey(clientIp, request);
    const window = Math.floor(Date.now() / this.config.windowMs);
    const redisKey = `rate_limit:${key}:${window}`;

    try {
      await this.redis.del(redisKey);
    } catch (error) {
      console.error('Failed to reset rate limit:', error);
    }
  }

  /**
   * Get rate limit statistics
   */
  async getStatistics(timeRange: number = 3600000): Promise<{
    totalRequests: number;
    blockedRequests: number;
    topIps: Array<{ ip: string; requests: number }>;
  }> {
    try {
      const now = Date.now();
      const windows = Math.ceil(timeRange / this.config.windowMs);
      const currentWindow = Math.floor(now / this.config.windowMs);
      
      const keys = [];
      for (let i = 0; i < windows; i++) {
        keys.push(`rate_limit:*:${currentWindow - i}`);
      }

      // This is a simplified version - in production, you'd want more sophisticated analytics
      const allKeys = await this.redis.keys('rate_limit:*');
      const pipeline = this.redis.pipeline();
      
      allKeys.forEach(key => pipeline.get(key));
      const results = await pipeline.exec();
      
      let totalRequests = 0;
      let blockedRequests = 0;
      const ipCounts: Record<string, number> = {};

      results?.forEach((result, index) => {
        if (result && result[1]) {
          const count = parseInt(result[1] as string);
          totalRequests += count;
          
          if (count > this.config.maxRequests) {
            blockedRequests += count - this.config.maxRequests;
          }

          // Extract IP from key
          const key = allKeys[index];
          const ip = key.split(':')[1];
          ipCounts[ip] = (ipCounts[ip] || 0) + count;
        }
      });

      const topIps = Object.entries(ipCounts)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 10)
        .map(([ip, requests]) => ({ ip, requests }));

      return {
        totalRequests,
        blockedRequests,
        topIps
      };

    } catch (error) {
      console.error('Failed to get rate limit statistics:', error);
      return {
        totalRequests: 0,
        blockedRequests: 0,
        topIps: []
      };
    }
  }

  /**
   * Generate rate limit key
   */
  private generateKey(clientIp: string, request: NextRequest): string {
    const url = new URL(request.url);
    const endpoint = url.pathname;
    
    // Different keys for different types of requests
    if (endpoint.startsWith('/api/auth/')) {
      return `auth:${clientIp}`;
    } else if (endpoint.startsWith('/api/')) {
      return `api:${clientIp}`;
    } else {
      return `general:${clientIp}`;
    }
  }

  /**
   * Get endpoint-specific rate limits
   */
  private getEndpointLimit(endpoint: string): number {
    const endpointLimits: Record<string, number> = {
      '/api/auth/login': 5,           // 5 login attempts per window
      '/api/auth/register': 3,        // 3 registration attempts per window
      '/api/auth/forgot-password': 2, // 2 password reset requests per window
      '/api/savings/deposit': 10,     // 10 deposits per window
      '/api/savings/withdraw': 5,     // 5 withdrawals per window
      '/api/notifications': 50,       // 50 notification requests per window
      '/api/challenges': 20,          // 20 challenge requests per window
      '/api/friends': 30,             // 30 friend requests per window
    };

    return endpointLimits[endpoint] || this.config.maxRequests;
  }

  /**
   * Get user action-specific rate limits
   */
  private getUserActionLimit(action: string): number {
    const actionLimits: Record<string, number> = {
      'friend_request': 10,     // 10 friend requests per window
      'challenge_create': 5,    // 5 challenges created per window
      'message_send': 100,      // 100 messages per window
      'achievement_claim': 20,  // 20 achievement claims per window
      'transaction_create': 50, // 50 transactions per window
    };

    return actionLimits[action] || 20;
  }

  /**
   * Cleanup old rate limit data
   */
  async cleanup(): Promise<void> {
    try {
      const pattern = 'rate_limit:*';
      const keys = await this.redis.keys(pattern);
      
      if (keys.length > 0) {
        // Delete keys in batches to avoid blocking Redis
        const batchSize = 100;
        for (let i = 0; i < keys.length; i += batchSize) {
          const batch = keys.slice(i, i + batchSize);
          const pipeline = this.redis.pipeline();
          
          batch.forEach(key => {
            // Check if key is expired based on window
            const parts = key.split(':');
            const window = parseInt(parts[parts.length - 1]);
            const currentWindow = Math.floor(Date.now() / this.config.windowMs);
            
            if (currentWindow - window > 2) { // Keep last 2 windows
              pipeline.del(key);
            }
          });
          
          await pipeline.exec();
        }
      }
    } catch (error) {
      console.error('Failed to cleanup rate limit data:', error);
    }
  }
}