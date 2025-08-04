import { prisma } from './prisma';
import { UserSession } from '@prisma/client';
import { randomBytes } from 'crypto';

export interface CreateSessionInput {
  userId: string;
  deviceInfo?: string;
  ipAddress?: string;
  userAgent?: string;
  expiresIn?: number; // in seconds, default 30 days
}

export interface SessionWithUser extends UserSession {
  user: {
    id: string;
    email: string;
    username: string;
    firstName: string | null;
    lastName: string | null;
    profileImage: string | null;
    isActive: boolean;
    isVerified: boolean;
  };
}

/**
 * Generate a secure session token
 */
function generateSessionToken(): string {
  return randomBytes(32).toString('hex');
}

/**
 * Create a new user session
 */
export async function createSession(input: CreateSessionInput): Promise<UserSession> {
  const { userId, deviceInfo, ipAddress, userAgent, expiresIn = 30 * 24 * 60 * 60 } = input;
  
  const sessionToken = generateSessionToken();
  const expiresAt = new Date(Date.now() + expiresIn * 1000);

  return prisma.userSession.create({
    data: {
      userId,
      sessionToken,
      deviceInfo,
      ipAddress,
      userAgent,
      expiresAt
    }
  });
}

/**
 * Get session by token with user information
 */
export async function getSessionByToken(sessionToken: string): Promise<SessionWithUser | null> {
  return prisma.userSession.findUnique({
    where: { sessionToken },
    include: {
      user: {
        select: {
          id: true,
          email: true,
          username: true,
          firstName: true,
          lastName: true,
          profileImage: true,
          isActive: true,
          isVerified: true
        }
      }
    }
  }) as Promise<SessionWithUser | null>;
}

/**
 * Get valid session by token (not expired and active)
 */
export async function getValidSession(sessionToken: string): Promise<SessionWithUser | null> {
  const session = await getSessionByToken(sessionToken);
  
  if (!session) return null;
  if (!session.isActive) return null;
  if (session.expiresAt < new Date()) {
    // Session expired, deactivate it
    await deactivateSession(sessionToken);
    return null;
  }
  if (!session.user.isActive) return null;

  // Update last used time
  await updateSessionLastUsed(sessionToken);
  
  return session;
}

/**
 * Update session's last used time
 */
export async function updateSessionLastUsed(sessionToken: string): Promise<UserSession> {
  return prisma.userSession.update({
    where: { sessionToken },
    data: { lastUsedAt: new Date() }
  });
}

/**
 * Deactivate a session
 */
export async function deactivateSession(sessionToken: string): Promise<UserSession> {
  return prisma.userSession.update({
    where: { sessionToken },
    data: { isActive: false }
  });
}

/**
 * Deactivate all sessions for a user
 */
export async function deactivateAllUserSessions(userId: string): Promise<number> {
  const result = await prisma.userSession.updateMany({
    where: { userId, isActive: true },
    data: { isActive: false }
  });
  
  return result.count;
}

/**
 * Get all active sessions for a user
 */
export async function getUserSessions(userId: string): Promise<UserSession[]> {
  return prisma.userSession.findMany({
    where: {
      userId,
      isActive: true,
      expiresAt: { gt: new Date() }
    },
    orderBy: { lastUsedAt: 'desc' }
  });
}

/**
 * Clean up expired sessions
 */
export async function cleanupExpiredSessions(): Promise<number> {
  const result = await prisma.userSession.updateMany({
    where: {
      expiresAt: { lt: new Date() },
      isActive: true
    },
    data: { isActive: false }
  });
  
  return result.count;
}

/**
 * Extend session expiration
 */
export async function extendSession(
  sessionToken: string, 
  additionalSeconds: number = 30 * 24 * 60 * 60
): Promise<UserSession> {
  const newExpiresAt = new Date(Date.now() + additionalSeconds * 1000);
  
  return prisma.userSession.update({
    where: { sessionToken },
    data: { 
      expiresAt: newExpiresAt,
      lastUsedAt: new Date()
    }
  });
}

/**
 * Get session statistics for a user
 */
export async function getUserSessionStats(userId: string) {
  const [totalSessions, activeSessions, recentSessions] = await Promise.all([
    prisma.userSession.count({
      where: { userId }
    }),
    prisma.userSession.count({
      where: { 
        userId, 
        isActive: true,
        expiresAt: { gt: new Date() }
      }
    }),
    prisma.userSession.findMany({
      where: { userId },
      orderBy: { lastUsedAt: 'desc' },
      take: 5,
      select: {
        id: true,
        deviceInfo: true,
        ipAddress: true,
        isActive: true,
        lastUsedAt: true,
        createdAt: true
      }
    })
  ]);

  return {
    totalSessions,
    activeSessions,
    recentSessions
  };
}

/**
 * Validate session and return user if valid
 */
export async function validateSessionAndGetUser(sessionToken: string) {
  const session = await getValidSession(sessionToken);
  return session?.user || null;
}

/**
 * Create session for user login
 */
export async function createLoginSession(
  userId: string,
  request: {
    ip?: string;
    userAgent?: string;
    deviceInfo?: string;
  }
): Promise<{ session: UserSession; user: any }> {
  // Limit concurrent sessions per user (optional)
  const activeSessions = await getUserSessions(userId);
  const MAX_SESSIONS = 10;
  
  if (activeSessions.length >= MAX_SESSIONS) {
    // Deactivate oldest session
    const oldestSession = activeSessions[activeSessions.length - 1];
    await deactivateSession(oldestSession.sessionToken);
  }

  const session = await createSession({
    userId,
    ipAddress: request.ip,
    userAgent: request.userAgent,
    deviceInfo: request.deviceInfo
  });

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      username: true,
      firstName: true,
      lastName: true,
      profileImage: true,
      level: true,
      totalPoints: true,
      isActive: true,
      isVerified: true
    }
  });

  return { session, user };
}

/**
 * Logout user by deactivating session
 */
export async function logoutUser(sessionToken: string): Promise<boolean> {
  try {
    await deactivateSession(sessionToken);
    return true;
  } catch (error) {
    console.error('Error logging out user:', error);
    return false;
  }
}

/**
 * Logout user from all devices
 */
export async function logoutUserFromAllDevices(userId: string): Promise<number> {
  return deactivateAllUserSessions(userId);
}