import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';

export async function POST(request: NextRequest) {
  try {
    // Delete all demo-related data in the correct order to respect foreign key constraints
    
    // 1. Delete challenge participants
    await prisma.challengeParticipant.deleteMany({
      where: { 
        user: { email: { contains: '@demo.com' } }
      }
    });

    // 2. Delete challenges created by demo users
    await prisma.challenge.deleteMany({
      where: { 
        creator: { email: { contains: '@demo.com' } }
      }
    });

    // 3. Delete user achievements
    await prisma.userAchievement.deleteMany({
      where: { 
        user: { email: { contains: '@demo.com' } }
      }
    });

    // 4. Delete savings transactions
    await prisma.savingsTransaction.deleteMany({
      where: { 
        user: { email: { contains: '@demo.com' } }
      }
    });

    // 5. Delete friendships
    await prisma.friendship.deleteMany({
      where: { 
        OR: [
          { user: { email: { contains: '@demo.com' } } },
          { friend: { email: { contains: '@demo.com' } } }
        ]
      }
    });

    // 6. Delete notifications
    await prisma.notification.deleteMany({
      where: { 
        user: { email: { contains: '@demo.com' } }
      }
    });

    // 7. Delete bank accounts
    await prisma.bankAccount.deleteMany({
      where: { 
        user: { email: { contains: '@demo.com' } }
      }
    });

    // 8. Delete sessions
    await prisma.session.deleteMany({
      where: { 
        user: { email: { contains: '@demo.com' } }
      }
    });

    // 9. Finally, delete demo users
    const deletedUsers = await prisma.user.deleteMany({
      where: { 
        email: { contains: '@demo.com' }
      }
    });

    // 10. Clean up orphaned achievements (optional)
    const orphanedAchievements = await prisma.achievement.deleteMany({
      where: {
        AND: [
          { name: { in: ['First Steps', 'Century Club', 'Streak Master', 'Social Butterfly', 'Challenge Champion', 'Thousand Club', 'Legendary Saver'] } },
          { userAchievements: { none: {} } }
        ]
      }
    });

    return NextResponse.json({
      success: true,
      message: 'Demo data reset successfully',
      details: {
        usersDeleted: deletedUsers.count,
        achievementsDeleted: orphanedAchievements.count
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error resetting demo data:', error);
    return NextResponse.json(
      { 
        success: false,
        error: 'Failed to reset demo data',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}