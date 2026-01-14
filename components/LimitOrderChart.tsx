'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import NumberFlow from '@number-flow/react';
import { TOKEN_CONSTANTS } from '@/constants/crypto';
import { formatTokenTicker } from '@/utils/tokenUtils';
import { CoinLogo } from '@/components/ui/CoinLogo';
import { TokenLogo } from '@/components/TokenLogo';
import logoManifest from '@/constants/logo-manifest.json';

import { LiquidGlassCard } from '@/components/ui/liquid-glass';

interface LimitOrderChartProps {
  sellTokenAddress?: string;
  buyTokenAddresses?: (string | undefined)[];
  limitOrderPrice?: number;
  invertPriceDisplay?: boolean;
  pricesBound?: boolean;
  individualLimitPrices?: (number | undefined)[];
  onLimitPriceChange?: (newPrice: number) => void;
  onIndividualLimitPriceChange?: (index: number, newPrice: number) => void;
  onCurrentPriceChange?: (price: number) => void;
  onDragStateChange?: (isDragging: boolean) => void;
}

export function LimitOrderChart({ sellTokenAddress, buyTokenAddresses = [], limitOrderPrice, invertPriceDisplay = true, pricesBound = true, individualLimitPrices = [], onLimitPriceChange, onIndividualLimitPriceChange, onCurrentPriceChange, onDragStateChange }: LimitOrderChartProps) {
  const [currentPrice, setCurrentPrice] = useState<number | null>(null);
  const [buyTokenUsdPrices, setBuyTokenUsdPrices] = useState<Record<string, number>>({});
  const [sellTokenUsdPrice, setSellTokenUsdPrice] = useState<number>(0);
  const [loading, setLoading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [draggedPrice, setDraggedPrice] = useState<number | null>(null);
  const [draggingTokenIndex, setDraggingTokenIndex] = useState<number | null>(null);
  const [draggedIndividualPrices, setDraggedIndividualPrices] = useState<Record<number, number>>({});
  const [displayedTokenIndex, setDisplayedTokenIndex] = useState(0); // For cycling through tokens
  const containerRef = useRef<HTMLDivElement>(null);
  const rafRef = useRef<number | null>(null);
  const justReleasedRef = useRef<boolean>(false);
  const lastUpdateRef = useRef<number>(0);
  const cooldownTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Track stable prices for Y-axis scaling (only update when NOT dragging)
  const stableLimitPriceRef = useRef<number | undefined>(limitOrderPrice);
  const stableIndividualPricesRef = useRef<(number | undefined)[]>(individualLimitPrices);

  // Format number to 4 significant figures
  const formatSignificantFigures = (num: number, sigFigs: number = 4): string => {
    if (num === 0) return '0';
    const magnitude = Math.floor(Math.log10(Math.abs(num)));
    const scale = Math.pow(10, sigFigs - magnitude - 1);
    return (Math.round(num * scale) / scale).toString();
  };

  // Default to PLS -> HEX if no tokens provided
  const sellToken = sellTokenAddress || '0x000000000000000000000000000000000000dead'; // PLS
  // Use first buy token for price calculation
  const buyToken = (buyTokenAddresses && buyTokenAddresses[0]) || '0x2b591e99afe9f32eaa6214f7b7629768c40eeb39'; // HEX

  useEffect(() => {
    fetchPriceData();
    // Refresh price every 10 seconds
    const interval = setInterval(fetchPriceData, 10000);
    return () => clearInterval(interval);
  }, [sellToken, buyToken, JSON.stringify(buyTokenAddresses)]);

  const fetchPriceData = async () => {
    if (!sellToken || !buyToken) return;

    setLoading(true);
    try {
      // Fetch sell token config
      const sellTokenConfig = TOKEN_CONSTANTS.find(t => t.a?.toLowerCase() === sellToken.toLowerCase());

      if (!sellTokenConfig?.dexs) {
        setLoading(false);
        return;
      }

      // Get pair address for sell token
      const sellPairAddress = Array.isArray(sellTokenConfig.dexs) ? sellTokenConfig.dexs[0] : sellTokenConfig.dexs;

      // Fetch sell token price
      const sellResponse = await fetch(`https://api.dexscreener.com/latest/dex/pairs/pulsechain/${sellPairAddress}`);
      if (!sellResponse.ok) {
        throw new Error('Failed to fetch sell token price');
      }
      const sellData = await sellResponse.json();
      const sellPair = sellData.pairs?.[0];
      if (!sellPair?.priceUsd) {
        throw new Error('Invalid sell token price data');
      }
      const sellPriceUsd = parseFloat(sellPair.priceUsd);
      setSellTokenUsdPrice(sellPriceUsd);

      // Fetch prices for all buy tokens
      const validBuyAddresses = buyTokenAddresses.filter(addr => addr);
      const buyTokenConfigs = validBuyAddresses.map(addr =>
        TOKEN_CONSTANTS.find(t => t.a?.toLowerCase() === addr?.toLowerCase())
      ).filter(config => config?.dexs);

      const buyPricePromises = buyTokenConfigs.map(async (config) => {
        if (!config?.dexs) return null;
        const pairAddress = Array.isArray(config.dexs) ? config.dexs[0] : config.dexs;
        const response = await fetch(`https://api.dexscreener.com/latest/dex/pairs/pulsechain/${pairAddress}`);
        if (!response.ok) return null;
        const data = await response.json();
        const pair = data.pairs?.[0];
        if (!pair?.priceUsd) return null;
        return { address: config.a?.toLowerCase(), price: parseFloat(pair.priceUsd) };
      });

      const buyPriceResults = await Promise.all(buyPricePromises);
      const newBuyTokenPrices: Record<string, number> = {};
      buyPriceResults.forEach(result => {
        if (result) {
          newBuyTokenPrices[result.address] = result.price;
        }
      });
      setBuyTokenUsdPrices(newBuyTokenPrices);

      // Calculate current ratio for the first buy token
      const firstBuyTokenPrice = newBuyTokenPrices[buyToken.toLowerCase()];
      if (firstBuyTokenPrice) {
        const currentRatio = sellPriceUsd / firstBuyTokenPrice;
        setCurrentPrice(currentRatio);

        // Notify parent of current price change (always in base direction)
        if (onCurrentPriceChange) {
          onCurrentPriceChange(currentRatio);
        }
      }

    } catch (error) {
      // Error fetching price data
    } finally {
      setLoading(false);
    }
  };

  const sellTokenInfo = TOKEN_CONSTANTS.find(t => t.a?.toLowerCase() === sellToken.toLowerCase());
  const buyTokenInfo = TOKEN_CONSTANTS.find(t => t.a?.toLowerCase() === buyToken.toLowerCase());

  // Get info for all buy tokens (create placeholder for tokens not in TOKEN_CONSTANTS)
  const buyTokenInfos = buyTokenAddresses
    .filter(addr => addr)
    .map(addr => {
      const found = TOKEN_CONSTANTS.find(t => t.a?.toLowerCase() === addr?.toLowerCase());
      if (found) return found;
      // Create placeholder for tokens not in TOKEN_CONSTANTS
      return { a: addr, ticker: 'UNKNOWN', dexs: null };
    });

  // When inverted, swap the display token info
  const displayBaseTokenInfo = invertPriceDisplay ? buyTokenInfo : sellTokenInfo;
  const displayQuoteTokenInfo = invertPriceDisplay ? sellTokenInfo : buyTokenInfo;

  // For multiple tokens, get all display tokens
  // When inverted: price is "X sell_tokens per 1 buy_token", so we show buy token names
  // We want to show all buy tokens with their respective limit prices
  const displayQuoteTokenInfos = buyTokenInfos.length > 0
    ? buyTokenInfos
    : [buyTokenInfo].filter(Boolean);

  // Reset displayed token index if it's out of bounds
  useEffect(() => {
    if (displayedTokenIndex >= displayQuoteTokenInfos.length) {
      setDisplayedTokenIndex(0);
    }
  }, [displayQuoteTokenInfos.length, displayedTokenIndex]);

  // Cycle to next token on click
  const cycleDisplayedToken = useCallback((e: React.MouseEvent) => {
    e.stopPropagation(); // Don't trigger drag
    if (displayQuoteTokenInfos.length > 1) {
      setDisplayedTokenIndex(prev => (prev + 1) % displayQuoteTokenInfos.length);
    }
  }, [displayQuoteTokenInfos.length]);

  // Calculate limit price for each buy token based on USD prices
  // The limitOrderPrice is expressed as "sellToken per first buyToken"
  // We need to calculate the equivalent for other buy tokens
  const calculateLimitPriceForToken = (tokenAddress: string | undefined): number | null => {
    if (!tokenAddress || !limitOrderPrice || !sellTokenUsdPrice) return null;

    const firstBuyTokenAddress = buyTokenAddresses[0]?.toLowerCase();
    const tokenAddressLower = tokenAddress.toLowerCase();

    // If this is the first buy token, use the limit price directly
    if (tokenAddressLower === firstBuyTokenAddress) {
      return limitOrderPrice;
    }

    // For other buy tokens, calculate based on USD prices
    const firstBuyTokenUsdPrice = firstBuyTokenAddress ? buyTokenUsdPrices[firstBuyTokenAddress] : 0;
    const thisTokenUsdPrice = buyTokenUsdPrices[tokenAddressLower];

    if (!firstBuyTokenUsdPrice || !thisTokenUsdPrice) return null;

    // The premium/discount from the first token's market rate
    const marketPriceForFirst = sellTokenUsdPrice / firstBuyTokenUsdPrice;
    const premiumMultiplier = limitOrderPrice / marketPriceForFirst;

    // Apply same premium to this token's market rate
    const marketPriceForThis = sellTokenUsdPrice / thisTokenUsdPrice;
    return marketPriceForThis * premiumMultiplier;
  };

  // Colors for multiple unbound price lines
  const unboundLineColors = [
    { line: '#FF0080', text: '#FF0080', bg: 'bg-pink-500/10', border: 'border-pink-500/30', filter: 'brightness(0) saturate(100%) invert(47%) sepia(99%) saturate(6544%) hue-rotate(312deg) brightness(103%) contrast(103%)' }, // Pink
    { line: '#8B5CF6', text: '#8B5CF6', bg: 'bg-purple-500/10', border: 'border-purple-500/30', filter: 'brightness(0) saturate(100%) invert(53%) sepia(84%) saturate(4132%) hue-rotate(242deg) brightness(100%) contrast(94%)' }, // Purple
    { line: '#F59E0B', text: '#F59E0B', bg: 'bg-amber-500/10', border: 'border-amber-500/30', filter: 'brightness(0) saturate(100%) invert(64%) sepia(86%) saturate(1267%) hue-rotate(358deg) brightness(99%) contrast(95%)' }, // Amber
    { line: '#10B981', text: '#10B981', bg: 'bg-emerald-500/10', border: 'border-emerald-500/30', filter: 'brightness(0) saturate(100%) invert(56%) sepia(81%) saturate(388%) hue-rotate(113deg) brightness(91%) contrast(92%)' }, // Emerald
    { line: '#EF4444', text: '#EF4444', bg: 'bg-red-500/10', border: 'border-red-500/30', filter: 'brightness(0) saturate(100%) invert(35%) sepia(96%) saturate(2674%) hue-rotate(343deg) brightness(99%) contrast(89%)' }, // Red
    { line: '#3B82F6', text: '#3B82F6', bg: 'bg-blue-500/10', border: 'border-blue-500/30', filter: 'brightness(0) saturate(100%) invert(47%) sepia(96%) saturate(1755%) hue-rotate(199deg) brightness(99%) contrast(94%)' }, // Blue
    { line: '#EC4899', text: '#EC4899', bg: 'bg-fuchsia-500/10', border: 'border-fuchsia-500/30', filter: 'brightness(0) saturate(100%) invert(40%) sepia(85%) saturate(2165%) hue-rotate(313deg) brightness(99%) contrast(93%)' }, // Fuchsia
    { line: '#14B8A6', text: '#14B8A6', bg: 'bg-teal-500/10', border: 'border-teal-500/30', filter: 'brightness(0) saturate(100%) invert(58%) sepia(68%) saturate(505%) hue-rotate(131deg) brightness(94%) contrast(86%)' }, // Teal
    { line: '#F97316', text: '#F97316', bg: 'bg-orange-500/10', border: 'border-orange-500/30', filter: 'brightness(0) saturate(100%) invert(58%) sepia(97%) saturate(1789%) hue-rotate(355deg) brightness(101%) contrast(94%)' }, // Orange
    { line: '#6366F1', text: '#6366F1', bg: 'bg-indigo-500/10', border: 'border-indigo-500/30', filter: 'brightness(0) saturate(100%) invert(40%) sepia(94%) saturate(2085%) hue-rotate(222deg) brightness(98%) contrast(91%)' }, // Indigo
  ];

  // Get limit price for a specific token index (from individual prices array or calculated)
  const getLimitPriceForIndex = (index: number): number | null => {
    // First check if we have an explicit individual price
    if (!pricesBound && individualLimitPrices[index] !== undefined && individualLimitPrices[index] !== null) {
      return individualLimitPrices[index] as number;
    }
    // Fall back to calculated price based on USD prices
    const tokenAddress = buyTokenAddresses[index];
    const calculatedPrice = calculateLimitPriceForToken(tokenAddress);
    if (calculatedPrice) return calculatedPrice;

    // Last resort: if we have limitOrderPrice and this is the first token, use it directly
    if (index === 0 && limitOrderPrice) {
      return limitOrderPrice;
    }

    return null;
  };

  // Calculate display prices (invert if needed)
  const displayCurrentPrice = currentPrice && invertPriceDisplay && currentPrice > 0
    ? 1 / currentPrice
    : currentPrice;

  const displayLimitPrice = limitOrderPrice && invertPriceDisplay && limitOrderPrice > 0
    ? 1 / limitOrderPrice
    : limitOrderPrice;

  // Update stable price refs only when NOT dragging (for Y-axis scaling)
  // This prevents the axis from jumping while dragging
  if (!isDragging) {
    stableLimitPriceRef.current = limitOrderPrice;
    stableIndividualPricesRef.current = individualLimitPrices;
  }

  // Calculate visual scale for the price display
  // Use a symmetric percentage range around current price for accurate % representation
  // Dynamically expand range only when any LIMIT PRICE is outside the default ±30% range
  // Use STABLE prices (not affected by dragging) to prevent axis jumping
  const defaultRangePercent = 30;
  const rangePercent = (() => {
    let maxAbsPercent = 0;

    // Use stable prices for calculation (not affected by dragging)
    const stableLimitPrice = stableLimitPriceRef.current;
    const stableIndividualPrices = stableIndividualPricesRef.current;

    // Check primary limit price percentage from market
    if (stableLimitPrice && currentPrice && currentPrice > 0) {
      let limitPricePercent: number;
      if (invertPriceDisplay) {
        const invertedLimit = 1 / stableLimitPrice;
        const invertedMarket = 1 / currentPrice;
        limitPricePercent = ((invertedLimit - invertedMarket) / invertedMarket) * 100;
      } else {
        limitPricePercent = ((stableLimitPrice - currentPrice) / currentPrice) * 100;
      }
      maxAbsPercent = Math.max(maxAbsPercent, Math.abs(limitPricePercent));
    }

    // Check all individual buy token limit prices
    if (sellTokenUsdPrice > 0 && buyTokenAddresses.length > 0) {
      buyTokenAddresses.forEach((tokenAddress, index) => {
        if (!tokenAddress) return;

        const tokenUsdPrice = buyTokenUsdPrices[tokenAddress.toLowerCase()];
        if (!tokenUsdPrice || tokenUsdPrice <= 0) return;

        // Get the token's market price
        const tokenMarketPrice = sellTokenUsdPrice / tokenUsdPrice;
        if (tokenMarketPrice <= 0) return;

        // Get the limit price for this token (use stable prices)
        const tokenLimitPrice = stableIndividualPrices[index] ?? stableLimitPrice;
        if (!tokenLimitPrice) return;

        // Calculate percentage from market for this token
        let percentageFromMarket: number;
        if (invertPriceDisplay) {
          const invertedLimitPrice = 1 / tokenLimitPrice;
          const invertedMarketPrice = 1 / tokenMarketPrice;
          percentageFromMarket = ((invertedLimitPrice - invertedMarketPrice) / invertedMarketPrice) * 100;
        } else {
          percentageFromMarket = ((tokenLimitPrice - tokenMarketPrice) / tokenMarketPrice) * 100;
        }

        maxAbsPercent = Math.max(maxAbsPercent, Math.abs(percentageFromMarket));
      });
    }

    if (maxAbsPercent > defaultRangePercent) {
      // Round up to nearest 10% with some padding to ensure all prices are visible
      return Math.ceil((maxAbsPercent + 5) / 10) * 10;
    }

    return defaultRangePercent;
  })();

  const minPrice = (displayCurrentPrice || 0) * (1 - rangePercent / 100);
  const maxPrice = (displayCurrentPrice || 0) * (1 + rangePercent / 100);
  const priceRange = maxPrice - minPrice || 1;

  const currentPricePosition = displayCurrentPrice
    ? ((displayCurrentPrice - minPrice) / priceRange) * 100
    : 50;

  // Use draggedPrice during drag and briefly after for smooth rendering
  const basePriceToDisplay = (isDragging || justReleasedRef.current) && draggedPrice
    ? draggedPrice
    : limitOrderPrice;

  // Apply inversion to the price to display if needed
  const priceToDisplay = basePriceToDisplay && invertPriceDisplay && basePriceToDisplay > 0
    ? 1 / basePriceToDisplay
    : basePriceToDisplay;

  const limitPricePosition = priceToDisplay
    ? ((priceToDisplay - minPrice) / priceRange) * 100
    : null;

  // Drag handlers for limit price line
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (!limitOrderPrice || !onLimitPriceChange) return;
    e.preventDefault();

    // Clear any pending cooldown from previous drag
    if (cooldownTimeoutRef.current) {
      clearTimeout(cooldownTimeoutRef.current);
      cooldownTimeoutRef.current = null;
    }

    justReleasedRef.current = false;
    setIsDragging(true);
    setDraggedPrice(limitOrderPrice); // Initialize with current price
    if (onDragStateChange) onDragStateChange(true);
  }, [limitOrderPrice, onLimitPriceChange, onDragStateChange]);

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!isDragging || !containerRef.current || !onLimitPriceChange || !currentPrice) return;

    // Cancel any pending animation frame
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
    }

    // Use requestAnimationFrame for smooth updates
    rafRef.current = requestAnimationFrame(() => {
      if (!containerRef.current) return;

      const now = Date.now();

      const rect = containerRef.current.getBoundingClientRect();
      const y = e.clientY - rect.top;
      const percentage = Math.max(0, Math.min(100, ((rect.height - y) / rect.height) * 100));

      // Use display price for calculations
      const displayPrice = invertPriceDisplay && currentPrice > 0 ? 1 / currentPrice : currentPrice;

      // Calculate price range dynamically based on display price and current rangePercent
      const minPriceCalc = displayPrice * (1 - rangePercent / 100);
      const maxPriceCalc = displayPrice * (1 + rangePercent / 100);
      const priceRangeCalc = maxPriceCalc - minPriceCalc;

      const newDisplayPrice = minPriceCalc + (percentage / 100) * priceRangeCalc;

      if (newDisplayPrice > 0) {
        // Convert back to base price before storing/sending
        const newBasePrice = invertPriceDisplay ? 1 / newDisplayPrice : newDisplayPrice;

        setDraggedPrice(newBasePrice); // Store in base direction

        // Throttle form updates to every 50ms to reduce re-renders
        if (now - lastUpdateRef.current > 50) {
          onLimitPriceChange(newBasePrice); // Send base price to parent
          lastUpdateRef.current = now;
        }
      }
    });
  }, [isDragging, currentPrice, invertPriceDisplay, onLimitPriceChange, rangePercent]);

  const handleMouseUp = useCallback(() => {
    // Cancel any pending animation frame
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }

    // Send final update immediately on release
    if (draggedPrice && onLimitPriceChange) {
      onLimitPriceChange(draggedPrice);
    }

    setIsDragging(false);
    justReleasedRef.current = true; // Keep using dragged price during cooldown
    if (onDragStateChange) onDragStateChange(false);

    // Keep using draggedPrice for a short time to prevent glitches
    // This gives the form time to process and stabilize
    cooldownTimeoutRef.current = setTimeout(() => {
      justReleasedRef.current = false;
      setDraggedPrice(null);
      cooldownTimeoutRef.current = null;
    }, 300);
  }, [draggedPrice, onLimitPriceChange, onDragStateChange]);

  // Handlers for dragging individual token lines (when unbound)
  const handleIndividualMouseDown = useCallback((e: React.MouseEvent, tokenIndex: number, tokenMarketPrice: number) => {
    if (!onIndividualLimitPriceChange) return;
    e.preventDefault();
    e.stopPropagation();

    if (cooldownTimeoutRef.current) {
      clearTimeout(cooldownTimeoutRef.current);
      cooldownTimeoutRef.current = null;
    }

    justReleasedRef.current = false;
    setIsDragging(true);
    setDraggingTokenIndex(tokenIndex);

    // Initialize with current individual price or market price
    const currentIndividualPrice = individualLimitPrices[tokenIndex] || tokenMarketPrice;
    setDraggedIndividualPrices(prev => ({ ...prev, [tokenIndex]: currentIndividualPrice }));

    if (onDragStateChange) onDragStateChange(true);
  }, [onIndividualLimitPriceChange, individualLimitPrices, onDragStateChange]);

  const handleIndividualMouseMove = useCallback((e: MouseEvent) => {
    if (!isDragging || draggingTokenIndex === null || !containerRef.current || !onIndividualLimitPriceChange) return;

    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
    }

    rafRef.current = requestAnimationFrame(() => {
      if (!containerRef.current || draggingTokenIndex === null) return;

      const now = Date.now();
      const rect = containerRef.current.getBoundingClientRect();
      const y = e.clientY - rect.top;
      // Position: 0% at bottom, 100% at top
      const positionPercent = Math.max(0, Math.min(100, ((rect.height - y) / rect.height) * 100));

      // Get the token's market price (base price: buy tokens per sell token)
      const tokenAddress = buyTokenAddresses[draggingTokenIndex]?.toLowerCase();
      const tokenUsdPrice = tokenAddress ? buyTokenUsdPrices[tokenAddress] : 0;
      const tokenMarketPrice = sellTokenUsdPrice > 0 && tokenUsdPrice > 0
        ? sellTokenUsdPrice / tokenUsdPrice
        : 0;

      if (tokenMarketPrice > 0) {
        // Use the SAME formula as position display calculation (reversed)
        // Position display: ((percentageFromMarket + rangePercent) / (rangePercent * 2)) * 100
        // So: percentageFromMarket = (positionPercent / 100 * rangePercent * 2) - rangePercent
        const percentageFromMarket = (positionPercent / 100 * rangePercent * 2) - rangePercent;

        // Now calculate the new limit price from the percentage
        // When inverted: percentageFromMarket = ((invertedLimit - invertedMarket) / invertedMarket) * 100
        // So: invertedLimit = invertedMarket * (1 + percentageFromMarket / 100)
        // And: limitPrice = 1 / invertedLimit
        // When not inverted: percentageFromMarket = ((limitPrice - marketPrice) / marketPrice) * 100
        // So: limitPrice = marketPrice * (1 + percentageFromMarket / 100)

        let newLimitPrice: number;
        if (invertPriceDisplay) {
          const invertedMarketPrice = 1 / tokenMarketPrice;
          const invertedLimitPrice = invertedMarketPrice * (1 + percentageFromMarket / 100);
          newLimitPrice = 1 / invertedLimitPrice;
        } else {
          newLimitPrice = tokenMarketPrice * (1 + percentageFromMarket / 100);
        }

        if (newLimitPrice > 0) {
          setDraggedIndividualPrices(prev => ({ ...prev, [draggingTokenIndex]: newLimitPrice }));

          // Throttle form updates
          if (now - lastUpdateRef.current > 50) {
            onIndividualLimitPriceChange(draggingTokenIndex, newLimitPrice);
            lastUpdateRef.current = now;
          }
        }
      }
    });
  }, [isDragging, draggingTokenIndex, buyTokenAddresses, buyTokenUsdPrices, sellTokenUsdPrice, invertPriceDisplay, onIndividualLimitPriceChange, rangePercent]);

  const handleIndividualMouseUp = useCallback(() => {
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }

    // Send final update
    if (draggingTokenIndex !== null && draggedIndividualPrices[draggingTokenIndex] && onIndividualLimitPriceChange) {
      onIndividualLimitPriceChange(draggingTokenIndex, draggedIndividualPrices[draggingTokenIndex]);
    }

    setIsDragging(false);
    justReleasedRef.current = true;
    if (onDragStateChange) onDragStateChange(false);

    const tokenIdx = draggingTokenIndex;
    setDraggingTokenIndex(null);

    cooldownTimeoutRef.current = setTimeout(() => {
      justReleasedRef.current = false;
      if (tokenIdx !== null) {
        setDraggedIndividualPrices(prev => {
          const newPrices = { ...prev };
          delete newPrices[tokenIdx];
          return newPrices;
        });
      }
      cooldownTimeoutRef.current = null;
    }, 300);
  }, [draggingTokenIndex, draggedIndividualPrices, onIndividualLimitPriceChange, onDragStateChange]);

  useEffect(() => {
    if (isDragging) {
      // Use individual handlers when dragging individual tokens
      const moveHandler = draggingTokenIndex !== null ? handleIndividualMouseMove : handleMouseMove;
      const upHandler = draggingTokenIndex !== null ? handleIndividualMouseUp : handleMouseUp;

      document.addEventListener('mousemove', moveHandler);
      document.addEventListener('mouseup', upHandler);
      return () => {
        document.removeEventListener('mousemove', moveHandler);
        document.removeEventListener('mouseup', upHandler);
        // Cleanup animation frame
        if (rafRef.current) {
          cancelAnimationFrame(rafRef.current);
          rafRef.current = null;
        }
      };
    }
  }, [isDragging, draggingTokenIndex, handleMouseMove, handleMouseUp, handleIndividualMouseMove, handleIndividualMouseUp]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (cooldownTimeoutRef.current) {
        clearTimeout(cooldownTimeoutRef.current);
      }
    };
  }, []);

  return (
    <LiquidGlassCard
      className="w-full h-full min-h-[400px] max-h-[calc(100vh-200px)] flex flex-col overflow-y-auto p-6"
      shadowIntensity="sm"
      glowIntensity="sm"
      blurIntensity="xl"
    >
      {/* Token Pair Info */}
      {displayBaseTokenInfo && displayQuoteTokenInfo && (
        <div className="flex flex-col gap-4 mb-6">
          <div className="flex items-center justify-between">
            <h3 className="text-2xl font-bold text-white">
              <span className="flex items-center gap-2">
                <img
                  src={(() => {
                    const format = (logoManifest as Record<string, string>)[displayBaseTokenInfo.ticker];
                    return format ? `/coin-logos/${displayBaseTokenInfo.ticker}.${format}` : '/coin-logos/default.svg';
                  })()}
                  alt={`${displayBaseTokenInfo.ticker} logo`}
                  className="w-6 h-6 inline-block"
                  onError={(e) => {
                    e.currentTarget.src = '/coin-logos/default.svg';
                  }}
                />
                {formatTokenTicker(displayBaseTokenInfo.ticker)} Price
              </span>
            </h3>
            {loading && (
              <span className="text-xs text-white/50 animate-pulse">Updating...</span>
            )}
          </div>
        </div>
      )}

      {/* Price Display */}
      {loading && !currentPrice ? (
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-white/70">Loading price data...</div>
        </div>
      ) : currentPrice ? (
        <div className="space-y-6 flex-1 flex flex-col">
          {/* Visual Price Scale */}
          <div
            ref={containerRef}
            className="relative flex-1 bg-black/10 rounded select-none"
          >
            {/* Y-axis tick marks - dynamically generated based on range */}
            {(() => {
              // Generate tick marks based on current range
              const ticks: number[] = [];
              const step = rangePercent <= 30 ? 5 : rangePercent <= 50 ? 10 : rangePercent <= 100 ? 20 : 25;
              for (let i = -rangePercent; i <= rangePercent; i += step) {
                ticks.push(i);
              }
              // Ensure the top endpoint is always included
              if (ticks[ticks.length - 1] !== rangePercent) {
                ticks.push(rangePercent);
              }
              return ticks;
            })().map((percentDiff) => {
              // Calculate the actual price at this percentage difference from display current price
              const priceAtPercent = displayCurrentPrice ? displayCurrentPrice * (1 + percentDiff / 100) : 0;

              // Calculate where this price would be positioned in the chart range
              const position = ((priceAtPercent - minPrice) / priceRange) * 100;

              // Only show if within bounds
              if (position < 0 || position > 100) return null;

              return (
                <div
                  key={percentDiff}
                  className="absolute left-0 w-full flex items-center pointer-events-none"
                  style={{ bottom: `${position}%`, zIndex: 0, transform: 'translateY(50%)' }}
                >
                  <div className="w-[50px] flex justify-end gap-1 px-2 bg-black/80 rounded py-0.5">
                    <span className="text-xs text-white/50 font-mono">
                      {percentDiff > 0 ? '+' : ''}{percentDiff}%
                    </span>
                  </div>
                  <svg className="flex-1 h-px ml-2 opacity-10 pointer-events-none overflow-visible">
                    <line
                      x1="0" y1="0" x2="100%" y2="0"
                      stroke="white"
                      strokeWidth="2"
                      strokeDasharray="4 4"
                    />
                  </svg>
                </div>
              );
            })}

            {/* Current Price Line */}
            <div
              className="absolute w-full pointer-events-none"
              style={{
                bottom: `${currentPricePosition}%`,
                height: '40px',
                zIndex: currentPricePosition < (limitPricePosition || 0) ? 20 : 10,
                transform: 'translateY(50%)',
                transition: 'bottom 200ms'
              }}
            >
              {/* Visible line */}
              <div
                className="absolute top-1/2 -translate-y-1/2 left-[58px] right-0 h-[2px] bg-[#00D9FF] rounded-full transition-all duration-500 pointer-events-none"
              />
              <LiquidGlassCard
                className={`absolute right-0 flex items-center justify-between bg-cyan-500/10 px-3 py-1 border-cyan-500/30 w-[250px] ${limitPricePosition && limitPricePosition < currentPricePosition ? 'top-0 -translate-y-[calc(45%-0px)]' : 'bottom-0 translate-y-[calc(45%-0px)]'
                  }`}
                borderRadius="8px"
                shadowIntensity="none"
                glowIntensity="none"
              >
                <span className="text-xs text-white/70 whitespace-nowrap">Current Price:</span>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-bold text-white">
                    {displayCurrentPrice?.toLocaleString(undefined, {
                      minimumSignificantDigits: 1,
                      maximumSignificantDigits: 4
                    }) || '0'}
                  </span>
                  {displayQuoteTokenInfo && (
                    <>
                      <span className="text-xs text-[#00D9FF]">
                        {formatTokenTicker(displayQuoteTokenInfo.ticker)}
                      </span>
                      <TokenLogo
                        ticker={displayQuoteTokenInfo.ticker}
                        className="w-[16px] h-[16px] object-contain"
                        style={{ filter: 'brightness(0) saturate(100%) invert(68%) sepia(96%) saturate(2367%) hue-rotate(167deg) brightness(103%) contrast(101%)' }}
                      />
                    </>
                  )}
                </div>
              </LiquidGlassCard>
            </div>

            {/* Limit Order Price Lines - Single line when bound, multiple when unbound */}
            {pricesBound ? (
              /* Single draggable line when prices are bound */
              priceToDisplay && limitPricePosition !== null && onLimitPriceChange && (
                <div
                  className={`absolute w-full ${isDragging ? 'cursor-grabbing' : 'cursor-grab'}`}
                  style={{
                    bottom: `${limitPricePosition}%`,
                    height: '40px',
                    zIndex: limitPricePosition < currentPricePosition ? 20 : 10,
                    transform: 'translateY(50%)',
                    transition: isDragging ? 'none' : 'bottom 200ms'
                  }}
                  onMouseDown={handleMouseDown}
                >
                  {/* Visible line */}
                  <div
                    className={`absolute top-1/2 -translate-y-1/2 left-[58px] right-0 bg-[#FF0080] rounded-full ${isDragging ? 'h-[2px] opacity-70' : 'h-[2px] opacity-100'} pointer-events-none`}
                    style={{
                      transition: isDragging ? 'none' : 'all 200ms'
                    }}
                  />
                  <LiquidGlassCard
                    className={`absolute right-0 flex items-center justify-between bg-pink-500/10 px-3 py-1 border-pink-500/30 w-[250px] ${displayQuoteTokenInfos.length > 1 ? 'cursor-pointer pointer-events-auto' : 'pointer-events-none'} ${limitPricePosition < currentPricePosition ? 'bottom-0 translate-y-[calc(45%-0px)]' : 'top-0 -translate-y-[calc(45%-0px)]'}`}
                    borderRadius="8px"
                    shadowIntensity="none"
                    glowIntensity="none"
                    onClick={cycleDisplayedToken}
                  >
                    {(() => {
                      // Get the currently displayed token
                      const tokenInfo = displayQuoteTokenInfos[displayedTokenIndex] || displayQuoteTokenInfos[0];
                      if (!tokenInfo) return null;

                      // Calculate the specific limit price for this token
                      const tokenAddress = tokenInfo?.a;
                      const tokenLimitPrice = calculateLimitPriceForToken(tokenAddress);
                      // Apply inversion if needed
                      const displayTokenPrice = tokenLimitPrice && invertPriceDisplay && tokenLimitPrice > 0
                        ? 1 / tokenLimitPrice
                        : tokenLimitPrice;
                      // Fall back to the base priceToDisplay if calculation failed
                      const priceForThisToken = displayTokenPrice || priceToDisplay;

                      return (
                        <>
                          <span className="text-xs text-white/70 whitespace-nowrap flex items-center gap-1">
                            Limit Price:
                            {displayQuoteTokenInfos.length > 1 && (
                              <span className="text-[10px] text-white/40">
                                ({displayedTokenIndex + 1}/{displayQuoteTokenInfos.length})
                              </span>
                            )}
                          </span>
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-bold text-white">
                              <NumberFlow
                                value={priceForThisToken || 0}
                                format={{
                                  minimumSignificantDigits: 1,
                                  maximumSignificantDigits: 4
                                }}
                              />
                            </span>
                            <span className="text-xs text-[#FF0080]">
                              {invertPriceDisplay ? formatTokenTicker(sellTokenInfo?.ticker || '') : formatTokenTicker(tokenInfo.ticker)}
                            </span>
                            <TokenLogo
                              ticker={invertPriceDisplay ? (sellTokenInfo?.ticker || '') : tokenInfo.ticker}
                              className="w-[16px] h-[16px] object-contain"
                              style={{ filter: 'brightness(0) saturate(100%) invert(47%) sepia(99%) saturate(6544%) hue-rotate(312deg) brightness(103%) contrast(103%)' }}
                            />
                          </div>
                        </>
                      );
                    })()}
                  </LiquidGlassCard>
                </div>
              )
            ) : (
              /* Multiple colored lines when prices are unbound */
              <>
                {/* First token - Pink, Draggable */}
                {priceToDisplay && limitPricePosition !== null && onLimitPriceChange && displayQuoteTokenInfos[0] && (
                  <div
                    className={`absolute w-full ${isDragging ? 'cursor-grabbing' : 'cursor-grab'}`}
                    style={{
                      bottom: `${limitPricePosition}%`,
                      height: '40px',
                      zIndex: limitPricePosition < currentPricePosition ? 20 : 10,
                      transform: 'translateY(50%)',
                      transition: isDragging ? 'none' : 'bottom 200ms'
                    }}
                    onMouseDown={handleMouseDown}
                  >
                    <div
                      className={`absolute top-1/2 -translate-y-1/2 left-[58px] right-0 bg-[#FF0080] rounded-full ${isDragging ? 'h-[2px] opacity-70' : 'h-[2px] opacity-100'} pointer-events-none`}
                      style={{ transition: isDragging ? 'none' : 'all 200ms' }}
                    />
                    <LiquidGlassCard
                      className={`absolute right-0 flex items-center justify-between bg-pink-500/10 px-3 py-1 border-pink-500/30 w-[250px] pointer-events-none ${limitPricePosition < currentPricePosition ? 'bottom-0 translate-y-[calc(45%-0px)]' : 'top-0 -translate-y-[calc(45%-0px)]'}`}
                      borderRadius="8px"
                      shadowIntensity="none"
                      glowIntensity="none"
                    >
                      <span className="text-xs text-white/70 whitespace-nowrap">
                        Limit{invertPriceDisplay && displayQuoteTokenInfos[0] ? ` (${formatTokenTicker(displayQuoteTokenInfos[0].ticker)})` : ''}:
                      </span>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-bold text-white">
                          <NumberFlow
                            value={priceToDisplay || 0}
                            format={{ minimumSignificantDigits: 1, maximumSignificantDigits: 4 }}
                          />
                        </span>
                        <span className="text-xs text-[#FF0080]">{invertPriceDisplay ? formatTokenTicker(sellTokenInfo?.ticker || '') : formatTokenTicker(displayQuoteTokenInfos[0].ticker)}</span>
                        <TokenLogo
                          ticker={invertPriceDisplay ? (sellTokenInfo?.ticker || '') : displayQuoteTokenInfos[0].ticker}
                          className="w-[16px] h-[16px] object-contain"
                          style={{ filter: 'brightness(0) saturate(100%) invert(47%) sepia(99%) saturate(6544%) hue-rotate(312deg) brightness(103%) contrast(103%)' }}
                        />
                      </div>
                    </LiquidGlassCard>
                  </div>
                )}

                {/* Additional tokens - Different colors, DRAGGABLE */}
                {displayQuoteTokenInfos.slice(1).map((tokenInfo, idx) => {
                  const index = idx + 1;
                  if (!tokenInfo) return null;

                  // Get this token's market price (buy tokens per sell token)
                  const tokenAddress = tokenInfo.a?.toLowerCase();
                  const tokenUsdPrice = buyTokenUsdPrices[tokenAddress || ''];
                  const tokenMarketPrice = sellTokenUsdPrice > 0 && tokenUsdPrice > 0
                    ? sellTokenUsdPrice / tokenUsdPrice
                    : 0;

                  if (tokenMarketPrice <= 0) return null;

                  // Check if this token is being dragged - use dragged price if so
                  const isThisTokenDragging = draggingTokenIndex === index;
                  const draggedPriceForThis = draggedIndividualPrices[index];

                  // Get individual price for this token - use dragged price during drag
                  let tokenLimitPrice = (isThisTokenDragging || justReleasedRef.current) && draggedPriceForThis
                    ? draggedPriceForThis
                    : individualLimitPrices[index];

                  // Fallback 1: calculate based on USD prices if no individual price
                  if ((tokenLimitPrice === undefined || tokenLimitPrice === null) && limitOrderPrice && sellTokenUsdPrice > 0) {
                    const firstBuyAddress = buyTokenAddresses[0]?.toLowerCase();
                    const firstBuyUsdPrice = firstBuyAddress ? buyTokenUsdPrices[firstBuyAddress] : 0;

                    if (tokenUsdPrice > 0 && firstBuyUsdPrice > 0) {
                      const marketPriceForFirst = sellTokenUsdPrice / firstBuyUsdPrice;
                      const premiumMultiplier = limitOrderPrice / marketPriceForFirst;
                      tokenLimitPrice = tokenMarketPrice * premiumMultiplier;
                    }
                  }

                  // Fallback 2: use market price for this token
                  if ((tokenLimitPrice === undefined || tokenLimitPrice === null)) {
                    tokenLimitPrice = tokenMarketPrice;
                  }

                  if (!tokenLimitPrice) return null;

                  // Calculate percentage from market for THIS token
                  // The chart Y-axis represents percentage from market: -rangePercent% to +rangePercent%
                  // 0% position = bottom, 50% position = center (market), 100% position = top
                  // When invertPriceDisplay is true, use inverted prices for percentage calculation
                  let percentageFromMarket: number;
                  if (invertPriceDisplay) {
                    const invertedLimitPrice = 1 / tokenLimitPrice;
                    const invertedMarketPrice = 1 / tokenMarketPrice;
                    percentageFromMarket = ((invertedLimitPrice - invertedMarketPrice) / invertedMarketPrice) * 100;
                  } else {
                    percentageFromMarket = ((tokenLimitPrice - tokenMarketPrice) / tokenMarketPrice) * 100;
                  }

                  // Convert percentage to position: -rangePercent% -> 0%, 0% -> 50%, +rangePercent% -> 100%
                  // Position = (percentageFromMarket + rangePercent) / (rangePercent * 2) * 100
                  const tokenPricePosition = ((percentageFromMarket + rangePercent) / (rangePercent * 2)) * 100;

                  // Clamp to valid range
                  const clampedPosition = Math.max(0, Math.min(100, tokenPricePosition));

                  // Calculate display price for the label (inverted if needed)
                  const displayTokenPrice = invertPriceDisplay && tokenLimitPrice > 0
                    ? 1 / tokenLimitPrice
                    : tokenLimitPrice;

                  const colors = unboundLineColors[index % unboundLineColors.length];

                  return (
                    <div
                      key={tokenInfo.a || index}
                      className={`absolute w-full ${isThisTokenDragging ? 'cursor-grabbing' : 'cursor-grab'}`}
                      style={{
                        bottom: `${clampedPosition}%`,
                        height: '40px',
                        zIndex: clampedPosition < currentPricePosition ? 20 + index : 10 + index,
                        transform: 'translateY(50%)',
                        transition: isThisTokenDragging ? 'none' : 'bottom 200ms'
                      }}
                      onMouseDown={(e) => handleIndividualMouseDown(e, index, tokenMarketPrice)}
                    >
                      <div
                        className={`absolute top-1/2 -translate-y-1/2 left-[58px] right-0 h-[2px] rounded-full pointer-events-none ${isThisTokenDragging ? 'opacity-70' : 'opacity-100'}`}
                        style={{ backgroundColor: colors.line, transition: isThisTokenDragging ? 'none' : 'all 200ms' }}
                      />
                      <LiquidGlassCard
                        className={`absolute right-0 flex items-center justify-between ${colors.bg} px-3 py-1 ${colors.border} w-[250px] pointer-events-none ${clampedPosition < currentPricePosition ? 'bottom-0 translate-y-[calc(45%-0px)]' : 'top-0 -translate-y-[calc(45%-0px)]'}`}
                        borderRadius="8px"
                        shadowIntensity="none"
                        glowIntensity="none"
                      >
                        <span className="text-xs text-white/70 whitespace-nowrap">
                          Limit{invertPriceDisplay ? ` (${formatTokenTicker(tokenInfo.ticker)})` : ''}:
                        </span>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-bold text-white">
                            <NumberFlow
                              value={displayTokenPrice || 0}
                              format={{ minimumSignificantDigits: 1, maximumSignificantDigits: 4 }}
                            />
                          </span>
                          <span className="text-xs" style={{ color: colors.text }}>{invertPriceDisplay ? formatTokenTicker(sellTokenInfo?.ticker || '') : formatTokenTicker(tokenInfo.ticker)}</span>
                          <TokenLogo
                            ticker={invertPriceDisplay ? (sellTokenInfo?.ticker || '') : tokenInfo.ticker}
                            className="w-[16px] h-[16px] object-contain"
                            style={{ filter: colors.filter }}
                          />
                        </div>
                      </LiquidGlassCard>
                    </div>
                  );
                })}
              </>
            )}
          </div>
        </div>
      ) : (
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-white/70">No price data available</div>
        </div>
      )}
    </LiquidGlassCard>
  );
}

