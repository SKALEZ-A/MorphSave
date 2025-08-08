import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { faker } from '@faker-js/faker';

export async function POST(request: NextRequest) {
  try {
    // Get demo users
    const demoUsers = await prisma.user.findMany({
      where: {
        email: {
          contains: '@demo.com'
        }
      },
      include: {
        achievements: true
      }
    });

    if (demoUsers.length === 0) {
      return NextResponse.json(
        { error: 'No demo users found. Please create demo data first.' },
        { status: 400 }
      );
    }

    // Get all available achievements
    const allAchievements = await prisma.achievement.findMany();
    const newUnlocks = [];

    for (const user of demoUsers) {
      // Find achievements the user doesn't have yet
      const userAchievementIds = user.achievements.map(ua => ua.achievementId);
      const availableAchievements = allAchievements.filter(
        achievement => !userAchievementIds.includes(achievement.id)
      );

      // Randomly unlock 1-2 new achievements for each user
      const unlocksCount = faker.number.int({ min: 0, max: 2 });
      const achievementsToUnlock = faker.helpers.arrayElements(
        availableAchievements, 
        Math.min(unlocksCount, availableAchievements.length)
      );

      for (const achievement of achievementsToUnlock) {
        await prisma.userAchievement.create({
          data: {
            id: faker.string.uuid(),
            userId: user.id,
            achievementId: achievement.id,
            unlockedAt: new Date(),
            createdAt: new Date(),
            updatedAt: new Date()
          }
        });

        // Update user's total points
        await prisma.user.update({
          where: { id: user.id },
          data: {
            totalPoints: {
              increment: achievement.points
            },
            updatedAt: new Date()
          }
        });

        newUnlocks.push({
          user: user.username,
          achievement: achievement.name,
          points: achievement.points,
          rarity: achievement.rarity
        });
      }
    }

    return NextResponse.json({
      success: true,
      message: `Triggered ${newUnlocks.length} achievement unlocks`,
      unlocks: newUnlocks,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error triggering achievements:', error);
    return NextResponse.json(
      { 
        success: false,
        error: 'Failed to trigger achievements',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}