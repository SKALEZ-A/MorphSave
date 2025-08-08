import { PrismaClient } from '@prisma/client';
import { faker } from '@faker-js/faker';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

interface DemoUser {
  email: string;
  username: string;
  password: string;
  scenario: string;
  level: number;
  totalPoints: number;
  totalSaved: number;
  currentStreak: number;
}

const DEMO_USERS: DemoUser[] = [
  {
    email: 'sarah.saver@demo.com',
    username: 'SarahSaver',
    password: 'Demo123!',
    scenario: 'Power User - High engagement, multiple achievements',
    level: 15,
    totalPoints: 12500,
    totalSaved: 2847.50,
    currentStreak: 45
  },
  {
    email: 'mike.newbie@demo.com',
    username: 'MikeNewbie',
    password: 'Demo123!',
    scenario: 'New User - Just started, first achievements',
    level: 2,
    totalPoints: 150,
    totalSaved: 23.75,
    currentStreak: 3
  },
  {
    email: 'alex.social@demo.com',
    username: 'AlexSocial',
    password: 'Demo123!',
    scenario: 'Social Leader - Creates challenges, has many friends',
    level: 8,
    totalPoints: 4200,
    totalSaved: 1156.25,
    currentStreak: 12
  },
  {
    email: 'emma.consistent@demo.com',
    username: 'EmmaConsistent',
    password: 'Demo123!',
    scenario: 'Consistent Saver - Long streaks, steady growth',
    level: 12,
    totalPoints: 8900,
    totalSaved: 3421.80,
    currentStreak: 89
  }
];

const DEMO_ACHIEVEMENTS = [
  {
    name: 'First Steps',
    description: 'Complete your first round-up transaction',
    category: 'savings',
    rarity: 'common',
    points: 50
  },
  {
    name: 'Century Club',
    description: 'Save your first $100',
    category: 'savings',
    rarity: 'common',
    points: 100
  },
  {
    name: 'Streak Master',
    description: 'Maintain a 30-day savings streak',
    category: 'streak',
    rarity: 'rare',
    points: 500
  },
  {
    name: 'Social Butterfly',
    description: 'Add 10 friends to your network',
    category: 'social',
    rarity: 'rare',
    points: 300
  },
  {
    name: 'Challenge Champion',
    description: 'Win 5 savings challenges',
    category: 'social',
    rarity: 'epic',
    points: 1000
  },
  {
    name: 'Thousand Club',
    description: 'Save your first $1,000',
    category: 'savings',
    rarity: 'epic',
    points: 1500
  },
  {
    name: 'Legendary Saver',
    description: 'Save $5,000 total',
    category: 'savings',
    rarity: 'legendary',
    points: 5000
  }
];

async function createDemoData() {
  console.log('🚀 Creating demo data for MorphSave presentation...');

  try {
    // Clear existing demo data
    await prisma.savingsTransaction.deleteMany({
      where: { user: { email: { contains: '@demo.com' } } }
    });
    await prisma.challengeParticipant.deleteMany({
      where: { user: { email: { contains: '@demo.com' } } }
    });
    await prisma.userAchievement.deleteMany({
      where: { user: { email: { contains: '@demo.com' } } }
    });
    await prisma.friendship.deleteMany({
      where: { 
        OR: [
          { user: { email: { contains: '@demo.com' } } },
          { friend: { email: { contains: '@demo.com' } } }
        ]
      }
    });
    await prisma.user.deleteMany({
      where: { email: { contains: '@demo.com' } }
    });

    // Create achievements
    console.log('📊 Creating achievements...');
    for (const achievement of DEMO_ACHIEVEMENTS) {
      await prisma.achievement.upsert({
        where: { name: achievement.name },
        update: achievement,
        create: {
          id: faker.string.uuid(),
          ...achievement,
          icon: `achievement-${achievement.category}`,
          createdAt: new Date(),
          updatedAt: new Date()
        }
      });
    }

    // Create demo users
    console.log('👥 Creating demo users...');
    const createdUsers = [];
    
    for (const demoUser of DEMO_USERS) {
      const hashedPassword = await bcrypt.hash(demoUser.password, 10);
      const walletAddress = faker.finance.ethereumAddress();
      
      const user = await prisma.user.create({
        data: {
          id: faker.string.uuid(),
          email: demoUser.email,
          username: demoUser.username,
          passwordHash: hashedPassword,
          walletAddress,
          level: demoUser.level,
          totalPoints: demoUser.totalPoints,
          totalSaved: demoUser.totalSaved,
          currentStreak: demoUser.currentStreak,
          longestStreak: Math.max(demoUser.currentStreak, faker.number.int({ min: 10, max: 100 })),
          roundUpEnabled: true,
          roundUpAmount: faker.helpers.arrayElement([1, 2, 3, 5]),
          autoInvestEnabled: true,
          createdAt: faker.date.past({ years: 1 }),
          updatedAt: new Date()
        }
      });
      
      createdUsers.push({ ...user, scenario: demoUser.scenario });
    }

    // Create savings transactions for each user
    console.log('💰 Creating savings transactions...');
    for (const user of createdUsers) {
      const transactionCount = faker.number.int({ min: 20, max: 150 });
      
      for (let i = 0; i < transactionCount; i++) {
        const transactionDate = faker.date.between({
          from: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000), // 90 days ago
          to: new Date()
        });
        
        await prisma.savingsTransaction.create({
          data: {
            id: faker.string.uuid(),
            userId: user.id,
            type: faker.helpers.arrayElement(['roundup', 'manual', 'yield']),
            amount: faker.number.float({ min: 0.25, max: 25.00, fractionDigits: 2 }),
            currency: 'USD',
            blockchainTxHash: faker.string.hexadecimal({ length: 64 }),
            status: 'confirmed',
            originalTransactionAmount: faker.number.float({ min: 5, max: 150, fractionDigits: 2 }),
            merchantName: faker.company.name(),
            category: faker.helpers.arrayElement(['food', 'transport', 'shopping', 'entertainment', 'utilities']),
            createdAt: transactionDate,
            updatedAt: transactionDate
          }
        });
      }
    }

    // Create user achievements
    console.log('🏆 Assigning achievements to users...');
    const achievements = await prisma.achievement.findMany();
    
    for (const user of createdUsers) {
      const userAchievements = achievements.filter(() => 
        faker.datatype.boolean({ probability: user.level * 0.1 })
      );
      
      for (const achievement of userAchievements) {
        await prisma.userAchievement.create({
          data: {
            id: faker.string.uuid(),
            userId: user.id,
            achievementId: achievement.id,
            unlockedAt: faker.date.past({ years: 1 }),
            createdAt: new Date(),
            updatedAt: new Date()
          }
        });
      }
    }

    // Create friendships between demo users
    console.log('👫 Creating friendships...');
    for (let i = 0; i < createdUsers.length; i++) {
      for (let j = i + 1; j < createdUsers.length; j++) {
        if (faker.datatype.boolean({ probability: 0.7 })) {
          await prisma.friendship.create({
            data: {
              id: faker.string.uuid(),
              userId: createdUsers[i].id,
              friendId: createdUsers[j].id,
              status: 'accepted',
              createdAt: faker.date.past({ years: 1 }),
              updatedAt: new Date()
            }
          });
        }
      }
    }

    // Create demo challenges
    console.log('🎯 Creating demo challenges...');
    const challenges = [
      {
        title: 'January Savings Sprint',
        description: 'Save $200 in January through round-ups and manual deposits',
        type: 'savings_amount',
        targetAmount: 200,
        duration: 31,
        status: 'completed'
      },
      {
        title: 'Coffee Challenge',
        description: 'Skip coffee purchases and save the money instead',
        type: 'streak',
        targetAmount: 0,
        duration: 14,
        status: 'active'
      },
      {
        title: 'Friends Savings Circle',
        description: 'Group challenge to save $500 collectively',
        type: 'social',
        targetAmount: 500,
        duration: 30,
        status: 'active'
      }
    ];

    for (const challengeData of challenges) {
      const challenge = await prisma.challenge.create({
        data: {
          id: faker.string.uuid(),
          creatorId: createdUsers[0].id, // Sarah as creator
          title: challengeData.title,
          description: challengeData.description,
          type: challengeData.type as any,
          targetAmount: challengeData.targetAmount,
          duration: challengeData.duration,
          startDate: faker.date.past({ days: 30 }),
          endDate: faker.date.future({ days: challengeData.duration }),
          status: challengeData.status as any,
          createdAt: new Date(),
          updatedAt: new Date()
        }
      });

      // Add participants to challenges
      const participantCount = faker.number.int({ min: 2, max: 4 });
      const participants = faker.helpers.arrayElements(createdUsers, participantCount);
      
      for (const participant of participants) {
        await prisma.challengeParticipant.create({
          data: {
            id: faker.string.uuid(),
            challengeId: challenge.id,
            userId: participant.id,
            currentProgress: faker.number.float({ 
              min: 0, 
              max: challengeData.targetAmount || 100,
              fractionDigits: 2 
            }),
            joinedAt: faker.date.past({ days: 20 }),
            createdAt: new Date(),
            updatedAt: new Date()
          }
        });
      }
    }

    console.log('✅ Demo data created successfully!');
    console.log('\n📋 Demo User Scenarios:');
    DEMO_USERS.forEach(user => {
      console.log(`  • ${user.username} (${user.email}): ${user.scenario}`);
    });
    
    console.log('\n🔑 All demo users have password: Demo123!');
    console.log('\n🎯 Demo includes:');
    console.log('  • 4 user personas with different engagement levels');
    console.log('  • Realistic transaction history (20-150 transactions per user)');
    console.log('  • Achievement unlocks based on user level');
    console.log('  • Friend connections between users');
    console.log('  • Active and completed challenges');
    console.log('  • Varied savings amounts and streaks');

  } catch (error) {
    console.error('❌ Error creating demo data:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

if (require.main === module) {
  createDemoData()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
}

export { createDemoData, DEMO_USERS };