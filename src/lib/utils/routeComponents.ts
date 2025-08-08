import { createLazyComponent } from './lazyImports';

// Lazy load major page components for better code splitting
export const LazyDashboard = createLazyComponent(
  () => import('../../app/dashboard/page')
);

export const LazyAchievements = createLazyComponent(
  () => import('../../app/achievements/page')
);

export const LazyChallenges = createLazyComponent(
  () => import('../../app/challenges/page')
);

export const LazyFriends = createLazyComponent(
  () => import('../../app/friends/page')
);

export const LazyInsights = createLazyComponent(
  () => import('../../app/insights/page')
);

// Lazy load complex components
export const LazyInsightsPanel = createLazyComponent(
  () => import('../../components/insights/InsightsPanel')
);

export const LazyLeaderboard = createLazyComponent(
  () => import('../../components/gamification/Leaderboard')
);

export const LazyTransactionHistory = createLazyComponent(
  () => import('../../components/dashboard/TransactionHistory')
);

export const LazyChallengeManager = createLazyComponent(
  () => import('../../components/social/ChallengeManager')
);

export const LazyNotificationCenter = createLazyComponent(
  () => import('../../components/notifications/NotificationCenter')
);

export const LazyMonitoringDashboard = createLazyComponent(
  () => import('../../components/admin/MonitoringDashboard')
);

export const LazySecurityDashboard = createLazyComponent(
  () => import('../../components/admin/SecurityDashboard')
);