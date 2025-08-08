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

    const { category, spent, budget, threshold } = await request.json()

    if (!category || spent === undefined || budget === undefined || threshold === undefined) {
      return NextResponse.json(
        { error: 'Category, spent, budget, and threshold are required' },
        { status: 400 }
      )
    }

    const percentageUsed = (spent / budget) * 100

    if (percentageUsed >= threshold) {
      // Create budget alert notification
      const notification = await prisma.notification.create({
        data: {
          userId: authResult.user.id,
          type: 'budget_alert',
          title: 'Budget Alert',
          message: `You've used ${Math.round(percentageUsed)}% of your ${category} budget`,
          data: {
            category,
            spent,
            budget,
            percentageUsed: Math.round(percentageUsed),
            threshold,
            remaining: budget - spent,
            alertLevel: percentageUsed >= 90 ? 'critical' : percentageUsed >= 80 ? 'warning' : 'info'
          },
          read: false
        }
      })

      return NextResponse.json({
        success: true,
        alert: {
          id: notification.id,
          category,
          spent,
          budget,
          percentageUsed: Math.round(percentageUsed),
          threshold,
          remaining: budget - spent,
          alertLevel: notification.data.alertLevel,
          createdAt: notification.createdAt
        }
      })
    }

    return NextResponse.json({
      success: true,
      message: 'Budget threshold not reached',
      percentageUsed: Math.round(percentageUsed)
    })

  } catch (error) {
    console.error('Simulate budget alert error:', error)
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