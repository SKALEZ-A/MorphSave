import { NextRequest, NextResponse } from 'next/server'
import { PrismaClient } from '@prisma/client'
import { verifyToken } from '@/lib/middleware/auth'

const prisma = new PrismaClient()

// Only available in development/test environments
if (process.env.NODE_ENV === 'production') {
  throw new Error('Test endpoints not available in production')
}

export async function POST(request: NextRequest) {
  try {
    // Verify authentication
    const authResult = await verifyToken(request)
    if (!authResult.success || !authResult.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { type, category, amount, normalAmount } = await request.json()

    if (!type || !category || !amount) {
      return NextResponse.json(
        { error: 'Type, category, and amount are required' },
        { status: 400 }
      )
    }

    // Create anomaly notification
    const notification = await prisma.notification.create({
      data: {
        userId: authResult.user.id,
        type: 'anomaly_detected',
        title: 'Unusual Spending Detected',
        message: `Unusual spending in ${category}: $${amount} (normal: $${normalAmount || 'N/A'})`,
        data: {
          anomalyType: type,
          category,
          amount,
          normalAmount,
          severity: amount > (normalAmount || 0) * 3 ? 'high' : 'medium',
          detectedAt: new Date().toISOString()
        },
        read: false
      }
    })

    // Log the anomaly for analysis
    console.log(`Anomaly detected for user ${authResult.user.id}:`, {
      type,
      category,
      amount,
      normalAmount,
      timestamp: new Date().toISOString()
    })

    return NextResponse.json({
      success: true,
      anomaly: {
        id: notification.id,
        type,
        category,
        amount,
        normalAmount,
        severity: notification.data.severity,
        detectedAt: notification.createdAt
      }
    })

  } catch (error) {
    console.error('Simulate anomaly error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function GET() {
  return NextResponse.json(
    { error: 'Method not allowed' },
    { status: 405 }
  )
}