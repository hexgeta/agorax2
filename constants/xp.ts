/**
 * XP System Constants
 *
 * This file defines the XP rewards for actions and legion advancement thresholds.
 * To advance to the next legion, users must:
 * 1. Complete ALL required challenges in their current level
 * 2. Reach the XP threshold for the next level
 */

// XP rewards for on-chain actions
// Only successfully filled orders earn XP (both maker and taker sides)
export const ACTION_XP = {
  // Order creation - no XP until it gets filled
  ORDER_CREATED: 0,

  // Order filled - rewarded when user fills someone else's order (taker)
  ORDER_FILLED: 100,

  // Order filled as maker - rewarded when someone fills your order
  ORDER_FILLED_AS_MAKER: 100,

  // Claim proceeds - no XP (already rewarded on fill)
  PROCEEDS_CLAIMED: 0,

  // Order cancelled - no XP reward
  ORDER_CANCELLED: 0,

  // Wallet connected - no XP for connection
  WALLET_CONNECTED: 0,
} as const;

// Volume bonus: +1 XP per $10 USD traded, uncapped
export const VOLUME_BONUS = {
  XP_PER_USD: 0.1, // 1 XP per $10 = 0.1 XP per $1
  MAX_BONUS_PER_TRADE: Infinity, // No cap
} as const;

// Legion definitions with their symbols, names, and colors
export const LEGIONS = [
  { index: 0, symbol: 'α', name: 'Alpha', color: 'rose' },
  { index: 1, symbol: 'β', name: 'Beta', color: 'orange' },
  { index: 2, symbol: 'γ', name: 'Gamma', color: 'lime' },
  { index: 3, symbol: 'δ', name: 'Delta', color: 'emerald' },
  { index: 4, symbol: 'ε', name: 'Epsilon', color: 'cyan' },
  { index: 5, symbol: 'ζ', name: 'Zeta', color: 'blue' },
  { index: 6, symbol: 'η', name: 'Eta', color: 'violet' },
  { index: 7, symbol: 'θ', name: 'Theta', color: 'fuchsia' },
  { index: 8, symbol: 'Ω', name: 'Omega', color: 'yellow' },
] as const;

// XP thresholds to advance FROM one legion TO the next
// Key is the current legion index, value is the XP needed to advance
// e.g., LEGION_XP_THRESHOLDS[0] = 1500 means you need 1500 XP to go from Alpha to Beta
export const LEGION_XP_THRESHOLDS: Record<number, number> = {
  0: 1_500,      // Alpha → Beta
  1: 4_000,      // Beta → Gamma
  2: 10_000,     // Gamma → Delta
  3: 25_000,     // Delta → Epsilon
  4: 60_000,     // Epsilon → Zeta
  5: 150_000,    // Zeta → Eta
  6: 400_000,    // Eta → Theta
  7: 1_000_000,  // Theta → Omega
  8: Infinity,   // Omega is max level
};

// Helper to get XP needed for next level
export function getXpForNextLevel(currentLegion: number): number {
  return LEGION_XP_THRESHOLDS[currentLegion] ?? Infinity;
}

// Helper to get XP from previous level (floor of current level)
export function getXpFloor(currentLegion: number): number {
  if (currentLegion <= 0) return 0;
  return LEGION_XP_THRESHOLDS[currentLegion - 1] ?? 0;
}

// Calculate progress percentage within current legion
export function calculateLegionProgress(currentXp: number, currentLegion: number): number {
  const floor = getXpFloor(currentLegion);
  const ceiling = getXpForNextLevel(currentLegion);

  if (ceiling === Infinity) return 100; // At max level

  const range = ceiling - floor;
  const progress = currentXp - floor;

  return Math.min(100, Math.max(0, (progress / range) * 100));
}

// Calculate volume bonus XP for a trade
export function calculateVolumeBonus(volumeUsd: number): number {
  const bonus = Math.floor(volumeUsd * VOLUME_BONUS.XP_PER_USD);
  return Math.min(bonus, VOLUME_BONUS.MAX_BONUS_PER_TRADE);
}

// Calculate total XP for a trade event
export function calculateTradeXp(isMaker: boolean, volumeUsd: number): number {
  const baseXp = isMaker ? ACTION_XP.ORDER_FILLED_AS_MAKER : ACTION_XP.ORDER_FILLED;
  const volumeBonus = calculateVolumeBonus(volumeUsd);
  return baseXp + volumeBonus;
}

// Determine which legion a user should be at based on XP and challenge completion
export function determineEligibleLegion(
  totalXp: number,
  completedChallengesByLevel: Record<number, boolean>
): number {
  let eligibleLevel = 0;

  for (let level = 0; level < 8; level++) {
    const xpThreshold = LEGION_XP_THRESHOLDS[level];
    const challengesComplete = completedChallengesByLevel[level] ?? false;

    // Can only advance if both conditions are met
    if (totalXp >= xpThreshold && challengesComplete) {
      eligibleLevel = level + 1;
    } else {
      break;
    }
  }

  return eligibleLevel;
}

// Export type for action XP keys
export type ActionXpType = keyof typeof ACTION_XP;
