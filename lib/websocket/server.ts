import { Server as SocketIOServer, Socket } from 'socket.io';
import { Server as HTTPServer } from 'http';
import jwt from 'jsonwebtoken';
import { prisma } from '../db/prisma';

export interface AuthenticatedSocket extends Socket {
  userId: string;
  user: {
    id: string;
    username: string;
    level: number;
  };
}

export class WebSocketServer {
  private io: SocketIOServer;
  private connectedUsers: Map<string, string> = new Map(); // userId -> socketId

  constructor(httpServer: HTTPServer) {
    this.io = new SocketIOServer(httpServer, {
      cors: {
        origin: process.env.FRONTEND_URL || "http://localhost:3000",
        methods: ["GET", "POST"],
        credentials: true
      },
      transports: ['websocket', 'polling']
    });

    this.setupMiddleware();
    this.setupEventHandlers();
  }

  private setupMiddleware() {
    // Authentication middleware
    this.io.use(async (socket, next) => {
      try {
        const token = socket.handshake.auth.token || socket.handshake.headers.authorization?.split(' ')[1];
        
        if (!token) {
          return next(new Error('Authentication token required'));
        }

        const decoded = jwt.verify(token, process.env.JWT_SECRET!) as { userId: string };
        
        // Fetch user data
        const user = await prisma.user.findUnique({
          where: { id: decoded.userId },
          select: {
            id: true,
            username: true,
            level: true,
            isActive: true
          }
        });

        if (!user || !user.isActive) {
          return next(new Error('Invalid or inactive user'));
        }

        (socket as AuthenticatedSocket).userId = user.id;
        (socket as AuthenticatedSocket).user = user;
        
        next();
      } catch (error) {
        next(new Error('Authentication failed'));
      }
    });
  }

  private setupEventHandlers() {
    this.io.on('connection', (socket: AuthenticatedSocket) => {
      console.log(`User ${socket.user.username} connected: ${socket.id}`);
      
      // Track connected user
      this.connectedUsers.set(socket.userId, socket.id);
      
      // Join user-specific room
      socket.join(`user:${socket.userId}`);
      
      // Handle user joining challenge rooms
      socket.on('join_challenge', async (challengeId: string) => {
        try {
          // Verify user is participant in challenge
          const participation = await prisma.challengeParticipant.findFirst({
            where: {
              challengeId,
              userId: socket.userId
            }
          });
          
          if (participation) {
            socket.join(`challenge:${challengeId}`);
            socket.emit('joined_challenge', { challengeId });
          }
        } catch (error) {
          socket.emit('error', { message: 'Failed to join challenge room' });
        }
      });

      // Handle leaving challenge rooms
      socket.on('leave_challenge', (challengeId: string) => {
        socket.leave(`challenge:${challengeId}`);
        socket.emit('left_challenge', { challengeId });
      });

      // Handle friend rooms
      socket.on('join_friends_room', async () => {
        try {
          const friendships = await prisma.friendship.findMany({
            where: {
              OR: [
                { userId: socket.userId },
                { friendId: socket.userId }
              ],
              status: 'accepted'
            }
          });
          
          // Join rooms for each friend
          friendships.forEach(friendship => {
            const friendId = friendship.userId === socket.userId ? friendship.friendId : friendship.userId;
            socket.join(`friends:${friendId}`);
          });
        } catch (error) {
          socket.emit('error', { message: 'Failed to join friends rooms' });
        }
      });     
 // Handle instant messaging
      socket.on('send_message', async (data: { recipientId: string; message: string; challengeId?: string }) => {
        try {
          // Verify friendship or challenge participation
          if (data.challengeId) {
            // Challenge message
            const participation = await prisma.challengeParticipant.findFirst({
              where: {
                challengeId: data.challengeId,
                userId: socket.userId
              }
            });
            
            if (participation) {
              this.io.to(`challenge:${data.challengeId}`).emit('new_message', {
                senderId: socket.userId,
                senderUsername: socket.user.username,
                message: data.message,
                challengeId: data.challengeId,
                timestamp: new Date()
              });
            }
          } else {
            // Direct message
            const friendship = await prisma.friendship.findFirst({
              where: {
                OR: [
                  { userId: socket.userId, friendId: data.recipientId },
                  { userId: data.recipientId, friendId: socket.userId }
                ],
                status: 'accepted'
              }
            });
            
            if (friendship) {
              this.io.to(`user:${data.recipientId}`).emit('new_message', {
                senderId: socket.userId,
                senderUsername: socket.user.username,
                message: data.message,
                timestamp: new Date()
              });
            }
          }
        } catch (error) {
          socket.emit('error', { message: 'Failed to send message' });
        }
      });

      // Handle typing indicators
      socket.on('typing_start', (data: { recipientId?: string; challengeId?: string }) => {
        if (data.challengeId) {
          socket.to(`challenge:${data.challengeId}`).emit('user_typing', {
            userId: socket.userId,
            username: socket.user.username,
            challengeId: data.challengeId
          });
        } else if (data.recipientId) {
          socket.to(`user:${data.recipientId}`).emit('user_typing', {
            userId: socket.userId,
            username: socket.user.username
          });
        }
      });

      socket.on('typing_stop', (data: { recipientId?: string; challengeId?: string }) => {
        if (data.challengeId) {
          socket.to(`challenge:${data.challengeId}`).emit('user_stopped_typing', {
            userId: socket.userId,
            challengeId: data.challengeId
          });
        } else if (data.recipientId) {
          socket.to(`user:${data.recipientId}`).emit('user_stopped_typing', {
            userId: socket.userId
          });
        }
      });

      // Handle disconnection
      socket.on('disconnect', () => {
        console.log(`User ${socket.user.username} disconnected: ${socket.id}`);
        this.connectedUsers.delete(socket.userId);
        
        // Notify friends of offline status
        socket.broadcast.to(`friends:${socket.userId}`).emit('friend_offline', {
          userId: socket.userId,
          username: socket.user.username
        });
      });
    });
  }

  // Public methods for broadcasting updates
  public broadcastBalanceUpdate(userId: string, balanceData: any) {
    this.io.to(`user:${userId}`).emit('balance_updated', balanceData);
  }

  public broadcastTransactionUpdate(userId: string, transaction: any) {
    this.io.to(`user:${userId}`).emit('transaction_updated', transaction);
  }

  public broadcastChallengeProgress(challengeId: string, progressData: any) {
    this.io.to(`challenge:${challengeId}`).emit('challenge_progress_updated', progressData);
  }

  public broadcastLeaderboardUpdate(challengeId: string, leaderboard: any) {
    this.io.to(`challenge:${challengeId}`).emit('leaderboard_updated', leaderboard);
  }

  public broadcastAchievementUnlocked(userId: string, achievement: any) {
    this.io.to(`user:${userId}`).emit('achievement_unlocked', achievement);
    
    // Also notify friends
    this.io.to(`friends:${userId}`).emit('friend_achievement', {
      userId,
      achievement
    });
  }

  public broadcastStreakUpdate(userId: string, streakData: any) {
    this.io.to(`user:${userId}`).emit('streak_updated', streakData);
  }

  public broadcastChallengeInvite(userId: string, challengeData: any) {
    this.io.to(`user:${userId}`).emit('challenge_invite', challengeData);
  }

  public broadcastFriendRequest(userId: string, requestData: any) {
    this.io.to(`user:${userId}`).emit('friend_request', requestData);
  }

  public broadcastNotification(userId: string, notification: any) {
    this.io.to(`user:${userId}`).emit('notification', notification);
  }

  public isUserOnline(userId: string): boolean {
    return this.connectedUsers.has(userId);
  }

  public getOnlineUsers(): string[] {
    return Array.from(this.connectedUsers.keys());
  }

  public getConnectedSocketsCount(): number {
    return this.connectedUsers.size;
  }
}

// Singleton instance
let webSocketServer: WebSocketServer | null = null;

export const initializeWebSocketServer = (httpServer: HTTPServer): WebSocketServer => {
  if (!webSocketServer) {
    webSocketServer = new WebSocketServer(httpServer);
  }
  return webSocketServer;
};

export const getWebSocketServer = (): WebSocketServer => {
  if (!webSocketServer) {
    throw new Error('WebSocket server not initialized');
  }
  return webSocketServer;
};