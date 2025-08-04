import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting database seed...');

  // Create achievements
  console.log('Creating achievements...');
  const achievements = [
    {
      name: 'First Save',
      description: 'Make your first deposit',
      icon: '🎯',
      category: 'SAVINGS',
      rarity: 'COMMON',
      pointsReward: 100
    },
    {
      name: 'Century Club',
      description: 'Save $100',
      icon: '💯',
      category: 'SAVINGS',
      rarity: 'COMMON',
      pointsReward: 500
    },
    {
      name: 'Thousand Club',
      description: 'Save $1000',
      icon: '🏆',
      category: 'SAVINGS',
      rarity: 'RARE',
      pointsReward: 1000
    },
    {
      name: 'Week Warrior',
      description: '7-day saving streak',
      icon: '🔥',
      category: 'STREAK',
      rarity: 'COMMON',
      pointsReward: 200
    },
    {
      name: 'Month Master',
      description: '30-day saving streak',
      icon: '📅',
      category: 'STREAK',
      rarity: 'RARE',
      pointsReward: 1000
    },
    {
      name: 'Year Champion',
      description: '365-day saving streak',
      icon: '👑',
      category: 'STREAK',
      rarity: 'LEGENDARY',
      pointsReward: 5000
    },
    {
      name: 'Social Butterfly',
      description: 'Refer 5 friends',
      icon: '🦋',
      category: 'SOCIAL',
      rarity: 'COMMON',
      pointsReward: 300
    },
    {
      name: 'Community Builder',
      description: 'Refer 25 friends',
      icon: '🏗️',
      category: 'SOCIAL',
      rarity: 'EPIC',
      pointsReward: 1500
    },
    {
      name: 'Early Adopter',
      description: 'Join in first 1000 users',
      icon: '🚀',
      category: 'SPECIAL',
      rarity: 'RARE',
      pointsReward: 1000
    },
    {
      name: 'Challenge Champion',
      description: 'Win 10 challenges',
      icon: '🏅',
      category: 'SPECIAL',
      rarity: 'EPIC',
      pointsReward: 2000
    }
  ];

  for (const achievement of achievements) {
    await prisma.achievement.upsert({
      where: { name: achievement.name },
      update: {},
      create: achievement as any
    });
  }

  // Create demo users
  console.log('Creating demo users...');
  const demoUsers = [
    {
      email: 'alice@morphsave.com',
      username: 'alice_saver',
      firstName: 'Alice',
      lastName: 'Johnson',
      walletAddress: '0x1234567890123456789012345678901234567890',
      privateKeyEncrypted: 'encrypted_key_alice',
      totalSaved: 1250.50,
      totalPoints: 1800,
      level: 3,
      currentStreak: 15,
      longestStreak: 45,
      isVerified: true
    },
    {
      email: 'bob@morphsave.com',
      username: 'bob_investor',
      firstName: 'Bob',
      lastName: 'Smith',
      walletAddress: '0x2345678901234567890123456789012345678901',
      privateKeyEncrypted: 'encrypted_key_bob',
      totalSaved: 850.25,
      totalPoints: 1200,
      level: 2,
      currentStreak: 8,
      longestStreak: 22,
      isVerified: true
    },
    {
      email: 'carol@morphsave.com',
      username: 'carol_champion',
      firstName: 'Carol',
      lastName: 'Davis',
      walletAddress: '0x3456789012345678901234567890123456789012',
      privateKeyEncrypted: 'encrypted_key_carol',
      totalSaved: 2100.75,
      totalPoints: 2500,
      level: 4,
      currentStreak: 32,
      longestStreak: 67,
      isVerified: true
    }
  ];

  const createdUsers = [];
  for (const userData of demoUsers) {
    const user = await prisma.user.upsert({
      where: { email: userData.email },
      update: {},
      create: userData
    });
    createdUsers.push(user);
  }

  // Create sample savings transactions
  console.log('Creating sample transactions...');
  for (const user of createdUsers) {
    // Create some round-up transactions
    for (let i = 0; i < 10; i++) {
      await prisma.savingsTransaction.create({
        data: {
          userId: user.id,
          type: 'ROUNDUP',
          amount: Math.random() * 5 + 0.5, // $0.50 - $5.50
          currency: 'USD',
          status: 'CONFIRMED',
          originalTransactionAmount: Math.random() * 50 + 10, // $10 - $60
          merchant: ['Starbucks', 'Amazon', 'Uber', 'McDonald\'s', 'Target'][Math.floor(Math.random() * 5)],
          category: ['Food', 'Shopping', 'Transportation', 'Entertainment'][Math.floor(Math.random() * 4)],
          blockchainTxHash: `0x${Math.random().toString(16).substr(2, 64)}`,
          createdAt: new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000) // Last 30 days
        }
      });
    }

    // Create some manual deposits
    for (let i = 0; i < 3; i++) {
      await prisma.savingsTransaction.create({
        data: {
          userId: user.id,
          type: 'MANUAL',
          amount: Math.random() * 100 + 50, // $50 - $150
          currency: 'USD',
          status: 'CONFIRMED',
          blockchainTxHash: `0x${Math.random().toString(16).substr(2, 64)}`,
          createdAt: new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000)
        }
      });
    }
  }

  // Assign achievements to users
  console.log('Assigning achievements...');
  const allAchievements = await prisma.achievement.findMany();
  
  for (const user of createdUsers) {
    // Give each user some achievements based on their stats
    const userAchievements = [];
    
    if (user.totalSaved >= 1) userAchievements.push(allAchievements.find(a => a.name === 'First Save'));
    if (user.totalSaved >= 100) userAchievements.push(allAchievements.find(a => a.name === 'Century Club'));
    if (user.totalSaved >= 1000) userAchievements.push(allAchievements.find(a => a.name === 'Thousand Club'));
    if (user.longestStreak >= 7) userAchievements.push(allAchievements.find(a => a.name === 'Week Warrior'));
    if (user.longestStreak >= 30) userAchievements.push(allAchievements.find(a => a.name === 'Month Master'));
    
    for (const achievement of userAchievements) {
      if (achievement) {
        await prisma.userAchievement.upsert({
          where: {
            userId_achievementId: {
              userId: user.id,
              achievementId: achievement.id
            }
          },
          update: {},
          create: {
            userId: user.id,
            achievementId: achievement.id,
            unlockedAt: new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000)
          }
        });
      }
    }
  }

  // Create sample challenges
  console.log('Creating sample challenges...');
  const challenges = [
    {
      creatorId: createdUsers[0].id,
      title: 'Save $500 in 30 Days',
      description: 'Challenge yourself to save $500 in the next 30 days through round-ups and manual deposits!',
      type: 'SAVINGS_AMOUNT',
      targetAmount: 500,
      duration: 30,
      startDate: new Date(),
      endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      status: 'ACTIVE'
    },
    {
      creatorId: createdUsers[1].id,
      title: '21-Day Streak Challenge',
      description: 'Build a consistent saving habit with a 21-day streak!',
      type: 'STREAK',
      targetAmount: 21,
      duration: 25,
      startDate: new Date(),
      endDate: new Date(Date.now() + 25 * 24 * 60 * 60 * 1000),
      status: 'ACTIVE'
    }
  ];

  for (const challengeData of challenges) {
    const challenge = await prisma.challenge.create({
      data: challengeData
    });

    // Add participants to challenges
    for (const user of createdUsers) {
      await prisma.challengeParticipant.create({
        data: {
          userId: user.id,
          challengeId: challenge.id,
          currentProgress: Math.random() * challengeData.targetAmount * 0.7, // 0-70% progress
          rank: null
        }
      });
    }
  }

  // Create friendships
  console.log('Creating friendships...');
  await prisma.friendship.create({
    data: {
      userId: createdUsers[0].id,
      friendId: createdUsers[1].id,
      status: 'ACCEPTED',
      acceptedAt: new Date()
    }
  });

  await prisma.friendship.create({
    data: {
      userId: createdUsers[1].id,
      friendId: createdUsers[2].id,
      status: 'ACCEPTED',
      acceptedAt: new Date()
    }
  });

  await prisma.friendship.create({
    data: {
      userId: createdUsers[0].id,
      friendId: createdUsers[2].id,
      status: 'PENDING'
    }
  });

  // Create sample notifications
  console.log('Creating notifications...');
  for (const user of createdUsers) {
    await prisma.notification.create({
      data: {
        userId: user.id,
        type: 'ACHIEVEMENT',
        title: 'Achievement Unlocked!',
        message: 'Congratulations! You\'ve unlocked the "First Save" achievement.',
        data: { achievementId: allAchievements[0].id },
        read: false
      }
    });

    await prisma.notification.create({
      data: {
        userId: user.id,
        type: 'SAVINGS',
        title: 'Round-up Processed',
        message: 'Your latest round-up of $2.50 has been processed and invested.',
        data: { amount: 2.50 },
        read: Math.random() > 0.5
      }
    });
  }

  console.log('✅ Database seeded successfully!');
  console.log(`Created ${createdUsers.length} demo users`);
  console.log(`Created ${achievements.length} achievements`);
  console.log(`Created ${challenges.length} challenges`);
}

main()
  .catch((e) => {
    console.error('❌ Error seeding database:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });