import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatCurrency(amount: number, currency: string = 'USD'): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
  }).format(amount)
}

export function calculateRoundUp(amount: number, roundUpTo: number = 1): number {
  const remainder = amount % roundUpTo
  return remainder === 0 ? 0 : roundUpTo - remainder
}

export function calculateLevel(points: number): number {
  const LEVEL_THRESHOLDS = [0, 100, 300, 600, 1000, 1500, 2100, 2800, 3600, 4500, 5500]
  
  for (let i = LEVEL_THRESHOLDS.length - 1; i >= 0; i--) {
    if (points >= LEVEL_THRESHOLDS[i]) {
      return i + 1
    }
  }
  return 1
}

export function formatAddress(address: string): string {
  if (!address) return ''
  return `${address.slice(0, 6)}...${address.slice(-4)}`
}

export function generateUsername(): string {
  const adjectives = ['Smart', 'Wise', 'Clever', 'Bright', 'Sharp', 'Quick', 'Swift', 'Bold']
  const nouns = ['Saver', 'Investor', 'Builder', 'Achiever', 'Winner', 'Champion', 'Hero', 'Star']
  
  const adjective = adjectives[Math.floor(Math.random() * adjectives.length)]
  const noun = nouns[Math.floor(Math.random() * nouns.length)]
  const number = Math.floor(Math.random() * 1000)
  
  return `${adjective}${noun}${number}`
}