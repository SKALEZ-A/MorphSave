// WebSocket Event Types
export interface ServerToClientEvents {
  // Balance and transaction updates
  balance_updated: (data: BalanceUpdateData) => void;
  transaction_updated: (data: TransactionUpdateData) => void;
  
  // Challenge and gamification updates
  challenge_progress_updated: (data: ChallengeProgressData) => void;
  leaderboard_updated: (data: LeaderboardData) => void;
  achievement_unlocked: (data: AchievementData) => void;
  streak_updated: (data: StreakData) => void;
  
  // Social features
  challenge_invite: (data: ChallengeInviteData) => void;
  friend_request: (data: FriendRequestData) => void;
  friend_achievement: (data: FriendAchievementData) => void;
  friend_offline: (data: { userId: string; username: string }) => void;
  
  // Messaging
  new_message: (data: MessageData) => void;
  user_typing: (data: TypingData) => void;
  user_stopped_typing: (data: TypingStopData) => void;
  
  // Room management
  joined_challenge: (data: { challengeId: string }) => void;
  left_challenge: (data: { challengeId: string }) => void;
  
  // General notifications
  notification: (data: NotificationData) => void;
  error: (data: { message: string }) => void;
}

export interface ClientToServerEvents {
  // Room management
  join_challenge: (challengeId: string) => void;
  leave_challenge: (challengeId: string) => void;
  join_friends_room: () => void;
  
  // Messaging
  send_message: (data: SendMessageData) => void;
  typing_start: (data: TypingStartData) => void;
  typing_stop: (data: TypingStopData) => void;
}

// Data interfaces
export interface BalanceUpdateData {
  totalBalance: number;
  availableBalance: number;
  yieldEarned: number;
  totalSaved: number;
  currentAPY: number;
  lastUpdated: Date;
}

export interface TransactionUpdateData {
  id: string;
  type: 'roundup' | 'manual' | 'yield' | 'withdrawal';
  amount: number;
  status: 'pending' | 'confirmed' | 'failed';
  blockchainTxHash?: string;
  timestamp: Date;
}

export interface ChallengeProgressData {
  challengeId: string;
  participants: Array<{
    userId: string;
    username: string;
    progress: number;
    rank: number;
  }>;
  totalProgress: number;
  timeRemaining: number;
}

export interface LeaderboardData {
  challengeId: string;
  leaderboard: Array<{
    rank: number;
    userId: string;
    username: string;
    score: number;
    avatar?: string;
  }>;
  userRank?: number;
  lastUpdated: Date;
}

export interface AchievementData {
  id: string;
  name: string;
  description: string;
  icon: string;
  category: string;
  rarity: 'common' | 'rare' | 'epic' | 'legendary';
  points: number;
  unlockedAt: Date;
}

export interface StreakData {
  currentStreak: number;
  longestStreak: number;
  streakType: 'daily_save' | 'challenge_complete' | 'login';
  nextMilestone: number;
  streakBonus: number;
}

export interface ChallengeInviteData {
  challengeId: string;
  challengeName: string;
  inviterUsername: string;
  inviterId: string;
  expiresAt: Date;
}

export interface FriendRequestData {
  requestId: string;
  fromUserId: string;
  fromUsername: string;
  fromAvatar?: string;
  message?: string;
  createdAt: Date;
}

export interface FriendAchievementData {
  userId: string;
  username: string;
  achievement: AchievementData;
}

export interface MessageData {
  senderId: string;
  senderUsername: string;
  message: string;
  challengeId?: string;
  timestamp: Date;
}

export interface SendMessageData {
  recipientId?: string;
  challengeId?: string;
  message: string;
}

export interface TypingData {
  userId: string;
  username: string;
  challengeId?: string;
}

export interface TypingStartData {
  recipientId?: string;
  challengeId?: string;
}

export interface TypingStopData {
  recipientId?: string;
  challengeId?: string;
}

export interface NotificationData {
  id: string;
  type: 'achievement' | 'challenge' | 'friend' | 'transaction' | 'system';
  title: string;
  message: string;
  data?: any;
  createdAt: Date;
  read: boolean;
}

// WebSocket connection states
export enum ConnectionState {
  CONNECTING = 'connecting',
  CONNECTED = 'connected',
  DISCONNECTED = 'disconnected',
  RECONNECTING = 'reconnecting',
  ERROR = 'error'
}