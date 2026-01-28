import { CompleteOrderDetails } from '@/hooks/contracts/useOpenPositions';

export interface ScoreBreakdown {
  fillabilityScore: number;   // 0-40 pts - can user fill this order?
  priceScore: number;         // 0-40 pts - price discount from market
  relevanceScore: number;     // 0-20 pts - does user want this token?
}

export interface ScoredOrder extends CompleteOrderDetails {
  score: number;              // 0-100 composite score
  canFill: boolean;           // User has required tokens to fill
  fillPercentage: number;     // 0-100% of order user can fill
  priceDiscount: number;      // % from market (negative = discount, positive = premium)
  breakdown: ScoreBreakdown;
}

export interface SavedOrder {
  orderID: string;            // Stored as string for JSON serialization
  savedAt: number;            // Timestamp when saved
}

export interface TokenBalance {
  address: string;
  balance: bigint;
  decimals: number;
}

export type SwipeDirection = 'left' | 'right' | 'up';
