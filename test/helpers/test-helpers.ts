import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'
import { ethers } from 'ethers'

const prisma = new PrismaClient()

export interface TestUser {
  id: string
  email: string
  username: string
  walletAddress: string
  privateKeyEncrypted: string
}

export async function createTestUser(suffix: string = ''): Promise<TestUser> {
  const timestamp = Date.now()
  const userSuffix = suffix ? `-${suffix}` : ''
  
  // Generate wallet
  const wallet = ethers.Wallet.createRandom()
  const hashedPassword = await bcrypt.hash('TestPassword123!', 10)
  
  const user = await prisma.user.create({
    data: {
      email: `test${userSuffix}-${timestamp}@morphsave.com`,
      username: `testuser${userSuffix}${timestamp}`,
      passwordHash: hashedPassword,
      walletAddress: wallet.address,
      privateKeyEncrypted: wallet.privateKey, // In real app, this would be encrypted
      level: 1,
      totalPoints: 0,
      currentStreak: 0,
      longestStreak: 0,
      totalSaved: 0,
      totalYieldEarned: 0,
      roundUpEnabled: true,
      roundUpAmount: 1.0,
      notificationsEnabled: true,
      autoInvestEnabled: true,
      riskTolerance: 'medium'
    }
  })

  return {
    id: user.id,
    email: user.email,
    username: user.username,
    walletAddress: user.walletAddress,
    privateKeyEncrypted: user.privateKeyEncrypted
  }
}

export async function createTestBankAccount(userId: string) {
  return await prisma.bankAccount.create({
    data: {
      userId,
      plaidAccountId: `test-account-${Date.now()}`,
      accountName: 'Test Checking Account',
      accountType: 'depository',
      accountSubtype: 'checking',
      institutionName: 'Test Bank',
      mask: '1234',
      isActive: true
    }
  })
}

export async function createTestSavingsTransaction(userId: string, type: 'roundup' | 'manual' | 'yield' | 'withdrawal' = 'manual') {
  return await prisma.savingsTransaction.create({
    data: {
      userId,
      type,
      amount: type === 'roundup' ? 0.55 : 100.00,
      currency: 'USD',
      blockchainTxHash: `0x${Math.random().toString(16).substr(2, 64)}`,
      status: 'confirmed',
      originalTransactionAmount: type === 'roundup' ? 23.45 : undefined,
      originalTransactionMerchant: type === 'roundup' ? 'Coffee Shop' : undefined,
      originalTransactionCategory: type === 'roundup' ? 'food_and_drink' : undefined,
      yieldProtocol: type === 'yield' ? 'compound' : undefined,
      apy: type === 'yield' ? 5.5 : undefined
    }
  })
}

export async function createTestAchievement(userId: string, achievementType: string = 'first_deposit') {
  return await prisma.userAchievement.create({
    data: {
      userId,
      achievementId: achievementType,
      unlockedAt: new Date(),
      pointsEarned: 100
    }
  })
}

export async function createTestChallenge(creatorId: string) {
  const challenge = await prisma.challenge.create({
    data: {
      creatorId,
      title: 'Test Challenge',
      description: 'A test savings challenge',
      type: 'savings_amount',
      targetAmount: 500,
      duration: 7,
      startDate: new Date(),
      endDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      status: 'active',
      rewards: {
        points: 500,
        badge: 'challenge_creator'
      }
    }
  })

  return challenge
}

export async function createTestFriendship(user1Id: string, user2Id: string) {
  // Create friendship (bidirectional)
  await prisma.friendship.createMany({
    data: [
      {
        userId: user1Id,
        friendId: user2Id,
        status: 'accepted',
        createdAt: new Date()
      },
      {
        userId: user2Id,
        friendId: user1Id,
        status: 'accepted',
        createdAt: new Date()
      }
    ]
  })
}

export async function createTestNotification(userId: string, type: string = 'achievement') {
  return await prisma.notification.create({
    data: {
      userId,
      type,
      title: 'Test Notification',
      message: 'This is a test notification',
      data: { test: true },
      read: false
    }
  })
}

export async function cleanupTestData() {
  // Clean up in reverse dependency order
  await prisma.notification.deleteMany({
    where: {
      OR: [
        { title: { contains: 'Test' } },
        { user: { email: { contains: 'test' } } }
      ]
    }
  })

  await prisma.challengeParticipant.deleteMany({
    where: {
      OR: [
        { user: { email: { contains: 'test' } } },
        { challenge: { title: { contains: 'Test' } } }
      ]
    }
  })

  await prisma.challenge.deleteMany({
    where: {
      OR: [
        { title: { contains: 'Test' } },
        { creator: { email: { contains: 'test' } } }
      ]
    }
  })

  await prisma.friendship.deleteMany({
    where: {
      OR: [
        { user: { email: { contains: 'test' } } },
        { friend: { email: { contains: 'test' } } }
      ]
    }
  })

  await prisma.userAchievement.deleteMany({
    where: {
      user: { email: { contains: 'test' } }
    }
  })

  await prisma.savingsTransaction.deleteMany({
    where: {
      user: { email: { contains: 'test' } }
    }
  })

  await prisma.bankAccount.deleteMany({
    where: {
      user: { email: { contains: 'test' } }
    }
  })

  await prisma.session.deleteMany({
    where: {
      user: { email: { contains: 'test' } }
    }
  })

  await prisma.user.deleteMany({
    where: {
      email: { contains: 'test' }
    }
  })
}

export async function setupTestDatabase() {
  // Create test users with various states
  const users = []
  
  // Basic user
  const basicUser = await createTestUser('basic')
  users.push(basicUser)
  
  // User with savings
  const savingsUser = await createTestUser('savings')
  await createTestBankAccount(savingsUser.id)
  await createTestSavingsTransaction(savingsUser.id, 'manual')
  await createTestSavingsTransaction(savingsUser.id, 'roundup')
  users.push(savingsUser)
  
  // User with achievements
  const achievementUser = await createTestUser('achievements')
  await createTestAchievement(achievementUser.id, 'first_deposit')
  await createTestAchievement(achievementUser.id, 'savings_streak')
  users.push(achievementUser)
  
  // User with social connections
  const socialUser = await createTestUser('social')
  const friendUser = await createTestUser('friend')
  await createTestFriendship(socialUser.id, friendUser.id)
  users.push(socialUser, friendUser)
  
  // User with challenge
  const challengeUser = await createTestUser('challenge')
  await createTestChallenge(challengeUser.id)
  users.push(challengeUser)
  
  return users
}

export function generateMockTransactionData(count: number = 10) {
  const merchants = [
    'Starbucks', 'McDonald\'s', 'Target', 'Amazon', 'Uber',
    'Gas Station', 'Grocery Store', 'Restaurant', 'Coffee Shop', 'Pharmacy'
  ]
  
  const categories = [
    'food_and_drink', 'transportation', 'shopping', 'entertainment',
    'healthcare', 'utilities', 'groceries', 'gas', 'restaurants'
  ]
  
  const transactions = []
  
  for (let i = 0; i < count; i++) {
    transactions.push({
      amount: parseFloat((Math.random() * 100 + 5).toFixed(2)),
      merchant: merchants[Math.floor(Math.random() * merchants.length)],
      category: categories[Math.floor(Math.random() * categories.length)],
      date: new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000)
    })
  }
  
  return transactions
}

export function generateMockAchievements() {
  return [
    {
      id: 'first_deposit',
      name: 'First Deposit',
      description: 'Made your first deposit',
      icon: '💰',
      category: 'savings',
      rarity: 'common',
      requirements: [{ type: 'deposit_count', value: 1 }],
      rewards: { points: 100, badge: 'first_deposit' }
    },
    {
      id: 'hundred_saved',
      name: 'Century Saver',
      description: 'Saved $100',
      icon: '💯',
      category: 'savings',
      rarity: 'common',
      requirements: [{ type: 'total_saved', value: 100 }],
      rewards: { points: 200, badge: 'century_saver' }
    },
    {
      id: 'streak_week',
      name: 'Week Warrior',
      description: 'Maintained a 7-day savings streak',
      icon: '🔥',
      category: 'streak',
      rarity: 'rare',
      requirements: [{ type: 'streak_days', value: 7 }],
      rewards: { points: 300, badge: 'week_warrior' }
    },
    {
      id: 'social_butterfly',
      name: 'Social Butterfly',
      description: 'Added 5 friends',
      icon: '🦋',
      category: 'social',
      rarity: 'rare',
      requirements: [{ type: 'friend_count', value: 5 }],
      rewards: { points: 250, badge: 'social_butterfly' }
    }
  ]
}

export async function waitForBlockchainConfirmation(txHash: string, maxWait: number = 30000) {
  const startTime = Date.now()
  
  while (Date.now() - startTime < maxWait) {
    // In a real implementation, this would check the blockchain
    // For testing, we'll simulate confirmation after a delay
    await new Promise(resolve => setTimeout(resolve, 1000))
    
    if (Math.random() > 0.3) { // 70% chance of confirmation each check
      return {
        confirmed: true,
        blockNumber: Math.floor(Math.random() * 1000000),
        gasUsed: Math.floor(Math.random() * 100000 + 21000)
      }
    }
  }
  
  throw new Error('Transaction confirmation timeout')
}

export function mockWebSocketConnection() {
  const events: any[] = []
  
  return {
    emit: (event: string, data: any) => {
      events.push({ event, data, timestamp: Date.now() })
    },
    on: (event: string, callback: Function) => {
      // Mock event listener
    },
    getEvents: () => events,
    clearEvents: () => events.length = 0
  }
}

export function createMockAIResponse(type: 'analysis' | 'recommendation' | 'projection') {
  switch (type) {
    case 'analysis':
      return {
        categories: {
          food_and_drink: { amount: 250, percentage: 25 },
          transportation: { amount: 200, percentage: 20 },
          shopping: { amount: 300, percentage: 30 },
          entertainment: { amount: 150, percentage: 15 },
          other: { amount: 100, percentage: 10 }
        },
        trends: {
          monthly_change: 5.2,
          category_changes: {
            food_and_drink: -2.1,
            transportation: 8.5,
            shopping: 3.2
          }
        },
        insights: [
          'Your food spending has decreased by 2.1% this month',
          'Transportation costs are up 8.5% - consider carpooling',
          'You\'re on track to save $50 more than last month'
        ]
      }
    
    case 'recommendation':
      return [
        {
          id: 'reduce_food_spending',
          title: 'Reduce Food Spending',
          description: 'You could save $30/month by cooking at home 2 more times per week',
          impact: 30,
          difficulty: 'easy',
          category: 'food_and_drink'
        },
        {
          id: 'increase_roundups',
          title: 'Increase Round-ups',
          description: 'Increasing round-ups to $2 could save an extra $25/month',
          impact: 25,
          difficulty: 'easy',
          category: 'savings'
        }
      ]
    
    case 'projection':
      return {
        conservative: {
          oneMonth: 125,
          threeMonths: 400,
          sixMonths: 850,
          oneYear: 1800
        },
        realistic: {
          oneMonth: 150,
          threeMonths: 500,
          sixMonths: 1100,
          oneYear: 2400
        },
        optimistic: {
          oneMonth: 200,
          threeMonths: 650,
          sixMonths: 1400,
          oneYear: 3200
        }
      }
  }
}