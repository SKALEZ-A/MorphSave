import { Server as HTTPServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import { io as Client, Socket as ClientSocket } from 'socket.io-client';
import jwt from 'jsonwebtoken';
import { WebSocketServer } from '../lib/websocket/server';
import { prisma } from '../lib/db/prisma';

describe('WebSocket Server', () => {
  let httpServer: HTTPServer;
  let webSocketServer: WebSocketServer;
  let clientSocket: ClientSocket;
  let testUser: any;
  let authToken: string;

  beforeAll(async () => {
    // Create test user
    testUser = await prisma.user.create({
      data: {
        email: 'test@example.com',
        username: 'testuser',
        walletAddress: '0x1234567890123456789012345678901234567890',
        privateKeyEncrypted: 'encrypted_key',
        level: 1,
        totalPoints: 0,
        currentStreak: 0,
        longestStreak: 0,
        totalSaved: 0,
        totalYieldEarned: 0,
        isActive: true
      }
    });

    // Generate auth token
    authToken = jwt.sign({ userId: testUser.id }, process.env.JWT_SECRET!);

    // Create HTTP server
    httpServer = new HTTPServer();
    webSocketServer = new WebSocketServer(httpServer);
    
    await new Promise<void>((resolve) => {
      httpServer.listen(0, resolve);
    });
  });

  afterAll(async () => {
    await prisma.user.delete({ where: { id: testUser.id } });
    httpServer.close();
  });

  beforeEach((done) => {
    const port = (httpServer.address() as any)?.port;
    clientSocket = Client(`http://localhost:${port}`, {
      auth: { token: authToken },
      transports: ['websocket']
    });
    
    clientSocket.on('connect', done);
  });

  afterEach(() => {
    if (clientSocket.connected) {
      clientSocket.disconnect();
    }
  });

  describe('Authentication', () => {
    it('should authenticate user with valid token', (done) => {
      expect(clientSocket.connected).toBe(true);
      done();
    });

    it('should reject connection with invalid token', (done) => {
      const invalidClient = Client(`http://localhost:${(httpServer.address() as any)?.port}`, {
        auth: { token: 'invalid_token' },
        transports: ['websocket']
      });

      invalidClient.on('connect_error', (error) => {
        expect(error.message).toContain('Authentication failed');
        invalidClient.disconnect();
        done();
      });
    });

    it('should reject connection without token', (done) => {
      const noTokenClient = Client(`http://localhost:${(httpServer.address() as any)?.port}`, {
        transports: ['websocket']
      });

      noTokenClient.on('connect_error', (error) => {
        expect(error.message).toContain('Authentication token required');
        noTokenClient.disconnect();
        done();
      });
    });
  });

  describe('Room Management', () => {
    it('should join challenge room', (done) => {
      const challengeId = 'test-challenge-id';
      
      clientSocket.emit('join_challenge', challengeId);
      clientSocket.on('joined_challenge', (data) => {
        expect(data.challengeId).toBe(challengeId);
        done();
      });
    });

    it('should leave challenge room', (done) => {
      const challengeId = 'test-challenge-id';
      
      clientSocket.emit('leave_challenge', challengeId);
      clientSocket.on('left_challenge', (data) => {
        expect(data.challengeId).toBe(challengeId);
        done();
      });
    });

    it('should join friends room', (done) => {
      clientSocket.emit('join_friends_room');
      // Since we don't have friends in test, this should complete without error
      setTimeout(done, 100);
    });
  });

  describe('Real-time Updates', () => {
    it('should broadcast balance update', (done) => {
      const balanceData = {
        totalBalance: 100,
        availableBalance: 100,
        yieldEarned: 5,
        totalSaved: 100,
        currentAPY: 4.5,
        lastUpdated: new Date()
      };

      clientSocket.on('balance_updated', (data) => {
        expect(data.totalBalance).toBe(balanceData.totalBalance);
        expect(data.yieldEarned).toBe(balanceData.yieldEarned);
        done();
      });

      webSocketServer.broadcastBalanceUpdate(testUser.id, balanceData);
    });

    it('should broadcast transaction update', (done) => {
      const transactionData = {
        id: 'tx-123',
        type: 'roundup' as const,
        amount: 2.50,
        status: 'confirmed' as const,
        blockchainTxHash: '0xabcdef',
        timestamp: new Date()
      };

      clientSocket.on('transaction_updated', (data) => {
        expect(data.id).toBe(transactionData.id);
        expect(data.amount).toBe(transactionData.amount);
        done();
      });

      webSocketServer.broadcastTransactionUpdate(testUser.id, transactionData);
    });

    it('should broadcast achievement unlock', (done) => {
      const achievementData = {
        id: 'achievement-123',
        name: 'First Save',
        description: 'Made your first savings deposit',
        icon: '🎯',
        category: 'savings',
        rarity: 'common' as const,
        points: 10,
        unlockedAt: new Date()
      };

      clientSocket.on('achievement_unlocked', (data) => {
        expect(data.name).toBe(achievementData.name);
        expect(data.points).toBe(achievementData.points);
        done();
      });

      webSocketServer.broadcastAchievementUnlocked(testUser.id, achievementData);
    });
  });

  describe('Messaging', () => {
    let secondClient: ClientSocket;
    let secondUser: any;
    let secondAuthToken: string;

    beforeEach(async () => {
      // Create second test user
      secondUser = await prisma.user.create({
        data: {
          email: 'test2@example.com',
          username: 'testuser2',
          walletAddress: '0x2234567890123456789012345678901234567890',
          privateKeyEncrypted: 'encrypted_key_2',
          level: 1,
          totalPoints: 0,
          currentStreak: 0,
          longestStreak: 0,
          totalSaved: 0,
          totalYieldEarned: 0,
          isActive: true
        }
      });

      secondAuthToken = jwt.sign({ userId: secondUser.id }, process.env.JWT_SECRET!);

      // Create friendship
      await prisma.friendship.create({
        data: {
          userId: testUser.id,
          friendId: secondUser.id,
          status: 'accepted'
        }
      });

      const port = (httpServer.address() as any)?.port;
      secondClient = Client(`http://localhost:${port}`, {
        auth: { token: secondAuthToken },
        transports: ['websocket']
      });

      await new Promise<void>((resolve) => {
        secondClient.on('connect', resolve);
      });
    });

    afterEach(async () => {
      if (secondClient?.connected) {
        secondClient.disconnect();
      }
      if (secondUser) {
        await prisma.friendship.deleteMany({
          where: {
            OR: [
              { userId: testUser.id, friendId: secondUser.id },
              { userId: secondUser.id, friendId: testUser.id }
            ]
          }
        });
        await prisma.user.delete({ where: { id: secondUser.id } });
      }
    });

    it('should send direct message between friends', (done) => {
      const message = 'Hello friend!';

      secondClient.on('new_message', (data) => {
        expect(data.senderId).toBe(testUser.id);
        expect(data.message).toBe(message);
        expect(data.senderUsername).toBe(testUser.username);
        done();
      });

      clientSocket.emit('send_message', {
        recipientId: secondUser.id,
        message
      });
    });

    it('should handle typing indicators', (done) => {
      secondClient.on('user_typing', (data) => {
        expect(data.userId).toBe(testUser.id);
        expect(data.username).toBe(testUser.username);
        done();
      });

      clientSocket.emit('typing_start', {
        recipientId: secondUser.id
      });
    });
  });

  describe('Error Handling', () => {
    it('should handle invalid challenge join', (done) => {
      clientSocket.on('error', (data) => {
        expect(data.message).toContain('Failed to join challenge room');
        done();
      });

      // Try to join non-existent challenge
      clientSocket.emit('join_challenge', 'non-existent-challenge');
    });

    it('should handle message to non-friend', (done) => {
      clientSocket.on('error', (data) => {
        expect(data.message).toContain('Failed to send message');
        done();
      });

      // Try to message user who is not a friend
      clientSocket.emit('send_message', {
        recipientId: 'non-friend-user-id',
        message: 'Hello'
      });
    });
  });

  describe('Connection Management', () => {
    it('should track connected users', () => {
      expect(webSocketServer.isUserOnline(testUser.id)).toBe(true);
      expect(webSocketServer.getOnlineUsers()).toContain(testUser.id);
      expect(webSocketServer.getConnectedSocketsCount()).toBeGreaterThan(0);
    });

    it('should handle disconnection', (done) => {
      clientSocket.disconnect();
      
      setTimeout(() => {
        expect(webSocketServer.isUserOnline(testUser.id)).toBe(false);
        done();
      }, 100);
    });
  });
});