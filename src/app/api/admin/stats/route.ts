import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';

export async function GET(request: NextRequest) {
  try {
    // Get basic user statistics
    const totalUsers = await prisma.user.count();
    const activeUsers = await prisma.user.count({
      where: {
        updatedAt: {
          gte: new Date(Date.now() - 24 * 60 * 60 * 1000) // Last 24 hours
        }
      }
    });

    // Get savings statistics
    const savingsAgg = await prisma.savingsTransaction.aggregate({
      _sum: {
        amount: true
      },
      _count: {
        id: true
      },
      where: {
        status: 'confirmed'
      }
    });

    // Get challenge statistics
    const activeChallenges = await prisma.challenge.count({
      where: {
        status: 'active'
      }
    });

    // Get achievement statistics
    const achievementsUnlocked = await prisma.userAchievement.count();

    // Determine system health based on various factors
    let systemHealth: 'healthy' | 'warning' | 'critical' = 'healthy';
    
    // Simple health check logic
    if (activeUsers < totalUsers * 0.1) {
      systemHealth = 'warning';
    }
    if (activeUsers < totalUsers * 0.05) {
      systemHealth = 'critical';
    }

    const stats = {
      totalUsers,
      activeUsers,
      totalSavings: Math.round((savingsAgg._sum.amount || 0) * 100) / 100,
      totalTransactions: savingsAgg._count.id || 0,
      activeChallenges,
      achievementsUnlocked,
      systemHealth,
      lastUpdated: new Date().toISOString()
    };

    return NextResponse.json(stats);
  } catch (error) {
    console.error('Error fetching admin stats:', error);
    return NextResponse.json(
      { error: 'Failed to fetch admin statistics' },
      { status: 500 }
    );
  }
}