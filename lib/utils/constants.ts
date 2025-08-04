// Morph Network Configuration
export const MORPH_NETWORK = {
  chainId: 2810,
  name: 'Morph Holesky',
  rpcUrl: process.env.MORPH_RPC_URL || 'https://rpc-quicknode-holesky.morphl2.io',
  explorerUrl: process.env.MORPH_EXPLORER_URL || 'https://explorer-holesky.morphl2.io',
  nativeCurrency: {
    name: 'Ether',
    symbol: 'ETH',
    decimals: 18,
  },
}

// Gamification Constants
export const ACHIEVEMENT_POINTS = {
  FIRST_SAVE: 100,
  FIRST_100: 500,
  FIRST_1000: 1000,
  STREAK_7: 200,
  STREAK_30: 1000,
  SOCIAL_INVITE: 150,
  CHALLENGE_WIN: 300,
} as const

export const LEVEL_THRESHOLDS = [
  0, 100, 300, 600, 1000, 1500, 2100, 2800, 3600, 4500, 5500
] as const

// Financial Constants
export const ROUND_UP_LIMITS = {
  MIN: 0.5,
  MAX: 5.0,
  DEFAULT: 1.0,
} as const

export const SAVINGS_LIMITS = {
  MIN_INVESTMENT: 10, // $10 minimum for DeFi investment
  MAX_DAILY_ROUNDUP: 50, // $50 max daily round-ups
} as const