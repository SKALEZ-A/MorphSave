import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { PrismaClient } from '@prisma/client';
import { 
  createUser, 
  getUserById, 
  getUserByEmail, 
  updateUser, 
  searchUsers,
  getUserStatsSummary,
  isUsernameAvailable
} from '../lib/db/user';
import { 
  createSession, 
  getValidSession, 
  deactivateSession 
} from '../lib/db/session';

const prisma = new PrismaClient();

describe('User Management', () => {
  beforeEach(async () => {
    // Clean up test data
    await prisma.userSession.deleteMany();
    await prisma.user.deleteMany();
  });

  afterEach(async () => {
    // Clean up test data
    await prisma.userSession.deleteMany();
    await prisma.user.deleteMany();
  });

  describe('User CRUD Operations', () => {
    it('should create a new user', async () => {
      const userData = {
        email: 'test@example.com',
        username: 'testuser',
        firstName: 'Test',
        lastName: 'User',
        walletAddress: '0x1234567890123456789012345678901234567890',
        privateKeyEncrypted: 'encrypted_key_test'
      };

      const user = await createUser(userData);

      expect(user.email).toBe(userData.email);
      expect(user.username).toBe(userData.username);
      expect(user.walletAddress).toBe(userData.walletAddress);
      expect(user.level).toBe(1);
      expect(user.totalPoints).toBe(0);
    });

    it('should prevent duplicate email registration', async () => {
      const userData = {
        email: 'test@example.com',
        walletAddress: '0x1234567890123456789012345678901234567890',
        privateKeyEncrypted: 'encrypted_key_test'
      };

      await createUser(userData);

      await expect(createUser({
        ...userData,
        walletAddress: '0x2345678901234567890123456789012345678901'
      })).rejects.toThrow('User with this email already exists');
    });

    it('should get user by ID', async () => {
      const userData = {
        email: 'test@example.com',
        walletAddress: '0x1234567890123456789012345678901234567890',
        privateKeyEncrypted: 'encrypted_key_test'
      };

      const createdUser = await createUser(userData);
      const retrievedUser = await getUserById(createdUser.id);

      expect(retrievedUser).toBeTruthy();
      expect(retrievedUser?.email).toBe(userData.email);
    });

    it('should update user information', async () => {
      const userData = {
        email: 'test@example.com',
        walletAddress: '0x1234567890123456789012345678901234567890',
        privateKeyEncrypted: 'encrypted_key_test'
      };

      const user = await createUser(userData);
      const updatedUser = await updateUser(user.id, {
        firstName: 'Updated',
        lastName: 'Name',
        bio: 'Test bio'
      });

      expect(updatedUser.firstName).toBe('Updated');
      expect(updatedUser.lastName).toBe('Name');
      expect(updatedUser.bio).toBe('Test bio');
    });

    it('should search users by username', async () => {
      await createUser({
        email: 'alice@example.com',
        username: 'alice_saver',
        walletAddress: '0x1111111111111111111111111111111111111111',
        privateKeyEncrypted: 'key1'
      });

      await createUser({
        email: 'bob@example.com',
        username: 'bob_investor',
        walletAddress: '0x2222222222222222222222222222222222222222',
        privateKeyEncrypted: 'key2'
      });

      const results = await searchUsers('alice');
      expect(results.length).toBe(1);
      expect(results[0].username).toBe('alice_saver');
    });

    it('should check username availability', async () => {
      await createUser({
        email: 'test@example.com',
        username: 'taken_username',
        walletAddress: '0x1234567890123456789012345678901234567890',
        privateKeyEncrypted: 'key'
      });

      const isAvailable1 = await isUsernameAvailable('taken_username');
      const isAvailable2 = await isUsernameAvailable('available_username');

      expect(isAvailable1).toBe(false);
      expect(isAvailable2).toBe(true);
    });
  });

  describe('Session Management', () => {
    let testUser: any;

    beforeEach(async () => {
      testUser = await createUser({
        email: 'session@example.com',
        walletAddress: '0x1234567890123456789012345678901234567890',
        privateKeyEncrypted: 'key'
      });
    });

    it('should create a session', async () => {
      const session = await createSession({
        userId: testUser.id,
        deviceInfo: 'Test Device',
        ipAddress: '127.0.0.1'
      });

      expect(session.userId).toBe(testUser.id);
      expect(session.deviceInfo).toBe('Test Device');
      expect(session.isActive).toBe(true);
    });

    it('should validate active session', async () => {
      const session = await createSession({
        userId: testUser.id
      });

      const validSession = await getValidSession(session.sessionToken);
      expect(validSession).toBeTruthy();
      expect(validSession?.user.id).toBe(testUser.id);
    });

    it('should deactivate session', async () => {
      const session = await createSession({
        userId: testUser.id
      });

      await deactivateSession(session.sessionToken);
      const validSession = await getValidSession(session.sessionToken);
      
      expect(validSession).toBeNull();
    });
  });

  describe('User Statistics', () => {
    it('should get user stats summary', async () => {
      const user = await createUser({
        email: 'stats@example.com',
        walletAddress: '0x1234567890123456789012345678901234567890',
        privateKeyEncrypted: 'key'
      });

      const stats = await getUserStatsSummary(user.id);
      
      expect(stats).toBeTruthy();
      expect(stats?.totalPoints).toBe(0);
      expect(stats?.level).toBe(1);
      expect(stats?.totalTransactions).toBe(0);
      expect(stats?.achievementCount).toBe(0);
    });
  });
});

// Clean up after all tests
afterAll(async () => {
  await prisma.$disconnect();
});