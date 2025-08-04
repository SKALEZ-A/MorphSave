import { prisma } from './prisma';
import { Achievement, UserAchievement, AchievementCategory, AchievementRarity, Prisma } from '@prisma/client';
import { updateUserStats } from './user';

export interface CreateAchievementInput {
  name: string;
  description: string;
  icon: string;
  category: AchievementCategory;
  rarity: AchievementRarity;
  pointsReward: number;
}

export interface AchievementWithProgress extends Achievement {
  isUnlocked: boolean;
  unlockedAt?: Date;
  progress?: number;
  maxProgress?: number;
}

export interface AchievementStats {
  totalAchievements: number;
  unlockedAchievements: number;
  completionRate: number;
  totalPointsEarned: number;
  byCategory: Record<AchievementCategory, { total: number; unlocked: number }>;
  byRarity: Record<AchievementRarity, { total: number; unlocked: number }>;
  recentUnlocks: UserAchievement[];
}

/**
 * Create a new achievement
 */
export async function createAchievement(input: CreateAchievementInput): Promise<Achievement> {
  return prisma.achievement.create({
    data: input
  });
}

/**
 * Get all achievements
 */
export async function getAllAchievements(): Promise<Achievement[]> {
  return prisma.achievement.findMany({
    orderBy: [
      { category: 'asc' },
      { pointsReward: 'asc' }
    ]
  });
}

/**
 * Get achievements by category
 */
export async function getAchievementsByCategory(
  category: AchievementCategory
): Promise<Achievement[]> {
  return prisma.achievement.findMany({
    where: { category },
    orderBy: { pointsReward: 'asc' }
  });
}

/**
 * Get user's achievements with progress
 */
export async function getUserAchievements(
  userId: string
): Promise<AchievementWithProgress[]> {
  const [allAchievements, userAchievements] = await Promise.all([
    getAllAchievements(),
    prisma.userAchievement.findMany({
      where: { userId },
      include: { achievement: true }
    })
  ]);

  const unlockedMap = new Map(
    userAchievements.map(ua => [ua.achievementId, ua])
  );

  return allAchievements.map(achievement => ({
    ...achievement,
    isUnlocked: unlockedMap.has(achievement.id),
    unlockedAt: unlockedMap.get(achievement.id)?.unlockedAt,
    progress: calculateAchievementProgress(userId, achievement),
    maxProgress: getAchievementMaxProgress(achievement)
  }));
}

/**
 * Unlock achievement for user
 */
export async function unlockAchievement(
  userId: string,
  achievementId: string
): Promise<UserAchievement | null> {
  // Check if already unlocked
  const existing = await prisma.userAchievement.findUnique({
    where: {
      userId_achievementId: {
        userId,
        achievementId
      }
    }
  });

  if (existing) {
    return existing;
  }

  // Get achievement details
  const achievement = await prisma.achievement.findUnique({
    where: { id: achievementId }
  });

  if (!achievement) {
    throw new Error('Achievement not found');
  }

  // Create user achievement
  const userAchievement = await prisma.userAchievement.create({
    data: {
      userId,
      achievementId
    },
    include: {
      achievement: true
    }
  });

  // Update user's total points
  await updateUserStats(userId, {
    totalPoints: {
      increment: achievement.pointsReward
    }
  });

  // Create notification
  await prisma.notification.create({
    data: {
      userId,
      type: 'ACHIEVEMENT',
      title: 'Achievement Unlocked!',
      message: `Congratulations! You've unlocked "${achievement.name}"`,
      data: {
        achievementId: achievement.id,
        pointsEarned: achievement.pointsReward
      }
    }
  });

  return userAchievement;
}

/**
 * Check and unlock achievements based on user activity
 */
export async function checkAndUnlockAchievements(
  userId: string,
  activityType: 'savings' | 'streak' | 'social' | 'special',
  activityData: any
): Promise<UserAchievement[]> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      achievements: true,
      savingsTransactions: {
        where: { status: 'CONFIRMED' }
      }
    }
  });

  if (!user) return [];

  const unlockedAchievements: UserAchievement[] = [];
  const alreadyUnlocked = new Set(user.achievements.map(ua => ua.achievementId));

  // Get relevant achievements to check
  const achievementsToCheck = await getAchievementsByCategory(
    activityType.toUpperCase() as AchievementCategory
  );

  for (const achievement of achievementsToCheck) {
    if (alreadyUnlocked.has(achievement.id)) continue;

    const shouldUnlock = await checkAchievementCriteria(
      user,
      achievement,
      activityType,
      activityData
    );

    if (shouldUnlock) {
      const userAchievement = await unlockAchievement(userId, achievement.id);
      if (userAchievement) {
        unlockedAchievements.push(userAchievement);
      }
    }
  }

  return unlockedAchievements;
}

/**
 * Get user's achievement statistics
 */
export async function getUserAchievementStats(userId: string): Promise<AchievementStats> {
  const [allAchievements, userAchievements] = await Promise.all([
    getAllAchievements(),
    prisma.userAchievement.findMany({
      where: { userId },
      include: { achievement: true },
      orderBy: { unlockedAt: 'desc' }
    })
  ]);

  const totalAchievements = allAchievements.length;
  const unlockedAchievements = userAchievements.length;
  const completionRate = totalAchievements > 0 ? (unlockedAchievements / totalAchievements) * 100 : 0;
  const totalPointsEarned = userAchievements.reduce((sum, ua) => sum + ua.achievement.pointsReward, 0);

  // Group by category
  const byCategory = allAchievements.reduce((acc, achievement) => {
    if (!acc[achievement.category]) {
      acc[achievement.category] = { total: 0, unlocked: 0 };
    }
    acc[achievement.category].total++;
    
    const isUnlocked = userAchievements.some(ua => ua.achievementId === achievement.id);
    if (isUnlocked) {
      acc[achievement.category].unlocked++;
    }
    
    return acc;
  }, {} as Record<AchievementCategory, { total: number; unlocked: number }>);

  // Group by rarity
  const byRarity = allAchievements.reduce((acc, achievement) => {
    if (!acc[achievement.rarity]) {
      acc[achievement.rarity] = { total: 0, unlocked: 0 };
    }
    acc[achievement.rarity].total++;
    
    const isUnlocked = userAchievements.some(ua => ua.achievementId === achievement.id);
    if (isUnlocked) {
      acc[achievement.rarity].unlocked++;
    }
    
    return acc;
  }, {} as Record<AchievementRarity, { total: number; unlocked: number }>);

  return {
    totalAchievements,
    unlockedAchievements,
    completionRate,
    totalPointsEarned,
    byCategory,
    byRarity,
    recentUnlocks: userAchievements.slice(0, 5)
  };
}

/**
 * Get achievement leaderboard
 */
export async function getAchievementLeaderboard(
  limit: number = 10
): Promise<Array<{
  userId: string;
  username: string;
  firstName?: string;
  lastName?: string;
  profileImage?: string;
  achievementCount: number;
  totalPoints: number;
}>> {
  const result = await prisma.user.findMany({
    where: { isActive: true },
    select: {
      id: true,
      username: true,
      firstName: true,
      lastName: true,
      profileImage: true,
      totalPoints: true,
      _count: {
        select: {
          achievements: true
        }
      }
    },
    orderBy: [
      { totalPoints: 'desc' },
      { _count: { achievements: 'desc' } }
    ],
    take: limit
  });

  return result.map(user => ({
    userId: user.id,
    username: user.username,
    firstName: user.firstName,
    lastName: user.lastName,
    profileImage: user.profileImage,
    achievementCount: user._count.achievements,
    totalPoints: user.totalPoints
  }));
}

/**
 * Get rare achievements (epic and legendary)
 */
export async function getRareAchievements(): Promise<Achievement[]> {
  return prisma.achievement.findMany({
    where: {
      rarity: {
        in: ['EPIC', 'LEGENDARY']
      }
    },
    orderBy: { pointsReward: 'desc' }
  });
}

/**
 * Get achievement progress for specific achievement
 */
async function calculateAchievementProgress(
  userId: string,
  achievement: Achievement
): Promise<number> {
  // This would be implemented based on specific achievement criteria
  // For now, return 0 as placeholder
  return 0;
}

/**
 * Get maximum progress value for achievement
 */
function getAchievementMaxProgress(achievement: Achievement): number {
  // This would be based on achievement criteria
  // For now, return 100 as placeholder
  return 100;
}

/**
 * Check if user meets achievement criteria
 */
async function checkAchievementCriteria(
  user: any,
  achievement: Achievement,
  activityType: string,
  activityData: any
): Promise<boolean> {
  switch (achievement.name) {
    case 'First Save':
      return user.totalSaved > 0;
    
    case 'Century Club':
      return user.totalSaved >= 100;
    
    case 'Thousand Club':
      return user.totalSaved >= 1000;
    
    case 'Week Warrior':
      return user.longestStreak >= 7;
    
    case 'Month Master':
      return user.longestStreak >= 30;
    
    case 'Year Champion':
      return user.longestStreak >= 365;
    
    case 'Social Butterfly':
      // Check referral count
      const referralCount = await prisma.user.count({
        where: {
          // This would need a referral tracking system
        }
      });
      return referralCount >= 5;
    
    case 'Community Builder':
      // Check referral count
      const communityReferrals = await prisma.user.count({
        where: {
          // This would need a referral tracking system
        }
      });
      return communityReferrals >= 25;
    
    case 'Early Adopter':
      const totalUsers = await prisma.user.count();
      return totalUsers <= 1000;
    
    case 'Challenge Champion':
      const challengesWon = await prisma.challengeParticipant.count({
        where: {
          userId: user.id,
          rank: 1
        }
      });
      return challengesWon >= 10;
    
    default:
      return false;
  }
}

/**
 * Update achievement
 */
export async function updateAchievement(
  id: string,
  input: Partial<CreateAchievementInput>
): Promise<Achievement> {
  return prisma.achievement.update({
    where: { id },
    data: input
  });
}

/**
 * Delete achievement
 */
export async function deleteAchievement(id: string): Promise<Achievement> {
  // First remove all user achievements
  await prisma.userAchievement.deleteMany({
    where: { achievementId: id }
  });

  return prisma.achievement.delete({
    where: { id }
  });
}

/**
 * Get achievement by name
 */
export async function getAchievementByName(name: string): Promise<Achievement | null> {
  return prisma.achievement.findUnique({
    where: { name }
  });
}

/**
 * Bulk unlock achievements for user
 */
export async function bulkUnlockAchievements(
  userId: string,
  achievementIds: string[]
): Promise<UserAchievement[]> {
  const results: UserAchievement[] = [];

  for (const achievementId of achievementIds) {
    try {
      const userAchievement = await unlockAchievement(userId, achievementId);
      if (userAchievement) {
        results.push(userAchievement);
      }
    } catch (error) {
      console.error(`Failed to unlock achievement ${achievementId} for user ${userId}:`, error);
    }
  }

  return results;
}

/**
 * Get users who have unlocked a specific achievement
 */
export async function getAchievementHolders(
  achievementId: string,
  limit: number = 50
): Promise<Array<{
  userId: string;
  username: string;
  unlockedAt: Date;
}>> {
  const holders = await prisma.userAchievement.findMany({
    where: { achievementId },
    include: {
      user: {
        select: {
          id: true,
          username: true
        }
      }
    },
    orderBy: { unlockedAt: 'asc' },
    take: limit
  });

  return holders.map(holder => ({
    userId: holder.user.id,
    username: holder.user.username,
    unlockedAt: holder.unlockedAt
  }));
}