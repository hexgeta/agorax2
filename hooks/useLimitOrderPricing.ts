/**
 * Limit Order Pricing Hook
 *
 * REFERENCE: See /docs/limit-order-data-flow.md for detailed documentation
 *
 * ============================================================================
 * QUICK REFERENCE - THE GOLDEN RULES
 * ============================================================================
 *
 * 1. PERCENTAGE IS KING - When tokens change, percentage stays, everything else recalculates
 * 2. SELL AMOUNT IS STABLE - Only changes when user types in it
 * 3. ONE-WAY DATA FLOW - Know which variable is "source" and which are "derived"
 *
 * ============================================================================
 * FORMULAS
 * ============================================================================
 *
 * marketPrice = sellTokenUsdPrice / buyTokenUsdPrice
 * limitPrice = marketPrice * (1 + percentage/100)
 * buyAmount = sellAmount * limitPrice
 * percentage = ((limitPrice / marketPrice) - 1) * 100
 *
 * ============================================================================
 * USER ACTIONS
 * ============================================================================
 *
 * | Action                  | Keeps Same                    | Recalculates                        |
 * |-------------------------|-------------------------------|-------------------------------------|
 * | Change sell token       | sellAmount, percentage        | marketPrice, limitPrice, buyAmount  |
 * | Change buy token        | sellAmount, percentage        | marketPrice, limitPrice, buyAmount  |
 * | Click % button          | sellAmount, tokens            | percentage, limitPrice, buyAmount   |
 * | Drag chart line         | sellAmount, tokens            | limitPrice, percentage, buyAmount   |
 * | Type limit price        | sellAmount, tokens            | limitPrice, percentage, buyAmount   |
 * | Type sell amount        | tokens, limitPrice, %         | sellAmount, buyAmount               |
 * | Type buy amount         | tokens, sellAmount            | buyAmount, limitPrice, percentage   |
 *
 */

import { useCallback } from 'react';

// Helper to format numbers with commas
const formatNumberWithCommas = (value: string): string => {
  if (!value) return '';
  const parts = value.split('.');
  parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return parts.join('.');
};

// Helper to remove commas
const removeCommas = (value: string): string => {
  return value.replace(/,/g, '');
};

// Helper to format calculated values
const formatCalculatedValue = (value: number): string => {
  if (value === 0) return '';
  const rounded = Math.round(value * 10000) / 10000;
  let str = rounded.toString();
  if (str.includes('.')) {
    str = str.replace(/\.?0+$/, '');
  }
  return formatNumberWithCommas(str);
};

export interface PricingState {
  sellAmount: string;
  buyAmounts: string[];
  limitPrice: string;
  pricePercentage: number | null;
}

export interface TokenPrices {
  getPrice: (address: string | undefined) => number;
}

export interface PricingCallbacks {
  setSellAmount: (value: string) => void;
  setBuyAmounts: (value: string[]) => void;
  setLimitPrice: (value: string) => void;
  setPricePercentage: (value: number | null) => void;
  onLimitPriceChange?: (price: number) => void;
}

export interface TokenInfo {
  a: string;
  ticker: string;
  decimals: number;
}

/**
 * Central hook for all limit order pricing logic
 */
export function useLimitOrderPricing(
  state: PricingState,
  callbacks: PricingCallbacks,
  prices: TokenPrices
) {
  const { sellAmount, buyAmounts, limitPrice, pricePercentage } = state;
  const { setSellAmount, setBuyAmounts, setLimitPrice, setPricePercentage, onLimitPriceChange } = callbacks;
  const { getPrice } = prices;

  /**
   * Calculate market price for a token pair
   * Returns: buy tokens per 1 sell token
   */
  const calculateMarketPrice = useCallback((
    sellTokenAddress: string | undefined,
    buyTokenAddress: string | undefined
  ): number => {
    if (!sellTokenAddress || !buyTokenAddress) return 0;

    const sellUsd = getPrice(sellTokenAddress);
    const buyUsd = getPrice(buyTokenAddress);

    if (sellUsd <= 0 || buyUsd <= 0) return 0;

    return sellUsd / buyUsd;
  }, [getPrice]);

  /**
   * Calculate limit price from market price and percentage
   */
  const calculateLimitPriceFromPercentage = useCallback((
    marketPrice: number,
    percentage: number | null
  ): number => {
    if (marketPrice <= 0) return 0;
    const pct = percentage ?? 0;
    return marketPrice * (1 + pct / 100);
  }, []);

  /**
   * Calculate percentage from limit price and market price
   */
  const calculatePercentageFromLimitPrice = useCallback((
    limitPriceNum: number,
    marketPrice: number
  ): number => {
    if (marketPrice <= 0 || limitPriceNum <= 0) return 0;
    return ((limitPriceNum / marketPrice) - 1) * 100;
  }, []);

  /**
   * Calculate buy amount from sell amount and limit price
   */
  const calculateBuyAmount = useCallback((
    sellAmt: number,
    limitPriceNum: number
  ): number => {
    if (sellAmt <= 0 || limitPriceNum <= 0) return 0;
    return sellAmt * limitPriceNum;
  }, []);

  /**
   * Calculate limit price from sell and buy amounts
   */
  const calculateLimitPriceFromAmounts = useCallback((
    sellAmt: number,
    buyAmt: number
  ): number => {
    if (sellAmt <= 0 || buyAmt <= 0) return 0;
    return buyAmt / sellAmt;
  }, []);

  // ============================================================================
  // ACTION HANDLERS
  // ============================================================================

  /**
   * Handle when user changes the SELL token
   * Keeps: sellAmount, percentage
   * Recalculates: marketPrice, limitPrice, buyAmount
   */
  const handleSellTokenChange = useCallback((
    newSellToken: TokenInfo,
    currentBuyToken: TokenInfo | null
  ) => {
    if (!currentBuyToken) return;

    const sellAmt = sellAmount ? parseFloat(removeCommas(sellAmount)) : 0;
    if (sellAmt <= 0) return;

    const newMarketPrice = calculateMarketPrice(newSellToken.a, currentBuyToken.a);
    if (newMarketPrice <= 0) return;

    // Apply existing percentage to get new limit price
    const newLimitPrice = calculateLimitPriceFromPercentage(newMarketPrice, pricePercentage);

    // Update limit price
    setLimitPrice(newLimitPrice.toFixed(8));
    onLimitPriceChange?.(newLimitPrice);

    // Calculate new buy amount
    const newBuyAmount = calculateBuyAmount(sellAmt, newLimitPrice);
    const newAmounts = [...buyAmounts];
    newAmounts[0] = formatCalculatedValue(newBuyAmount);
    setBuyAmounts(newAmounts);
  }, [
    sellAmount, buyAmounts, pricePercentage,
    calculateMarketPrice, calculateLimitPriceFromPercentage, calculateBuyAmount,
    setLimitPrice, setBuyAmounts, onLimitPriceChange
  ]);

  /**
   * Handle when user changes the BUY token (first/primary token)
   * Keeps: sellAmount, percentage
   * Recalculates: marketPrice, limitPrice, buyAmount
   */
  const handleBuyTokenChange = useCallback((
    newBuyToken: TokenInfo,
    currentSellToken: TokenInfo | null
  ) => {
    if (!currentSellToken) return;

    const sellAmt = sellAmount ? parseFloat(removeCommas(sellAmount)) : 0;
    if (sellAmt <= 0) return;

    const newMarketPrice = calculateMarketPrice(currentSellToken.a, newBuyToken.a);
    if (newMarketPrice <= 0) return;

    // Apply existing percentage to get new limit price
    const newLimitPrice = calculateLimitPriceFromPercentage(newMarketPrice, pricePercentage);

    // Update limit price
    setLimitPrice(newLimitPrice.toFixed(8));
    onLimitPriceChange?.(newLimitPrice);

    // Calculate new buy amount
    const newBuyAmount = calculateBuyAmount(sellAmt, newLimitPrice);
    const newAmounts = [...buyAmounts];
    newAmounts[0] = formatCalculatedValue(newBuyAmount);
    setBuyAmounts(newAmounts);
  }, [
    sellAmount, buyAmounts, pricePercentage,
    calculateMarketPrice, calculateLimitPriceFromPercentage, calculateBuyAmount,
    setLimitPrice, setBuyAmounts, onLimitPriceChange
  ]);

  /**
   * Handle when user clicks a percentage button
   * Keeps: sellAmount, tokens
   * Recalculates: percentage, limitPrice, buyAmount
   */
  const handlePercentageButtonClick = useCallback((
    newPercentage: number,
    sellToken: TokenInfo | null,
    buyToken: TokenInfo | null
  ) => {
    if (!sellToken || !buyToken) return;

    const sellAmt = sellAmount ? parseFloat(removeCommas(sellAmount)) : 0;

    const marketPrice = calculateMarketPrice(sellToken.a, buyToken.a);
    if (marketPrice <= 0) return;

    // Set new percentage
    setPricePercentage(newPercentage);

    // Calculate new limit price
    const newLimitPrice = calculateLimitPriceFromPercentage(marketPrice, newPercentage);
    setLimitPrice(newLimitPrice.toFixed(8));
    onLimitPriceChange?.(newLimitPrice);

    // Calculate new buy amount if we have sell amount
    if (sellAmt > 0) {
      const newBuyAmount = calculateBuyAmount(sellAmt, newLimitPrice);
      const newAmounts = [...buyAmounts];
      newAmounts[0] = formatCalculatedValue(newBuyAmount);
      setBuyAmounts(newAmounts);
    }
  }, [
    sellAmount, buyAmounts,
    calculateMarketPrice, calculateLimitPriceFromPercentage, calculateBuyAmount,
    setLimitPrice, setPricePercentage, setBuyAmounts, onLimitPriceChange
  ]);

  /**
   * Handle when user drags the chart line or types in limit price
   * Keeps: sellAmount, tokens
   * Recalculates: limitPrice, percentage, buyAmount
   */
  const handleLimitPriceChange = useCallback((
    newLimitPrice: number,
    sellToken: TokenInfo | null,
    buyToken: TokenInfo | null
  ) => {
    if (!sellToken || !buyToken || newLimitPrice <= 0) return;

    const sellAmt = sellAmount ? parseFloat(removeCommas(sellAmount)) : 0;

    // Update limit price
    setLimitPrice(newLimitPrice.toFixed(8));
    onLimitPriceChange?.(newLimitPrice);

    // Calculate new percentage from market
    const marketPrice = calculateMarketPrice(sellToken.a, buyToken.a);
    if (marketPrice > 0) {
      const newPercentage = calculatePercentageFromLimitPrice(newLimitPrice, marketPrice);
      setPricePercentage(newPercentage);
    }

    // Calculate new buy amount if we have sell amount
    if (sellAmt > 0) {
      const newBuyAmount = calculateBuyAmount(sellAmt, newLimitPrice);
      const newAmounts = [...buyAmounts];
      newAmounts[0] = formatCalculatedValue(newBuyAmount);
      setBuyAmounts(newAmounts);
    }
  }, [
    sellAmount, buyAmounts,
    calculateMarketPrice, calculatePercentageFromLimitPrice, calculateBuyAmount,
    setLimitPrice, setPricePercentage, setBuyAmounts, onLimitPriceChange
  ]);

  /**
   * Handle when user types in the sell amount input
   * Keeps: tokens, limitPrice, percentage
   * Recalculates: buyAmount
   */
  const handleSellAmountChange = useCallback((
    newSellAmount: string
  ) => {
    setSellAmount(newSellAmount);

    const sellAmt = newSellAmount ? parseFloat(removeCommas(newSellAmount)) : 0;
    const limitPriceNum = parseFloat(limitPrice) || 0;

    if (sellAmt > 0 && limitPriceNum > 0) {
      const newBuyAmount = calculateBuyAmount(sellAmt, limitPriceNum);
      const newAmounts = [...buyAmounts];
      newAmounts[0] = formatCalculatedValue(newBuyAmount);
      setBuyAmounts(newAmounts);
    }
  }, [limitPrice, buyAmounts, calculateBuyAmount, setSellAmount, setBuyAmounts]);

  /**
   * Handle when user types in the buy amount input
   * Keeps: tokens, sellAmount
   * Recalculates: buyAmount, limitPrice, percentage
   */
  const handleBuyAmountChange = useCallback((
    newBuyAmount: string,
    index: number,
    sellToken: TokenInfo | null,
    buyToken: TokenInfo | null
  ) => {
    const newAmounts = [...buyAmounts];
    newAmounts[index] = newBuyAmount;
    setBuyAmounts(newAmounts);

    // Only recalculate limit price for the first buy token
    if (index !== 0) return;
    if (!sellToken || !buyToken) return;

    const sellAmt = sellAmount ? parseFloat(removeCommas(sellAmount)) : 0;
    const buyAmt = newBuyAmount ? parseFloat(removeCommas(newBuyAmount)) : 0;

    if (sellAmt > 0 && buyAmt > 0) {
      // Calculate new limit price
      const newLimitPrice = calculateLimitPriceFromAmounts(sellAmt, buyAmt);
      setLimitPrice(newLimitPrice.toFixed(8));
      onLimitPriceChange?.(newLimitPrice);

      // Calculate new percentage from market
      const marketPrice = calculateMarketPrice(sellToken.a, buyToken.a);
      if (marketPrice > 0) {
        const newPercentage = calculatePercentageFromLimitPrice(newLimitPrice, marketPrice);
        setPricePercentage(newPercentage);
      }
    }
  }, [
    sellAmount, buyAmounts,
    calculateMarketPrice, calculateLimitPriceFromAmounts, calculatePercentageFromLimitPrice,
    setLimitPrice, setPricePercentage, setBuyAmounts, onLimitPriceChange
  ]);

  /**
   * Recalculate buy amount for additional tokens (index > 0) based on bound/unbound mode
   */
  const handleAdditionalBuyTokenChange = useCallback((
    newBuyToken: TokenInfo,
    index: number,
    sellToken: TokenInfo | null,
    firstBuyToken: TokenInfo | null,
    pricesBound: boolean
  ) => {
    if (!sellToken || index === 0) return;

    const sellAmt = sellAmount ? parseFloat(removeCommas(sellAmount)) : 0;
    if (sellAmt <= 0) return;

    const sellUsd = getPrice(sellToken.a);
    const tokenUsd = getPrice(newBuyToken.a);

    if (sellUsd <= 0 || tokenUsd <= 0) return;

    const sellUsdValue = sellAmt * sellUsd;
    let premiumMultiplier = 1;

    // If prices are bound, apply same premium as first token
    if (pricesBound && firstBuyToken) {
      const firstBuyUsd = getPrice(firstBuyToken.a);
      const limitPriceNum = parseFloat(limitPrice) || 0;
      const marketPriceForFirst = firstBuyUsd > 0 ? sellUsd / firstBuyUsd : 0;
      premiumMultiplier = marketPriceForFirst > 0 && limitPriceNum > 0
        ? limitPriceNum / marketPriceForFirst
        : 1;
    }

    const marketAmount = sellUsdValue / tokenUsd;
    const adjustedAmount = marketAmount * premiumMultiplier;

    const newAmounts = [...buyAmounts];
    newAmounts[index] = formatCalculatedValue(adjustedAmount);
    setBuyAmounts(newAmounts);
  }, [sellAmount, limitPrice, buyAmounts, getPrice, setBuyAmounts]);

  return {
    // Utility functions
    calculateMarketPrice,
    calculateLimitPriceFromPercentage,
    calculatePercentageFromLimitPrice,
    calculateBuyAmount,
    calculateLimitPriceFromAmounts,

    // Action handlers
    handleSellTokenChange,
    handleBuyTokenChange,
    handlePercentageButtonClick,
    handleLimitPriceChange,
    handleSellAmountChange,
    handleBuyAmountChange,
    handleAdditionalBuyTokenChange,

    // Helpers
    formatCalculatedValue,
    removeCommas,
    formatNumberWithCommas,
  };
}
