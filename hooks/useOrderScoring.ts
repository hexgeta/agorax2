'use client';

import { useMemo } from 'react';
import { CompleteOrderDetails } from '@/hooks/contracts/useOpenPositions';
import { TokenPrices } from '@/hooks/crypto/useTokenPrices';
import { ScoredOrder, ScoreBreakdown } from '@/types/discover';
import { getTokenInfoByIndex, getTokenInfo } from '@/utils/tokenUtils';
import { formatUnits } from 'viem';

// Core tokens get a relevance bonus
const CORE_TOKEN_ADDRESSES = [
  '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee', // PLS
  '0x2b591e99afe9f32eaa6214f7b7629768c40eeb39', // HEX
  '0x95b303987a60c71504d99aa1b13b4da07b0790ab', // PLSX
  '0x2fa878ab3f87cc1c9737fc071108f904c0b0c95d', // INC
];

interface UseOrderScoringResult {
  scoredOrders: ScoredOrder[];
  isCalculating: boolean;
}

/**
 * Hook that scores and sorts orders based on user's ability to fill and price attractiveness
 *
 * Scoring breakdown:
 * - Fillability (0-40 pts): Can the user fill this order with their token holdings?
 * - Price (0-40 pts): How good is the discount from market price?
 * - Relevance (0-20 pts): Does the user already hold the sell token? Is it a core token?
 */
export function useOrderScoring(
  orders: CompleteOrderDetails[],
  userBalances: Map<string, bigint>,
  prices: TokenPrices
): UseOrderScoringResult {
  const scoredOrders = useMemo(() => {
    if (!orders || orders.length === 0) {
      return [];
    }

    const now = BigInt(Math.floor(Date.now() / 1000));

    const scored = orders
      .filter(order => {
        // Only active orders (status 0)
        if (order.orderDetailsWithID.status !== 0) return false;
        // Filter out expired orders
        if (order.orderDetailsWithID.orderDetails.expirationTime <= now) return false;
        // Filter out fully filled orders (no remaining sell amount)
        if (order.orderDetailsWithID.remainingSellAmount <= 0n) return false;
        return true;
      })
      .map(order => scoreOrder(order, userBalances, prices))
      .sort((a, b) => b.score - a.score);

    return scored;
  }, [orders, userBalances, prices]);

  return {
    scoredOrders,
    isCalculating: false,
  };
}

function scoreOrder(
  order: CompleteOrderDetails,
  userBalances: Map<string, bigint>,
  prices: TokenPrices
): ScoredOrder {
  const orderDetails = order.orderDetailsWithID.orderDetails;
  const sellToken = orderDetails.sellToken;
  const buyTokenIndices = orderDetails.buyTokensIndex;
  const buyAmounts = orderDetails.buyAmounts;
  const remainingSellAmount = order.orderDetailsWithID.remainingSellAmount;

  // Get sell token info
  const sellTokenInfo = getTokenInfo(sellToken);
  const sellTokenAddress = sellToken.toLowerCase();

  // ========================================
  // 1. FILLABILITY SCORE (0-40 points)
  // Can the user actually fill this order?
  // ========================================
  let fillabilityScore = 0;
  let maxFillPercentage = 0;
  let canFill = false;

  for (let i = 0; i < buyTokenIndices.length; i++) {
    const buyTokenInfo = getTokenInfoByIndex(Number(buyTokenIndices[i]));
    const buyTokenAddress = buyTokenInfo.address.toLowerCase();
    const requiredAmount = buyAmounts[i];
    const userBalance = userBalances.get(buyTokenAddress) ?? 0n;

    if (requiredAmount > 0n) {
      const fillPct = Number(userBalance) / Number(requiredAmount);
      if (fillPct > maxFillPercentage) {
        maxFillPercentage = Math.min(fillPct, 1);
      }
      if (userBalance >= requiredAmount) {
        canFill = true;
      }
    }
  }

  // Full fill = 40 points, partial scales linearly
  fillabilityScore = maxFillPercentage * 40;

  // ========================================
  // 2. PRICE ATTRACTIVENESS (0-40 points)
  // Is this a good deal vs market?
  // Uses same calculation as OpenPositionsTable
  // ========================================
  let priceScore = 20; // Default to neutral if no price data
  let priceDiscount = 0;

  // Get sell token price - prices are keyed by contract address (lowercase)
  const sellTokenPrice = prices[sellTokenAddress]?.price ?? 0;

  if (sellTokenPrice > 0 && remainingSellAmount > 0n) {
    // Calculate sell value in USD
    const sellAmountFormatted = parseFloat(formatUnits(remainingSellAmount, sellTokenInfo.decimals));
    const sellValueUsd = sellAmountFormatted * sellTokenPrice;

    // Calculate OTC % for the first buy token (matching marketplace display)
    // This shows how much above/below market the limit price is
    if (buyTokenIndices.length > 0 && sellValueUsd > 0) {
      const buyTokenInfo = getTokenInfoByIndex(Number(buyTokenIndices[0]));
      const buyTokenAddress = buyTokenInfo.address.toLowerCase();
      const buyTokenPrice = prices[buyTokenAddress]?.price ?? 0;
      const buyAmount = buyAmounts[0];
      const buyAmountFormatted = parseFloat(formatUnits(buyAmount, buyTokenInfo.decimals));

      if (buyTokenPrice > 0 && buyAmountFormatted > 0) {
        // Calculate the limit price per buy token (what the seller is implicitly pricing their token at)
        const limitBuyTokenPrice = sellValueUsd / buyAmountFormatted;
        // How much above/below market is this limit price?
        // Positive = seller pricing buy token above market = good deal for buyer
        // Negative = seller pricing buy token below market = bad deal for buyer
        priceDiscount = ((limitBuyTokenPrice - buyTokenPrice) / buyTokenPrice) * 100;

        // Scale: +20% above market = 40 points, 0% = 20 points, -20% below = 0 points
        if (priceDiscount >= 20) {
          priceScore = 40;
        } else if (priceDiscount >= 0) {
          priceScore = 20 + (priceDiscount / 20) * 20;
        } else if (priceDiscount >= -20) {
          priceScore = 20 + (priceDiscount / 20) * 20; // Goes from 20 to 0
        } else {
          priceScore = 0;
        }
      }
    }
  }

  // ========================================
  // 3. RELEVANCE SCORE (0-20 points)
  // Does user want what's being sold?
  // ========================================
  let relevanceScore = 0;

  // Check if user already holds the sell token (they might want more)
  const userSellBalance = userBalances.get(sellTokenAddress) ?? 0n;
  if (userSellBalance > 0n) {
    relevanceScore += 10; // User already holds this token
  }

  // Check if sell token is a core token
  if (CORE_TOKEN_ADDRESSES.includes(sellTokenAddress)) {
    relevanceScore += 10;
  }

  // ========================================
  // COMPOSITE SCORE
  // ========================================
  const breakdown: ScoreBreakdown = {
    fillabilityScore: Math.round(fillabilityScore),
    priceScore: Math.round(priceScore),
    relevanceScore: Math.round(relevanceScore),
  };

  const totalScore = Math.min(100, Math.round(fillabilityScore + priceScore + relevanceScore));

  return {
    ...order,
    score: totalScore,
    canFill,
    fillPercentage: Math.round(maxFillPercentage * 100),
    priceDiscount: Math.round(priceDiscount * 10) / 10, // Round to 1 decimal
    breakdown,
  };
}

// Helper to get all unique token addresses from orders (for price fetching)
export function extractUniqueTokenAddresses(orders: CompleteOrderDetails[]): string[] {
  const addresses = new Set<string>();

  orders.forEach(order => {
    const orderDetails = order.orderDetailsWithID.orderDetails;

    // Add sell token
    addresses.add(orderDetails.sellToken.toLowerCase());

    // Add buy tokens
    orderDetails.buyTokensIndex.forEach(index => {
      const tokenInfo = getTokenInfoByIndex(Number(index));
      addresses.add(tokenInfo.address.toLowerCase());
    });
  });

  return Array.from(addresses);
}
