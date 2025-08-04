const { createUser } = require('../lib/db/user');
const { 
  createAchievement,
  unlockAchievement,
  getUserAchievements,
  getUserAchievementStats
} = require('../lib/db/achievements');
const {
  createChallenge,
  joinChallenge,
  updateChallengeProgress,
  getChallengeById,
  getActiveChallenges
} = require('../lib/db/challenges');
const {
  sendFriendRequest,
  acceptFriendRequest,
  getUserFriends,
  getFriendSuggestions
} = require('../lib/db/social');
const {
  createNotification,
  getUserNotifications,
  getUserNotificationStats
} = require('../lib/db/notifications');

async function testSocialAndGamification() {
  console.log('🧪 Testing social and gamification systems...');

  try {
    // Create test users
    console.log('Creating test users...');
    const users = [];
    for (let i = 1; i <= 3; i++) {
      const user = await createUser({
        email: `social-test-${i}@morphsave.com`,
        username: `social_user_${i}`,
        firstName: `Social${i}`,
        lastName: 'Tester',
        walletAddress: `0x${i.toString().repeat(40)}`,
        privateKeyEncrypted: `encrypted_social_key_${i}`
      });
      users.push(user);
    }
    console.log('✅ Users created:', users.map(u => u.username));

    // Test Achievements System
    console.log('\n🏆 Testing Achievements System...');
    
    // Create achievements
    const achievements = [];
    const achievementData = [
      { name: 'First Save', description: 'Make your first deposit', icon: '🎯', category: 'SAVINGS', rarity: 'COMMON', pointsReward: 100 },
      { name: 'Social Butterfly', description: 'Add 5 friends', icon: '🦋', category: 'SOCIAL', rarity: 'RARE', pointsReward: 300 },
      { name: 'Challenge Master', description: 'Win 3 challenges', icon: '👑', category: 'SPECIAL', rarity: 'EPIC', pointsReward: 500 }
    ];

    for (const data of achievementData) {
      const achievement = await createAchievement(data);
      achievements.push(achievement);
    }
    console.log('✅ Achievements created:', achievements.map(a => a.name));

    // Unlock achievements for users
    await unlockAchievement(users[0].id, achievements[0].id);
    await unlockAchievement(users[0].id, achievements[1].id);
    console.log('✅ Achievements unlocked for user 1');

    // Get user achievements
    const userAchievements = await getUserAchievements(users[0].id);
    const unlockedCount = userAchievements.filter(ua => ua.isUnlocked).length;
    console.log('✅ User achievements retrieved:', { total: userAchievements.length, unlocked: unlockedCount });

    // Get achievement stats
    const achievementStats = await getUserAchievementStats(users[0].id);
    console.log('✅ Achievement stats:', {
      completionRate: `${achievementStats.completionRate.toFixed(1)}%`,
      totalPoints: achievementStats.totalPointsEarned
    });

    // Test Challenges System
    console.log('\n🎯 Testing Challenges System...');
    
    // Create challenge
    const challenge = await createChallenge({
      creatorId: users[0].id,
      title: 'Save $500 Challenge',
      description: 'Save $500 in 30 days through any means',
      type: 'SAVINGS_AMOUNT',
      targetAmount: 500,
      duration: 30
    });
    console.log('✅ Challenge created:', challenge.title);

    // Other users join the challenge
    await joinChallenge(challenge.id, users[1].id);
    await joinChallenge(challenge.id, users[2].id);
    console.log('✅ Users joined challenge');

    // Update progress
    await updateChallengeProgress(challenge.id, users[1].id, 250);
    await updateChallengeProgress(challenge.id, users[2].id, 150);
    console.log('✅ Challenge progress updated');

    // Get challenge details
    const challengeDetails = await getChallengeById(challenge.id);
    console.log('✅ Challenge details:', {
      title: challengeDetails.title,
      participants: challengeDetails.participantCount,
      topProgress: Math.max(...challengeDetails.participants.map(p => p.currentProgress))
    });

    // Get active challenges
    const activeChallenges = await getActiveChallenges(1, 10);
    console.log('✅ Active challenges retrieved:', activeChallenges.challenges.length);

    // Test Social System
    console.log('\n👥 Testing Social System...');
    
    // Send friend requests
    const friendship1 = await sendFriendRequest(users[0].id, users[1].id);
    const friendship2 = await sendFriendRequest(users[0].id, users[2].id);
    console.log('✅ Friend requests sent');

    // Accept friend requests
    await acceptFriendRequest(users[1].id, friendship1.id);
    await acceptFriendRequest(users[2].id, friendship2.id);
    console.log('✅ Friend requests accepted');

    // Get user friends
    const friends = await getUserFriends(users[0].id);
    console.log('✅ Friends retrieved:', {
      count: friends.length,
      friends: friends.map(f => f.friend.username)
    });

    // Get friend suggestions
    const suggestions = await getFriendSuggestions(users[1].id, 5);
    console.log('✅ Friend suggestions:', suggestions.length);

    // Test Notifications System
    console.log('\n🔔 Testing Notifications System...');
    
    // Create various notifications
    await createNotification({
      userId: users[0].id,
      type: 'ACHIEVEMENT',
      title: 'Achievement Unlocked!',
      message: 'You unlocked the "First Save" achievement!',
      data: { achievementId: achievements[0].id }
    });

    await createNotification({
      userId: users[0].id,
      type: 'CHALLENGE',
      title: 'Challenge Update',
      message: 'Someone joined your challenge!',
      data: { challengeId: challenge.id }
    });

    await createNotification({
      userId: users[0].id,
      type: 'SOCIAL',
      title: 'New Friend',
      message: 'Your friend request was accepted!',
      data: { friendId: users[1].id }
    });

    console.log('✅ Notifications created');

    // Get user notifications
    const notifications = await getUserNotifications(users[0].id);
    console.log('✅ Notifications retrieved:', {
      total: notifications.total,
      unread: notifications.unread,
      types: [...new Set(notifications.notifications.map(n => n.type))]
    });

    // Get notification stats
    const notificationStats = await getUserNotificationStats(users[0].id);
    console.log('✅ Notification stats:', {
      total: notificationStats.total,
      unread: notificationStats.unread,
      recentActivity: notificationStats.recentActivity
    });

    // Integration Test
    console.log('\n🔗 Testing System Integration...');
    
    // Create a new user and test the full flow
    const newUser = await createUser({
      email: 'integration-test@morphsave.com',
      username: 'integration_user',
      firstName: 'Integration',
      lastName: 'Test',
      walletAddress: '0x9999999999999999999999999999999999999999',
      privateKeyEncrypted: 'encrypted_integration_key'
    });

    // New user unlocks achievement (should create notification)
    await unlockAchievement(newUser.id, achievements[0].id);
    
    // New user joins challenge (should create notification for challenge creator)
    await joinChallenge(challenge.id, newUser.id);
    
    // Check if notifications were created
    const newUserNotifications = await getUserNotifications(newUser.id);
    const challengeCreatorNotifications = await getUserNotifications(users[0].id);
    
    console.log('✅ Integration test completed:', {
      newUserNotifications: newUserNotifications.total,
      challengeCreatorNotifications: challengeCreatorNotifications.total
    });

    console.log('\n🎉 All social and gamification tests passed!');

  } catch (error) {
    console.error('❌ Social and gamification test failed:', error);
  }
}

testSocialAndGamification()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });