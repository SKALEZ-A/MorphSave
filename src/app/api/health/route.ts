import { NextResponse } from 'next/server'
import { PrismaClient } from '@prisma/client'
import Redis from 'ioredis'

const prisma = new PrismaClient()

export async function GET() {
  const startTime = Date.now()
  const checks: any = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    version: process.env.npm_package_version || '1.0.0',
    environment: process.env.NODE_ENV || 'development',
    checks: {}
  }

  try {
    // Database health check
    try {
      await prisma.$queryRaw`SELECT 1`
      checks.checks.database = {
        status: 'healthy',
        responseTime: Date.now() - startTime
      }
    } catch (error) {
      checks.checks.database = {
        status: 'unhealthy',
        error: error instanceof Error ? error.message : 'Unknown error',
        responseTime: Date.now() - startTime
      }
      checks.status = 'unhealthy'
    }

    // Redis health check
    if (process.env.REDIS_URL) {
      try {
        const redis = new Redis(process.env.REDIS_URL)
        const redisStartTime = Date.now()
        await redis.ping()
        await redis.disconnect()
        
        checks.checks.redis = {
          status: 'healthy',
          responseTime: Date.now() - redisStartTime
        }
      } catch (error) {
        checks.checks.redis = {
          status: 'unhealthy',
          error: error instanceof Error ? error.message : 'Unknown error'
        }
        checks.status = 'unhealthy'
      }
    }

    // Memory usage check
    const memUsage = process.memoryUsage()
    checks.checks.memory = {
      status: memUsage.heapUsed < 1024 * 1024 * 1024 ? 'healthy' : 'warning', // 1GB threshold
      heapUsed: `${Math.round(memUsage.heapUsed / 1024 / 1024)}MB`,
      heapTotal: `${Math.round(memUsage.heapTotal / 1024 / 1024)}MB`,
      external: `${Math.round(memUsage.external / 1024 / 1024)}MB`
    }

    // Disk space check (simplified)
    checks.checks.disk = {
      status: 'healthy' // In production, implement actual disk space check
    }

    // External services check
    checks.checks.external = {
      plaid: process.env.PLAID_CLIENT_ID ? 'configured' : 'not_configured',
      openai: process.env.OPENAI_API_KEY ? 'configured' : 'not_configured',
      blockchain: process.env.MORPH_RPC_URL ? 'configured' : 'not_configured'
    }

    checks.responseTime = Date.now() - startTime

    const statusCode = checks.status === 'healthy' ? 200 : 503
    return NextResponse.json(checks, { status: statusCode })

  } catch (error) {
    return NextResponse.json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      error: error instanceof Error ? error.message : 'Unknown error',
      responseTime: Date.now() - startTime
    }, { status: 503 })
  } finally {
    await prisma.$disconnect()
  }
}