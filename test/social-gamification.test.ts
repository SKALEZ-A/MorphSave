const { PrismaClient } = require('@prisma/client');
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
  getChallengeById
} = require('../lib/db/challenges');
const {
  sendFriendRequest,
  acceptFriendRequest,
  getUserFriends,
  getFriendshipStatus
} = require('../lib/db/social');
const {
  createNotification,
  getUserNotifications,
  markNotificationAsRead
} = require('../lib/db/notifications');

const prisma = new PrismaClient();

describe('Social and Gamification Systems', () => {
  let testUsers = [];

  beforeEach(async () => {
    // Clean up test data
    await prisma.notification.deleteMany();
    await prisma.challengeParticipant.deleteMany();
    await prisma.challenge.deleteMany();
    await prisma.friendship.deleteMany();
    await prisma.userAchievement.deleteMany();
    await prisma.achievement.deleteMany();
    await prisma.user.deleteMany();

    // Create test users
    testUsers = [];
    for (let i = 1; i <= 3; i++) {
      const user = await createUser({
        email: `user${i}@test.com`,
        username: `user${i}`,
        firstName: `User${i}`,
        walletAddress: `0x${i.toString().repeat(40)}`,
        privateKeyEncrypted: `encrypted_key_${i}`
      });
      testUsers.push(user);
    }
  });

  afterEach(async () => {
    // Clean up test data
    await prisma.notification.deleteMany();
    await prisma.challengeParticipant.deleteMany();
    await prisma.challenge.deleteMany();
    await prisma.friendship.deleteMany();
    await prisma.userAchievement.deleteMany();
    await prisma.achievement.deleteMany();
    await prisma.user.deleteMany();
  });

  describe('Achievements System', () => {
    it('should create and unlock achievements', async () => {
      // Create achievement
      const achievement = await createAchievement({
        name: 'Test Achievement',
        description: 'A test achievement',
        icon: '🏆',
        category: 'SAVINGS',
        rarity: 'COMMON',
        pointsReward: 100
      });

      expect(achievement.name).toBe('Test Achievement');
      expect(achievement.pointsReward).toBe(100);

      // Unlock achievement for user
      const userAchievement = await unlockAchievement(testUsers[0].id, achievement.id);

      expect(userAchievement.userId).toBe(testUsers[0].id);
      expect(userAchievement.achievementId).toBe(achievement.id);

      // Check user's achievements
      const userAchievements = await getUserAchievements(testUsers[0].id);
      const unlockedAchievement = userAchievements.find(ua => ua.id === achievement.id);

      expect(unlockedAchievement.isUnlocked).toBe(true);
    });

    it('should calculate achievement statistics', async () => {
      // Create multiple achievements
      const achievements = [];
      for (let i = 1; i <= 3; i++) {
        const achievement = await createAchievement({
          name: `Achievement ${i}`,
          description: `Test achievement ${i}`,
          icon: '🏆',
          category: 'SAVINGS',
          rarity: 'COMMON',
          pointsReward: i * 100
        });
        achievements.push(achievement);
      }

      // Unlock some achievements
      await unlockAchievement(testUsers[0].id, achievements[0].id);
      await unlockAchievement(testUsers[0].id, achievements[1].id);

      // Get stats
      const stats = await getUserAchievementStats(testUsers[0].id);

      expect(stats.totalAchievements).toBe(3);
      expect(stats.unlockedAchievements).toBe(2);
      expect(stats.completionRate).toBe(66.66666666666666);
      expect(stats.totalPointsEarned).toBe(300); // 100 + 200
    });

    it('should prevent duplicate achievement unlocks', async () => {
      const achievement = await createAchievement({
        name: 'Unique Achievement',
        description: 'Can only be unlocked once',
        icon: '🏆',
        category: 'SAVINGS',
        rarity: 'COMMON',
        pointsReward: 100
      });

      // First unlock should succeed
      const firstUnlock = await unlockAchievement(testUsers[0].id, achievement.id);
      expect(firstUnlock).toBeTruthy();

      // Second unlock should return existing record
      const secondUnlock = await unlockAchievement(testUsers[0].id, achievement.id);
      expect(secondUnlock.id).toBe(firstUnlock.id);
    });
  });

  describe('Challenges System', () => {
    it('should create and join challenges', async () => {
      // Create challenge
      const challenge = await createChallenge({
        creatorId: testUsers[0].id,
        title: 'Test Challenge',
        description: 'A test savings challenge',
        type: 'SAVINGS_AMOUNT',
        targetAmount: 100,
        duration: 30
      });

      expect(challenge.title).toBe('Test Challenge');
      expect(challenge.creatorId).toBe(testUsers[0].id);

      // Another user joins the challenge
      const participation = await joinChallenge(challenge.id, testUsers[1].id);

      expect(participation.userId).toBe(testUsers[1].id);
      expect(participation.challengeId).toBe(challenge.id);
      expect(participation.currentProgress).toBe(0);

      // Get challenge with participants
      const challengeWithParticipants = await getChallengeById(challenge.id);

      expect(challengeWithParticipants.participantCount).toBe(2); // Creator + joiner
    });

    it('should update challenge progress', async () => {
      const challenge = await createChallenge({
        creatorId: testUsers[0].id,
        title: 'Progress Challenge',
        description: 'Test progress tracking',
        type: 'SAVINGS_AMOUNT',
        targetAmount: 100,
        duration: 30
      });

      await joinChallenge(challenge.id, testUsers[1].id);

      // Update progress
      const updatedParticipation = await updateChallengeProgress(
        challenge.id,
        testUsers[1].id,
        50
      );

      expect(updatedParticipation.currentProgress).toBe(50);
    });

    it('should prevent duplicate challenge joins', async () => {
      const challenge = await createChallenge({
        creatorId: testUsers[0].id,
        title: 'Unique Challenge',
        description: 'Can only join once',
        type: 'SAVINGS_AMOUNT',
        targetAmount: 100,
        duration: 30
      });

      // First join should succeed
      await joinChallenge(challenge.id, testUsers[1].id);

      // Second join should fail
      await expect(joinChallenge(challenge.id, testUsers[1].id))
        .rejects.toThrow('User is already participating in this challenge');
    });
  });

  describe('Social System', () => {
    it('should handle friend requests', async () => {
      // Send friend request
      const friendship = await sendFriendRequest(testUsers[0].id, testUsers[1].id);

      expect(friendship.userId).toBe(testUsers[0].id);
      expect(friendship.friendId).toBe(testUsers[1].id);
      expect(friendship.status).toBe('PENDING');

      // Accept friend request
      const acceptedFriendship = await acceptFriendRequest(testUsers[1].id, friendship.id);

      expect(acceptedFriendship.status).toBe('ACCEPTED');
      expect(acceptedFriendship.acceptedAt).toBeTruthy();
    });

    it('should get user friends', async () => {
      // Create friendship
      const friendship = await sendFriendRequest(testUsers[0].id, testUsers[1].id);
      await acceptFriendRequest(testUsers[1].id, friendship.id);

      // Get friends for user 0
      const friends = await getUserFriends(testUsers[0].id);

      expect(friends.length).toBe(1);
      expect(friends[0].friend.id).toBe(testUsers[1].id);
      expect(friends[0].friend.username).toBe('user2');
    });

    it('should check friendship status', async () => {
      // No friendship initially
      let status = await getFriendshipStatus(testUsers[0].id, testUsers[1].id);
      expect(status.status).toBe('none');
      expect(status.canSendRequest).toBe(true);

      // Send friend request
      const friendship = await sendFriendRequest(testUsers[0].id, testUsers[1].id);
      
      status = await getFriendshipStatus(testUsers[0].id, testUsers[1].id);
      expect(status.status).toBe('PENDING');
      expect(status.canSendRequest).toBe(false);

      // Accept friend request
      await acceptFriendRequest(testUsers[1].id, friendship.id);
      
      status = await getFriendshipStatus(testUsers[0].id, testUsers[1].id);
      expect(status.status).toBe('ACCEPTED');
      expect(status.canSendRequest).toBe(false);
    });

    it('should prevent self friend requests', async () => {
      await expect(sendFriendRequest(testUsers[0].id, testUsers[0].id))
        .rejects.toThrow('Cannot send friend request to yourself');
    });
  });

  describe('Notifications System', () => {
    it('should create and retrieve notifications', async () => {
      // Create notification
      const notification = await createNotification({
        userId: testUsers[0].id,
        type: 'ACHIEVEMENT',
        title: 'Test Notification',
        message: 'This is a test notification',
        data: { test: true }
      });

      expect(notification.userId).toBe(testUsers[0].id);
      expect(notification.type).toBe('ACHIEVEMENT');
      expect(notification.read).toBe(false);

      // Get user notifications
      const result = await getUserNotifications(testUsers[0].id);

      expect(result.notifications.length).toBe(1);
      expect(result.total).toBe(1);
      expect(result.unread).toBe(1);
      expect(result.notifications[0].id).toBe(notification.id);
    });

    it('should mark notifications as read', async () => {
      const notification = await createNotification({
        userId: testUsers[0].id,
        type: 'SYSTEM',
        title: 'Read Test',
        message: 'Test marking as read'
      });

      expect(notification.read).toBe(false);

      // Mark as read
      const updatedNotification = await markNotificationAsRead(
        notification.id,
        testUsers[0].id
      );

      expect(updatedNotification.read).toBe(true);
    });

    it('should filter notifications by type', async () => {
      // Create different types of notifications
      await createNotification({
        userId: testUsers[0].id,
        type: 'ACHIEVEMENT',
        title: 'Achievement',
        message: 'Achievement notification'
      });

      await createNotification({
        userId: testUsers[0].id,
        type: 'SOCIAL',
        title: 'Social',
        message: 'Social notification'
      });

      // Get only achievement notifications
      const result = await getUserNotifications(testUsers[0].id, { type: 'ACHIEVEMENT' });

      expect(result.notifications.length).toBe(1);
      expect(result.notifications[0].type).toBe('ACHIEVEMENT');
    });
  });

  describe('Integration Tests', () => {
    it('should create notifications when achievements are unlocked', async () => {
      const achievement = await createAchievement({
        name: 'Integration Achievement',
        description: 'Tests notification creation',
        icon: '🏆',
        category: 'SAVINGS',
        rarity: 'COMMON',
        pointsReward: 100
      });

      // Unlock achievement (should create notification)
      await unlockAchievement(testUsers[0].id, achievement.id);

      // Check if notification was created
      const notifications = await getUserNotifications(testUsers[0].id);

      expect(notifications.notifications.length).toBe(1);
      expect(notifications.notifications[0].type).toBe('ACHIEVEMENT');
      expect(notifications.notifications[0].title).toBe('Achievement Unlocked!');
    });

    it('should create notifications when friend requests are sent', async () => {
      // Send friend request (should create notification)
      await sendFriendRequest(testUsers[0].id, testUsers[1].id);

      // Check if notification was created for recipient
      const notifications = await getUserNotifications(testUsers[1].id);

      expect(notifications.notifications.length).toBe(1);
      expect(notifications.notifications[0].type).toBe('SOCIAL');
      expect(notifications.notifications[0].title).toBe('New Friend Request');
    });

    it('should handle complex social interactions', async () => {
      // User 0 and User 1 become friends
      const friendship1 = await sendFriendRequest(testUsers[0].id, testUsers[1].id);
      await acceptFriendRequest(testUsers[1].id, friendship1.id);

      // User 0 and User 2 become friends
      const friendship2 = await sendFriendRequest(testUsers[0].id, testUsers[2].id);
      await acceptFriendRequest(testUsers[2].id, friendship2.id);

      // Create a challenge
      const challenge = await createChallenge({
        creatorId: testUsers[0].id,
        title: 'Friends Challenge',
        description: 'Challenge with friends',
        type: 'SAVINGS_AMOUNT',
        targetAmount: 100,
        duration: 30
      });

      // Friends join the challenge
      await joinChallenge(challenge.id, testUsers[1].id);
      await joinChallenge(challenge.id, testUsers[2].id);

      // Check challenge participants
      const challengeWithParticipants = await getChallengeById(challenge.id);
      expect(challengeWithParticipants.participantCount).toBe(3);

      // Check that all users have friends
      const user0Friends = await getUserFriends(testUsers[0].id);
      expect(user0Friends.length).toBe(2);
    });
  });
});

// Clean up after all tests
afterAll(async () => {
  await prisma.$disconnect();
});