import { prisma } from './prisma';
import { User, Prisma, WalletProvider, RiskTolerance, PrivacyLevel } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { generateUsername } from '../utils/helpers';

export interface CreateUserInput {
  email: string;
  username?: string;
  firstName?: string;
  lastName?: string;
  password?: string;
  walletAddress: string;
  privateKeyEncrypted: string;
  walletProvider?: WalletProvider;
}

export interface UpdateUserInput {
  firstName?: string;
  lastName?: string;
  bio?: string;
  profileImage?: string;
  dateOfBirth?: Date;
  phoneNumber?: string;
  country?: string;
  timezone?: string;
  savingsGoal?: number;
  monthlyTarget?: number;
  riskTolerance?: RiskTolerance;
  roundUpEnabled?: boolean;
  roundUpAmount?: number;
  notificationsEnabled?: boolean;
  autoInvestEnabled?: boolean;
  autoCompoundEnabled?: boolean;
  privacyLevel?: PrivacyLevel;
  currency?: string;
  language?: string;
  theme?: string;
}

export interface UserWithStats extends User {
  _count: {
    savingsTransactions: number;
    achievements: number;
    challengesCreated: number;
    challengeParticipations: number;
    friendships: number;
  };
}

/**
 * Create a new user
 */
export async function createUser(input: CreateUserInput): Promise<User> {
  const { email, password, walletAddress, privateKeyEncrypted, ...userData } = input;
  
  // Check if user already exists
  const existingUser = await prisma.user.findFirst({
    where: {
      OR: [
        { email },
        { walletAddress },
        ...(userData.username ? [{ username: userData.username }] : [])
      ]
    }
  });

  if (existingUser) {
    if (existingUser.email === email) {
      throw new Error('User with this email already exists');
    }
    if (existingUser.walletAddress === walletAddress) {
      throw new Error('User with this wallet address already exists');
    }
    if (existingUser.username === userData.username) {
      throw new Error('Username already taken');
    }
  }

  // Generate username if not provided
  const username = userData.username || generateUsername();

  // Hash password if provided
  let passwordHash: string | undefined;
  if (password) {
    passwordHash = await bcrypt.hash(password, 12);
  }

  return prisma.user.create({
    data: {
      email,
      username,
      passwordHash,
      walletAddress,
      privateKeyEncrypted,
      walletProvider: userData.walletProvider || WalletProvider.METAMASK,
      firstName: userData.firstName,
      lastName: userData.lastName,
    }
  });
}

/**
 * Get user by ID with optional relations
 */
export async function getUserById(
  id: string, 
  includeRelations: boolean = false
): Promise<User | null> {
  return prisma.user.findUnique({
    where: { id },
    include: includeRelations ? {
      savingsTransactions: {
        orderBy: { createdAt: 'desc' },
        take: 10
      },
      achievements: {
        include: { achievement: true }
      },
      challengeParticipations: {
        include: { challenge: true }
      },
      friendships: {
        include: { friend: true }
      },
      notifications: {
        where: { read: false },
        orderBy: { createdAt: 'desc' },
        take: 5
      }
    } : undefined
  });
}

/**
 * Get user by email
 */
export async function getUserByEmail(email: string): Promise<User | null> {
  return prisma.user.findUnique({
    where: { email }
  });
}

/**
 * Get user by wallet address
 */
export async function getUserByWalletAddress(walletAddress: string): Promise<User | null> {
  return prisma.user.findUnique({
    where: { walletAddress }
  });
}

/**
 * Get user by username
 */
export async function getUserByUsername(username: string): Promise<User | null> {
  return prisma.user.findUnique({
    where: { username }
  });
}

/**
 * Update user information
 */
export async function updateUser(id: string, input: UpdateUserInput): Promise<User> {
  return prisma.user.update({
    where: { id },
    data: {
      ...input,
      updatedAt: new Date()
    }
  });
}

/**
 * Update user's last login time
 */
export async function updateLastLogin(id: string): Promise<User> {
  return prisma.user.update({
    where: { id },
    data: {
      lastLoginAt: new Date()
    }
  });
}

/**
 * Verify user's password
 */
export async function verifyPassword(email: string, password: string): Promise<User | null> {
  const user = await prisma.user.findUnique({
    where: { email }
  });

  if (!user || !user.passwordHash) {
    return null;
  }

  const isValid = await bcrypt.compare(password, user.passwordHash);
  return isValid ? user : null;
}

/**
 * Update user's gamification stats
 */
export async function updateUserStats(
  id: string,
  stats: {
    totalPoints?: number;
    level?: number;
    currentStreak?: number;
    longestStreak?: number;
    totalSaved?: number;
    totalYieldEarned?: number;
    lastActivityDate?: Date;
  }
): Promise<User> {
  return prisma.user.update({
    where: { id },
    data: {
      ...stats,
      updatedAt: new Date()
    }
  });
}

/**
 * Get user with comprehensive stats
 */
export async function getUserWithStats(id: string): Promise<UserWithStats | null> {
  return prisma.user.findUnique({
    where: { id },
    include: {
      _count: {
        select: {
          savingsTransactions: true,
          achievements: true,
          challengesCreated: true,
          challengeParticipations: true,
          friendships: true
        }
      }
    }
  }) as Promise<UserWithStats | null>;
}

/**
 * Search users by username or email
 */
export async function searchUsers(
  query: string,
  limit: number = 10,
  excludeUserId?: string
): Promise<User[]> {
  return prisma.user.findMany({
    where: {
      AND: [
        {
          OR: [
            { username: { contains: query, mode: 'insensitive' } },
            { email: { contains: query, mode: 'insensitive' } },
            { firstName: { contains: query, mode: 'insensitive' } },
            { lastName: { contains: query, mode: 'insensitive' } }
          ]
        },
        excludeUserId ? { id: { not: excludeUserId } } : {},
        { isActive: true }
      ]
    },
    select: {
      id: true,
      username: true,
      firstName: true,
      lastName: true,
      profileImage: true,
      level: true,
      totalPoints: true,
      privacyLevel: true
    },
    take: limit,
    orderBy: [
      { totalPoints: 'desc' },
      { createdAt: 'desc' }
    ]
  });
}

/**
 * Get leaderboard users
 */
export async function getLeaderboard(
  type: 'points' | 'savings' | 'streak' = 'points',
  limit: number = 10
): Promise<User[]> {
  const orderBy = {
    points: { totalPoints: 'desc' as const },
    savings: { totalSaved: 'desc' as const },
    streak: { longestStreak: 'desc' as const }
  };

  return prisma.user.findMany({
    where: {
      isActive: true,
      privacyLevel: { not: PrivacyLevel.PRIVATE }
    },
    select: {
      id: true,
      username: true,
      firstName: true,
      lastName: true,
      profileImage: true,
      level: true,
      totalPoints: true,
      totalSaved: true,
      currentStreak: true,
      longestStreak: true
    },
    orderBy: orderBy[type],
    take: limit
  });
}

/**
 * Deactivate user account
 */
export async function deactivateUser(id: string): Promise<User> {
  return prisma.user.update({
    where: { id },
    data: {
      isActive: false,
      updatedAt: new Date()
    }
  });
}

/**
 * Reactivate user account
 */
export async function reactivateUser(id: string): Promise<User> {
  return prisma.user.update({
    where: { id },
    data: {
      isActive: true,
      updatedAt: new Date()
    }
  });
}

/**
 * Delete user account (soft delete by deactivating)
 */
export async function deleteUser(id: string): Promise<User> {
  // In production, you might want to anonymize data instead of hard delete
  return deactivateUser(id);
}

/**
 * Get user statistics summary
 */
export async function getUserStatsSummary(id: string) {
  const user = await prisma.user.findUnique({
    where: { id },
    select: {
      totalPoints: true,
      level: true,
      currentStreak: true,
      longestStreak: true,
      totalSaved: true,
      totalYieldEarned: true,
      lastActivityDate: true
    }
  });

  if (!user) return null;

  // Get additional computed stats
  const [
    totalTransactions,
    achievementCount,
    challengesWon,
    friendCount
  ] = await Promise.all([
    prisma.savingsTransaction.count({
      where: { userId: id, status: 'CONFIRMED' }
    }),
    prisma.userAchievement.count({
      where: { userId: id }
    }),
    prisma.challengeParticipant.count({
      where: { userId: id, rank: 1 }
    }),
    prisma.friendship.count({
      where: { 
        OR: [
          { userId: id, status: 'ACCEPTED' },
          { friendId: id, status: 'ACCEPTED' }
        ]
      }
    })
  ]);

  return {
    ...user,
    totalTransactions,
    achievementCount,
    challengesWon,
    friendCount
  };
}

/**
 * Check if username is available
 */
export async function isUsernameAvailable(username: string, excludeUserId?: string): Promise<boolean> {
  const existingUser = await prisma.user.findUnique({
    where: { username }
  });

  if (!existingUser) return true;
  if (excludeUserId && existingUser.id === excludeUserId) return true;
  
  return false;
}

/**
 * Update user's wallet information
 */
export async function updateUserWallet(
  id: string,
  walletAddress: string,
  privateKeyEncrypted: string,
  walletProvider: WalletProvider
): Promise<User> {
  // Check if wallet address is already in use
  const existingUser = await prisma.user.findFirst({
    where: {
      walletAddress,
      id: { not: id }
    }
  });

  if (existingUser) {
    throw new Error('Wallet address already in use');
  }

  return prisma.user.update({
    where: { id },
    data: {
      walletAddress,
      privateKeyEncrypted,
      walletProvider,
      updatedAt: new Date()
    }
  });
}