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

    const { amount, merchant, category } = await request.json()

    if (!amount || !merchant) {
      return NextResponse.json(
        { error: 'Amount and merchant are required' },
        { status: 400 }
      )
    }

    // Calculate round-up amount
    const roundUpAmount = Math.ceil(amount) - amount

    if (roundUpAmount > 0) {
      // Create round-up transaction
      const transaction = await prisma.savingsTransaction.create({
        data: {
          userId: authResult.user.id,
          type: 'roundup',
          amount: roundUpAmount,
          currency: 'USD',
          blockchainTxHash: `0x${Math.random().toString(16).substr(2, 64)}`,
          status: 'confirmed',
          originalTransactionAmount: amount,
          originalTransactionMerchant: merchant,
          originalTransactionCategory: category || 'other'
        }
      })

      // Update user's total saved
      await prisma.user.update({
        where: { id: authResult.user.id },
        data: {
          totalSaved: {
            increment: roundUpAmount
          }
        }
      })

      // Check for achievements
      const totalSaved = await prisma.savingsTransaction.aggregate({
        where: {
          userId: authResult.user.id,
          type: { in: ['roundup', 'manual'] }
        },
        _sum: {
          amount: true
        }
      })

      const achievements = []

      // First deposit achievement
      const depositCount = await prisma.savingsTransaction.count({
        where: {
          userId: authResult.user.id,
          type: { in: ['roundup', 'manual'] }
        }
      })

      if (depositCount === 1) {
        const existingAchievement = await prisma.userAchievement.findFirst({
          where: {
            userId: authResult.user.id,
            achievementId: 'first_deposit'
          }
        })

        if (!existingAchievement) {
          await prisma.userAchievement.create({
            data: {
              userId: authResult.user.id,
              achievementId: 'first_deposit',
              pointsEarned: 100
            }
          })
          achievements.push('first_deposit')
        }
      }

      // Milestone achievements
      const total = totalSaved._sum.amount || 0
      const milestones = [
        { amount: 100, id: 'hundred_saved', points: 200 },
        { amount: 500, id: 'five_hundred_saved', points: 500 },
        { amount: 1000, id: 'thousand_saved', points: 1000 }
      ]

      for (const milestone of milestones) {
        if (total >= milestone.amount) {
          const existingAchievement = await prisma.userAchievement.findFirst({
            where: {
              userId: authResult.user.id,
              achievementId: milestone.id
            }
          })

          if (!existingAchievement) {
            await prisma.userAchievement.create({
              data: {
                userId: authResult.user.id,
                achievementId: milestone.id,
                pointsEarned: milestone.points
              }
            })
            achievements.push(milestone.id)
          }
        }
      }

      return NextResponse.json({
        success: true,
        roundUpAmount,
        transaction,
        achievements,
        totalSaved: total
      })
    }

    return NextResponse.json({
      success: true,
      roundUpAmount: 0,
      message: 'No round-up needed'
    })

  } catch (error) {
    console.error('Simulate transaction error:', error)
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