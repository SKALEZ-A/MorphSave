import { NextResponse } from 'next/server'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

// Simple metrics collection for Prometheus
export async function GET() {
  try {
    const metrics: string[] = []
    
    // Add timestamp
    const timestamp = Date.now()
    
    // Application metrics
    metrics.push(`# HELP morphsave_uptime_seconds Application uptime in seconds`)
    metrics.push(`# TYPE morphsave_uptime_seconds counter`)
    metrics.push(`morphsave_uptime_seconds ${process.uptime()}`)
    
    // Memory metrics
    const memUsage = process.memoryUsage()
    metrics.push(`# HELP morphsave_memory_heap_used_bytes Memory heap used in bytes`)
    metrics.push(`# TYPE morphsave_memory_heap_used_bytes gauge`)
    metrics.push(`morphsave_memory_heap_used_bytes ${memUsage.heapUsed}`)
    
    metrics.push(`# HELP morphsave_memory_heap_total_bytes Memory heap total in bytes`)
    metrics.push(`# TYPE morphsave_memory_heap_total_bytes gauge`)
    metrics.push(`morphsave_memory_heap_total_bytes ${memUsage.heapTotal}`)
    
    // Database metrics
    try {
      const userCount = await prisma.user.count()
      metrics.push(`# HELP morphsave_users_total Total number of users`)
      metrics.push(`# TYPE morphsave_users_total gauge`)
      metrics.push(`morphsave_users_total ${userCount}`)
      
      const transactionCount = await prisma.savingsTransaction.count()
      metrics.push(`# HELP morphsave_transactions_total Total number of transactions`)
      metrics.push(`# TYPE morphsave_transactions_total gauge`)
      metrics.push(`morphsave_transactions_total ${transactionCount}`)
      
      const totalSaved = await prisma.savingsTransaction.aggregate({
        _sum: { amount: true },
        where: { type: { in: ['roundup', 'manual'] } }
      })
      
      metrics.push(`# HELP morphsave_total_saved_amount Total amount saved by all users`)
      metrics.push(`# TYPE morphsave_total_saved_amount gauge`)
      metrics.push(`morphsave_total_saved_amount ${totalSaved._sum.amount || 0}`)
      
      const activeUsers = await prisma.user.count({
        where: {
          updatedAt: {
            gte: new Date(Date.now() - 24 * 60 * 60 * 1000) // Last 24 hours
          }
        }
      })
      
      metrics.push(`# HELP morphsave_active_users_24h Active users in last 24 hours`)
      metrics.push(`# TYPE morphsave_active_users_24h gauge`)
      metrics.push(`morphsave_active_users_24h ${activeUsers}`)
      
    } catch (dbError) {
      metrics.push(`# HELP morphsave_database_error Database connection error`)
      metrics.push(`# TYPE morphsave_database_error gauge`)
      metrics.push(`morphsave_database_error 1`)
    }
    
    // HTTP request metrics (would be populated by middleware in real implementation)
    metrics.push(`# HELP morphsave_http_requests_total Total HTTP requests`)
    metrics.push(`# TYPE morphsave_http_requests_total counter`)
    metrics.push(`morphsave_http_requests_total{method="GET",status="200"} 0`)
    metrics.push(`morphsave_http_requests_total{method="POST",status="200"} 0`)
    metrics.push(`morphsave_http_requests_total{method="GET",status="404"} 0`)
    metrics.push(`morphsave_http_requests_total{method="POST",status="500"} 0`)
    
    // Response time metrics
    metrics.push(`# HELP morphsave_http_request_duration_seconds HTTP request duration`)
    metrics.push(`# TYPE morphsave_http_request_duration_seconds histogram`)
    metrics.push(`morphsave_http_request_duration_seconds_bucket{le="0.1"} 0`)
    metrics.push(`morphsave_http_request_duration_seconds_bucket{le="0.5"} 0`)
    metrics.push(`morphsave_http_request_duration_seconds_bucket{le="1.0"} 0`)
    metrics.push(`morphsave_http_request_duration_seconds_bucket{le="+Inf"} 0`)
    
    // Business metrics
    metrics.push(`# HELP morphsave_achievements_unlocked_total Total achievements unlocked`)
    metrics.push(`# TYPE morphsave_achievements_unlocked_total counter`)
    
    try {
      const achievementCount = await prisma.userAchievement.count()
      metrics.push(`morphsave_achievements_unlocked_total ${achievementCount}`)
    } catch {
      metrics.push(`morphsave_achievements_unlocked_total 0`)
    }
    
    metrics.push(`# HELP morphsave_challenges_active Active challenges`)
    metrics.push(`# TYPE morphsave_challenges_active gauge`)
    
    try {
      const activeChallenges = await prisma.challenge.count({
        where: { status: 'active' }
      })
      metrics.push(`morphsave_challenges_active ${activeChallenges}`)
    } catch {
      metrics.push(`morphsave_challenges_active 0`)
    }
    
    return new NextResponse(metrics.join('\n'), {
      headers: {
        'Content-Type': 'text/plain; version=0.0.4; charset=utf-8'
      }
    })
    
  } catch (error) {
    console.error('Metrics collection error:', error)
    return NextResponse.json(
      { error: 'Failed to collect metrics' },
      { status: 500 }
    )
  } finally {
    await prisma.$disconnect()
  }
}