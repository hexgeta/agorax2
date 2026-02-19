import { SWRConfiguration } from 'swr'

// Base configuration shared by all strategies
const baseConfig: SWRConfiguration = {
  provider: () => new Map(),
  revalidateOnReconnect: false,
  revalidateOnFocus: false,
}

// Default export for general use
export const swrConfig = baseConfig;

// Different caching strategies
export const DAILY_SWR_CONFIG: SWRConfiguration = {
  ...baseConfig,
  dedupingInterval: 24 * 60 * 60 * 1000, // 24 hours
}

// Real-time price data (DexScreener)
export const REALTIME_SWR_CONFIG: SWRConfiguration = {
  ...baseConfig,
  refreshInterval: 30000,      // Refresh every 30 seconds
  revalidateOnFocus: true,     // Update when tab gets focus
  dedupingInterval: 15000,     // Prevent duplicate requests within 15 seconds
}

// 5-minute interval data
export const FIVE_MIN_SWR_CONFIG: SWRConfiguration = {
  ...baseConfig,
  refreshInterval: 5 * 60 * 1000,  // Refresh every 5 minutes
  dedupingInterval: 60 * 1000,     // Prevent duplicate requests within 1 minute
}

// Create a custom interval config
export const createCustomIntervalConfig = (seconds: number): SWRConfiguration => ({
  ...baseConfig,
  refreshInterval: seconds * 1000,
  revalidateOnFocus: true,
  dedupingInterval: Math.floor(seconds / 2) * 1000, // Half the refresh interval
})

// Helper functions for dynamic cache keys
export function getDailyCacheKey(baseKey: string) {
  const now = new Date()
  const utcHour = now.getUTCHours()
  const date = new Date(now)
  if (utcHour < 1) {
    date.setUTCDate(date.getUTCDate() - 1)
  }
  return `${baseKey}-${date.toISOString().split('T')[0]}`
}

export function getMinuteCacheKey(baseKey: string, minutes: number) {
  const now = new Date()
  const minuteBlock = Math.floor(now.getUTCMinutes() / minutes)
  return `${baseKey}-${now.getUTCHours()}-${minuteBlock}`
}

export function getSecondCacheKey(baseKey: string, seconds: number) {
  const now = new Date()
  const secondBlock = Math.floor(now.getUTCSeconds() / seconds)
  return `${baseKey}-${now.getUTCHours()}-${now.getUTCMinutes()}-${secondBlock}`
} 