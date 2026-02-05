'use client';

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import NumberFlow from '@number-flow/react';
import { TOKEN_CONSTANTS } from '@/constants/crypto';
import { formatTokenTicker } from '@/utils/tokenUtils';
import { TokenLogo } from '@/components/TokenLogo';
import { ZoomIn, ZoomOut } from 'lucide-react';

import { LiquidGlassCard } from '@/components/ui/liquid-glass';

interface LimitOrderChartProps {
  sellTokenAddress?: string;
  buyTokenAddresses?: (string | undefined)[];
  limitOrderPrice?: number;
  invertPriceDisplay?: boolean;
  pricesBound?: boolean;
  individualLimitPrices?: (number | undefined)[];
  displayedTokenIndex?: number;
  showUsdPrices?: boolean;
  // External USD prices - when provided, chart uses these instead of fetching its own
  // This ensures chart and form use the same price source for consistent percentages
  externalSellTokenUsdPrice?: number;
  externalBuyTokenUsdPrices?: Record<string, number>;
  onLimitPriceChange?: (newPrice: number) => void;
  onIndividualLimitPriceChange?: (index: number, newPrice: number) => void;
  onCurrentPriceChange?: (price: number) => void;
  onDragStateChange?: (isDragging: boolean) => void;
  onDisplayedTokenIndexChange?: (index: number) => void;
  onShowUsdPricesChange?: (show: boolean) => void;
}

export function LimitOrderChart({ sellTokenAddress, buyTokenAddresses = [], limitOrderPrice, invertPriceDisplay = true, pricesBound = true, individualLimitPrices = [], displayedTokenIndex: externalDisplayedTokenIndex, showUsdPrices: externalShowUsdPrices, externalSellTokenUsdPrice, externalBuyTokenUsdPrices, onLimitPriceChange, onIndividualLimitPriceChange, onCurrentPriceChange, onDragStateChange, onDisplayedTokenIndexChange, onShowUsdPricesChange }: LimitOrderChartProps) {
  const [currentPrice, setCurrentPrice] = useState<number | null>(null);
  // Internal state for fetched prices - used as fallback when external prices not provided
  const [fetchedBuyTokenUsdPrices, setFetchedBuyTokenUsdPrices] = useState<Record<string, number>>({});
  const [fetchedSellTokenUsdPrice, setFetchedSellTokenUsdPrice] = useState<number>(0);

  // Use external prices when provided (ensures consistency with form), fallback to fetched prices
  const buyTokenUsdPrices = externalBuyTokenUsdPrices ?? fetchedBuyTokenUsdPrices;
  const sellTokenUsdPrice = externalSellTokenUsdPrice ?? fetchedSellTokenUsdPrice;
  const [loading, setLoading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [draggedPrice, setDraggedPrice] = useState<number | null>(null);
  const [draggingLineIndex, setDraggingLineIndex] = useState<number | null>(null); // Track which line is being dragged (for unbound mode)
  const [internalDisplayedTokenIndex, setInternalDisplayedTokenIndex] = useState(0); // For cycling through tokens
  const [internalShowUsdPrices, setInternalShowUsdPrices] = useState(false); // Toggle between token units and USD
  const [zoomLevel, setZoomLevel] = useState(30); // Default ±30%, can zoom in/out

  // Use external showUsdPrices if provided (controlled mode), otherwise use internal state
  const showUsdPrices = externalShowUsdPrices ?? internalShowUsdPrices;
  const setShowUsdPrices = (value: boolean) => {
    setInternalShowUsdPrices(value);
    onShowUsdPricesChange?.(value);
  };

  // Use external index if provided (controlled mode), otherwise use internal state
  const displayedTokenIndex = externalDisplayedTokenIndex ?? internalDisplayedTokenIndex;
  const setDisplayedTokenIndex = (index: number) => {
    setInternalDisplayedTokenIndex(index);
    onDisplayedTokenIndexChange?.(index);
  };
  const containerRef = useRef<HTMLDivElement>(null);
  const rafRef = useRef<number | null>(null);
  const justReleasedRef = useRef<boolean>(false);
  const justReleasedLineIndexRef = useRef<number | null>(null); // Track which line was just released
  const lastUpdateRef = useRef<number>(0);
  const cooldownTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Track previous token addresses to detect token changes and prevent line jumping
  const prevSellTokenRef = useRef<string | undefined>(sellTokenAddress);
  const prevBuyTokenRef = useRef<string | undefined>(buyTokenAddresses[0]);
  // Store the stable limit price position during token transitions
  const stableLimitPricePositionRef = useRef<number | null>(null);
  // Track the limitOrderPrice we had when token change started - wait for it to change
  const limitPriceAtTokenChangeRef = useRef<number | undefined>(undefined);
  // Use state for transition pending so it triggers re-renders when cleared
  const [tokenTransitionPending, setTokenTransitionPending] = useState(false);

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

  // Stablecoin addresses that should always be priced at $1
  const STABLECOIN_ADDRESSES = [
    '0xe56043671df55de5cdf8459710433c10324de0ae', // weDAI
    '0xefd766ccb38eaf1dfd701853bfce31359239f305', // DAI from Ethereum
    '0x6b175474e89094c44da98b954eedeac495271d0f', // DAI on Ethereum mainnet
  ].map(a => a.toLowerCase());

  // Helper function to check if a token is a stablecoin
  const isStablecoin = (address: string): boolean => {
    const tokenConfig = TOKEN_CONSTANTS.find(t => t.a?.toLowerCase() === address.toLowerCase());
    // Check by address or by ticker
    if (STABLECOIN_ADDRESSES.includes(address.toLowerCase())) return true;
    if (tokenConfig?.ticker && ['eDAI', 'weDAI', 'DAI', 'USDC', 'USDT'].includes(tokenConfig.ticker)) return true;
    return false;
  };

  // Helper function to fetch price by contract address (fallback for tokens without dexs)
  const fetchPriceByContractAddress = async (contractAddress: string): Promise<number | null> => {
    // Check if it's a stablecoin first
    if (isStablecoin(contractAddress)) {
      return 1;
    }

    try {
      const response = await fetch(`https://api.dexscreener.com/latest/dex/tokens/${contractAddress}`);
      if (!response.ok) return null;

      const data = await response.json();
      const pairs = data.pairs || [];

      // Filter for PulseChain pairs and sort by liquidity
      const pulsechainPairs = pairs
        .filter((p: any) => p.chainId === 'pulsechain')
        .sort((a: any, b: any) => {
          const aLiquidity = parseFloat(a.liquidity?.usd || '0');
          const bLiquidity = parseFloat(b.liquidity?.usd || '0');
          return bLiquidity - aLiquidity;
        });

      if (pulsechainPairs.length > 0 && pulsechainPairs[0].priceUsd) {
        return parseFloat(pulsechainPairs[0].priceUsd);
      }
      return null;
    } catch {
      return null;
    }
  };

  const fetchPriceData = async () => {
    if (!sellToken || !buyToken) return;

    setLoading(true);
    try {
      // Fetch sell token config
      const sellTokenConfig = TOKEN_CONSTANTS.find(t => t.a?.toLowerCase() === sellToken.toLowerCase());

      let sellPriceUsd: number | null = null;

      // Check if sell token is a stablecoin first
      if (isStablecoin(sellToken)) {
        sellPriceUsd = 1;
      } else {
        // Check if dexs is a valid address (not null, empty, or zero address)
        const sellDexs = sellTokenConfig?.dexs;
        const isNullSellDexs = !sellDexs || sellDexs === '' || sellDexs === '0x0' || sellDexs === '0x0000000000000000000000000000000000000000';

        if (!isNullSellDexs) {
          // Get pair address for sell token
          const sellPairAddress = Array.isArray(sellDexs) ? sellDexs[0] : sellDexs;

          // Fetch sell token price
          const sellResponse = await fetch(`https://api.dexscreener.com/latest/dex/pairs/pulsechain/${sellPairAddress}`);
          if (sellResponse.ok) {
            const sellData = await sellResponse.json();
            const sellPair = sellData.pairs?.[0];
            if (sellPair?.priceUsd) {
              sellPriceUsd = parseFloat(sellPair.priceUsd);
            }
          }
        }

        // Fallback: fetch by contract address if pair fetch failed or no dexs configured
        if (sellPriceUsd === null) {
          sellPriceUsd = await fetchPriceByContractAddress(sellToken);
        }
      }

      if (sellPriceUsd === null) {
        setLoading(false);
        return;
      }

      setFetchedSellTokenUsdPrice(sellPriceUsd);

      // Fetch prices for all buy tokens
      const validBuyAddresses = buyTokenAddresses.filter(addr => addr);

      const buyPricePromises = validBuyAddresses.map(async (addr) => {
        if (!addr) return null;

        // Check if buy token is a stablecoin first
        if (isStablecoin(addr)) {
          return { address: addr.toLowerCase(), price: 1 };
        }

        const config = TOKEN_CONSTANTS.find(t => t.a?.toLowerCase() === addr.toLowerCase());
        const dexs = config?.dexs;
        const isNullDexs = !dexs || dexs === '' || dexs === '0x0' || dexs === '0x0000000000000000000000000000000000000000';

        let price: number | null = null;

        // Try pair address first if available
        if (!isNullDexs) {
          const pairAddress = Array.isArray(dexs) ? dexs[0] : dexs;
          try {
            const response = await fetch(`https://api.dexscreener.com/latest/dex/pairs/pulsechain/${pairAddress}`);
            if (response.ok) {
              const data = await response.json();
              const pair = data.pairs?.[0];
              if (pair?.priceUsd) {
                price = parseFloat(pair.priceUsd);
              }
            }
          } catch {
            // Will try fallback
          }
        }

        // Fallback: fetch by contract address
        if (price === null) {
          price = await fetchPriceByContractAddress(addr);
        }

        if (price !== null) {
          return { address: addr.toLowerCase(), price };
        }
        return null;
      });

      const buyPriceResults = await Promise.all(buyPricePromises);
      const newBuyTokenPrices: Record<string, number> = {};
      buyPriceResults.forEach(result => {
        if (result) {
          newBuyTokenPrices[result.address] = result.price;
        }
      });
      setFetchedBuyTokenUsdPrices(newBuyTokenPrices);

      // Calculate current ratio for the first buy token
      const firstBuyTokenPrice = newBuyTokenPrices[buyToken.toLowerCase()];
      if (firstBuyTokenPrice) {
        // currentRatio is in buy/sell format (buy tokens per sell token)
        // e.g., 1.1 eDAI per BSP when BSP is $1.10 and eDAI is $1.00
        const currentRatio = sellPriceUsd / firstBuyTokenPrice;
        setCurrentPrice(currentRatio);

        // Notify parent of current price change
        // Parent (LimitOrderForm) expects sell/buy format (sell tokens per buy token)
        // So we send 1/currentRatio = buyTokenPrice/sellTokenPrice
        if (onCurrentPriceChange) {
          onCurrentPriceChange(firstBuyTokenPrice / sellPriceUsd);
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
      const nextIndex = (displayedTokenIndex + 1) % displayQuoteTokenInfos.length;
      setDisplayedTokenIndex(nextIndex);
    }
  }, [displayQuoteTokenInfos.length, displayedTokenIndex]);

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

  // Calculate display prices (invert if needed)
  const displayCurrentPrice = currentPrice && invertPriceDisplay && currentPrice > 0
    ? 1 / currentPrice
    : currentPrice;

  const displayLimitPrice = limitOrderPrice && invertPriceDisplay && limitOrderPrice > 0
    ? 1 / limitOrderPrice
    : limitOrderPrice;

  // Calculate the maximum percent deviation needed to show all limit price lines
  // This ensures lines are always visible even when set to extreme values
  const maxRequiredDeviation = useMemo(() => {
    let maxAbs = 0;

    // Check main limit price deviation
    if (displayCurrentPrice && limitOrderPrice) {
      const displayLimit = invertPriceDisplay && limitOrderPrice > 0 ? 1 / limitOrderPrice : limitOrderPrice;
      const deviation = ((displayLimit - displayCurrentPrice) / displayCurrentPrice) * 100;
      maxAbs = Math.max(maxAbs, Math.abs(deviation));
    }

    // Check individual limit prices (for unbound mode)
    if (!pricesBound && individualLimitPrices.length > 0) {
      individualLimitPrices.forEach((price, idx) => {
        if (!price) return;
        const tokenAddress = buyTokenAddresses[idx]?.toLowerCase();
        if (!tokenAddress || !sellTokenUsdPrice || !buyTokenUsdPrices[tokenAddress]) return;

        const tokenMarketPrice = invertPriceDisplay
          ? buyTokenUsdPrices[tokenAddress] / sellTokenUsdPrice
          : sellTokenUsdPrice / buyTokenUsdPrices[tokenAddress];

        const displayPrice = invertPriceDisplay && price > 0 ? 1 / price : price;
        const deviation = ((displayPrice - tokenMarketPrice) / tokenMarketPrice) * 100;
        maxAbs = Math.max(maxAbs, Math.abs(deviation));
      });
    }

    // Cap at 1000% to prevent performance issues with extreme values
    return Math.min(maxAbs, 1000);
  }, [displayCurrentPrice, limitOrderPrice, invertPriceDisplay, pricesBound, individualLimitPrices, buyTokenAddresses, sellTokenUsdPrice, buyTokenUsdPrices]);

  // Auto-expand zoom level to show out-of-bounds limit prices
  // Always expand to show all limit lines, but use user's manual zoom as the minimum when zooming out
  // Round up to the next nice number (so 201% becomes 250%, not 200%)
  // Add a small buffer (10%) to prevent the line from sitting exactly at the edge
  const requiredWithBuffer = maxRequiredDeviation * 1.1;
  const rawEffectiveZoom = Math.max(zoomLevel, requiredWithBuffer);
  const effectiveZoomLevel = rawEffectiveZoom <= 50
    ? Math.ceil(rawEffectiveZoom / 10) * 10  // Round up to nearest 10 (e.g., 31 -> 40)
    : Math.ceil(rawEffectiveZoom / 50) * 50; // Round up to nearest 50 (e.g., 201 -> 250)

  // Track if chart is auto-expanded beyond base zoom to show limit price lines
  const isAutoExpanded = effectiveZoomLevel > zoomLevel;

  // NEW: Use percentage-based positioning
  // The chart shows -effectiveZoomLevel% to +effectiveZoomLevel% from market price
  // Current price (market) is always at 50% (center)
  // This allows multiple tokens with different absolute prices to be compared
  const percentageRangeMin = -effectiveZoomLevel; // -effectiveZoomLevel% from market
  const percentageRangeMax = effectiveZoomLevel;  // +effectiveZoomLevel% from market
  const percentageRange = percentageRangeMax - percentageRangeMin; // 2 * effectiveZoomLevel

  // Convert a percentage deviation to a Y position (0-100%)
  const percentageToPosition = (percentDeviation: number): number => {
    // Clamp to range and convert to 0-100 scale
    const clampedPercent = Math.max(percentageRangeMin, Math.min(percentageRangeMax, percentDeviation));
    return ((clampedPercent - percentageRangeMin) / percentageRange) * 100;
  };

  // Current price is always at 0% deviation = center of chart
  const currentPricePosition = percentageToPosition(0); // Always 50%

  // Detect token changes SYNCHRONOUSLY during render (before position calculation)
  // This ensures we freeze before any wrong position is calculated
  const sellChanged = sellTokenAddress !== prevSellTokenRef.current;
  const buyChanged = buyTokenAddresses[0] !== prevBuyTokenRef.current;

  // Determine if we're ALREADY in a transition from previous render
  // (tokenTransitionPending is set, and price hasn't changed yet)
  const wasInTransition = tokenTransitionPending && limitOrderPrice === limitPriceAtTokenChangeRef.current;

  // If token just changed THIS render, mark as pending and capture the old limit price
  if (sellChanged || buyChanged) {
    if (!tokenTransitionPending) {
      // First render with new token - capture current limitOrderPrice to compare against
      limitPriceAtTokenChangeRef.current = limitOrderPrice;
    }
    prevSellTokenRef.current = sellTokenAddress;
    prevBuyTokenRef.current = buyTokenAddresses[0];
  }

  // We're in transition if: token just changed OR we were already in transition
  const isInTransition = (sellChanged || buyChanged) || wasInTransition;

  // Update transition state (for re-render trigger when it clears)
  useEffect(() => {
    if (sellChanged || buyChanged) {
      setTokenTransitionPending(true);
    } else if (tokenTransitionPending && limitOrderPrice !== limitPriceAtTokenChangeRef.current) {
      // New price arrived - clear transition
      setTokenTransitionPending(false);
      limitPriceAtTokenChangeRef.current = undefined;
    }
  }, [sellChanged, buyChanged, tokenTransitionPending, limitOrderPrice]);

  // Use draggedPrice during drag and briefly after for smooth rendering
  // For bound mode (draggingLineIndex === null), use draggedPrice if the bound line was just released
  const isBoundLineJustReleased = justReleasedRef.current && justReleasedLineIndexRef.current === null;
  const basePriceToDisplay = ((isDragging && draggingLineIndex === null) || isBoundLineJustReleased) && draggedPrice
    ? draggedPrice
    : limitOrderPrice;

  // Apply inversion to the price to display if needed
  const priceToDisplay = basePriceToDisplay && invertPriceDisplay && basePriceToDisplay > 0
    ? 1 / basePriceToDisplay
    : basePriceToDisplay;

  // Calculate limit price position using percentage-based system
  const limitPricePercentDeviation = displayCurrentPrice && priceToDisplay
    ? ((priceToDisplay - displayCurrentPrice) / displayCurrentPrice) * 100
    : 0;
  const calculatedLimitPricePosition = priceToDisplay
    ? percentageToPosition(limitPricePercentDeviation)
    : null;

  // During transitions, keep the line at the same visual position on the chart
  // IMPORTANT: Only update stableLimitPricePositionRef when NOT in transition
  // This prevents the ref from being updated with bad position data during transition
  if (!isInTransition && calculatedLimitPricePosition !== null) {
    stableLimitPricePositionRef.current = calculatedLimitPricePosition;
  }

  // Use stable position during transitions, calculated position otherwise
  // The stable position keeps the line visually in place until new price arrives
  const limitPricePosition = isInTransition
    ? stableLimitPricePositionRef.current
    : calculatedLimitPricePosition;

  // Calculate effective limit price position for current price label positioning
  // In unbound mode, use the active token's individual limit price position
  const effectiveLimitPricePosition = useMemo(() => {
    if (pricesBound) {
      return limitPricePosition;
    }
    // Unbound mode: calculate position for the active token
    const activeTokenInfo = displayQuoteTokenInfos[displayedTokenIndex];
    if (!activeTokenInfo) return limitPricePosition;

    let basePrice = individualLimitPrices[displayedTokenIndex];
    if (!basePrice && limitOrderPrice) {
      basePrice = calculateLimitPriceForToken(activeTokenInfo.a) || undefined;
    }
    if (!basePrice) return limitPricePosition;

    const displayPrice = invertPriceDisplay && basePrice > 0 ? 1 / basePrice : basePrice;
    const tokenAddress = activeTokenInfo.a?.toLowerCase();
    const tokenMarketPrice = tokenAddress && sellTokenUsdPrice && buyTokenUsdPrices[tokenAddress]
      ? (invertPriceDisplay
          ? buyTokenUsdPrices[tokenAddress] / sellTokenUsdPrice
          : sellTokenUsdPrice / buyTokenUsdPrices[tokenAddress])
      : null;
    if (!tokenMarketPrice) return limitPricePosition;

    const percentDeviation = displayPrice
      ? ((displayPrice - tokenMarketPrice) / tokenMarketPrice) * 100
      : 0;
    return percentageToPosition(percentDeviation);
  }, [pricesBound, limitPricePosition, displayedTokenIndex, displayQuoteTokenInfos, individualLimitPrices, limitOrderPrice, invertPriceDisplay, sellTokenUsdPrice, buyTokenUsdPrices]);

  // Drag handlers disabled - users adjust price via form inputs only
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    // Dragging disabled
  }, []);

  const handleIndividualMouseDown = useCallback((e: React.MouseEvent, index: number, price: number) => {
    // Dragging disabled
  }, []);

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!isDragging || !containerRef.current || !currentPrice) return;

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
      // Y position as 0-100% (bottom = 0, top = 100)
      const positionPercent = Math.max(0, Math.min(100, ((rect.height - y) / rect.height) * 100));

      // Convert position to percentage deviation from market price
      // Position 0% = -30% deviation, Position 50% = 0% deviation, Position 100% = +30% deviation
      const percentDeviation = percentageRangeMin + (positionPercent / 100) * percentageRange;

      // Get the appropriate market price for this line
      let marketPrice: number;
      if (draggingLineIndex !== null && !pricesBound) {
        // For individual lines, use that token's market price
        const tokenAddress = buyTokenAddresses[draggingLineIndex]?.toLowerCase();
        const tokenUsdPrice = tokenAddress ? buyTokenUsdPrices[tokenAddress] : 0;
        if (tokenUsdPrice && sellTokenUsdPrice) {
          // Calculate market price in the display direction
          marketPrice = invertPriceDisplay
            ? tokenUsdPrice / sellTokenUsdPrice  // inverted: buy/sell
            : sellTokenUsdPrice / tokenUsdPrice; // normal: sell/buy
        } else {
          // Fallback to first token market price
          marketPrice = invertPriceDisplay && currentPrice > 0 ? 1 / currentPrice : currentPrice;
        }
      } else {
        // For bound mode or main line, use the first token's market price
        marketPrice = invertPriceDisplay && currentPrice > 0 ? 1 / currentPrice : currentPrice;
      }

      // Calculate the new display price based on percentage deviation from market
      const newDisplayPrice = marketPrice * (1 + percentDeviation / 100);

      if (newDisplayPrice > 0) {
        // Convert back to base price before storing/sending
        const newBasePrice = invertPriceDisplay ? 1 / newDisplayPrice : newDisplayPrice;

        setDraggedPrice(newBasePrice); // Store in base direction

        // Throttle form updates to every 50ms to reduce re-renders
        if (now - lastUpdateRef.current > 50) {
          // Check if we're dragging an individual line (unbound mode) or the main line (bound mode)
          if (draggingLineIndex !== null && onIndividualLimitPriceChange) {
            onIndividualLimitPriceChange(draggingLineIndex, newBasePrice);
          } else if (onLimitPriceChange) {
            onLimitPriceChange(newBasePrice);
          }
          lastUpdateRef.current = now;
        }
      }
    });
  }, [isDragging, currentPrice, invertPriceDisplay, onLimitPriceChange, onIndividualLimitPriceChange, draggingLineIndex, percentageRangeMin, percentageRange, pricesBound, buyTokenAddresses, buyTokenUsdPrices, sellTokenUsdPrice]);

  const handleMouseUp = useCallback((e: MouseEvent) => {
    // Cancel any pending animation frame
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }

    // Use draggedPrice as final - it's already been calculated from the last mouse position
    // Only recalculate if draggedPrice is missing (edge case)
    let finalPrice = draggedPrice;
    if (!finalPrice && containerRef.current && currentPrice) {
      const rect = containerRef.current.getBoundingClientRect();
      const y = e.clientY - rect.top;
      const positionPercent = Math.max(0, Math.min(100, ((rect.height - y) / rect.height) * 100));
      const percentDeviation = percentageRangeMin + (positionPercent / 100) * percentageRange;

      // Get the appropriate market price for this line
      let marketPrice: number;
      if (draggingLineIndex !== null && !pricesBound) {
        const tokenAddress = buyTokenAddresses[draggingLineIndex]?.toLowerCase();
        const tokenUsdPrice = tokenAddress ? buyTokenUsdPrices[tokenAddress] : 0;
        if (tokenUsdPrice && sellTokenUsdPrice) {
          marketPrice = invertPriceDisplay
            ? tokenUsdPrice / sellTokenUsdPrice
            : sellTokenUsdPrice / tokenUsdPrice;
        } else {
          marketPrice = invertPriceDisplay && currentPrice > 0 ? 1 / currentPrice : currentPrice;
        }
      } else {
        marketPrice = invertPriceDisplay && currentPrice > 0 ? 1 / currentPrice : currentPrice;
      }

      const newDisplayPrice = marketPrice * (1 + percentDeviation / 100);
      if (newDisplayPrice > 0) {
        finalPrice = invertPriceDisplay ? 1 / newDisplayPrice : newDisplayPrice;
      }
    }

    // Send final update immediately on release
    if (finalPrice) {
      if (draggingLineIndex !== null && onIndividualLimitPriceChange) {
        onIndividualLimitPriceChange(draggingLineIndex, finalPrice);
      } else if (onLimitPriceChange) {
        onLimitPriceChange(finalPrice);
      }
      setDraggedPrice(finalPrice); // Update state with final price
    }

    setIsDragging(false);
    // Store the line index BEFORE clearing it, so we know which line to use draggedPrice for during cooldown
    justReleasedLineIndexRef.current = draggingLineIndex;
    setDraggingLineIndex(null);
    justReleasedRef.current = true; // Keep using dragged price during cooldown
    if (onDragStateChange) onDragStateChange(false);

    // Keep using draggedPrice briefly to allow props to sync
    cooldownTimeoutRef.current = setTimeout(() => {
      justReleasedRef.current = false;
      justReleasedLineIndexRef.current = null;
      // Don't clear draggedPrice here - let the useEffect below handle it
      // when the prop catches up
      cooldownTimeoutRef.current = null;
    }, 100);
  }, [draggedPrice, onLimitPriceChange, onIndividualLimitPriceChange, draggingLineIndex, onDragStateChange, currentPrice, invertPriceDisplay, pricesBound, buyTokenAddresses, buyTokenUsdPrices, sellTokenUsdPrice, percentageRangeMin, percentageRange]);

  useEffect(() => {
    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      return () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
        // Cleanup animation frame
        if (rafRef.current) {
          cancelAnimationFrame(rafRef.current);
          rafRef.current = null;
        }
      };
    }
  }, [isDragging, handleMouseMove, handleMouseUp]);

  // Clear draggedPrice when prop catches up (prevents jump on transition)
  useEffect(() => {
    if (!isDragging && !justReleasedRef.current && draggedPrice !== null) {
      // Props have caught up, safe to clear draggedPrice
      setDraggedPrice(null);
    }
  }, [isDragging, draggedPrice, limitOrderPrice, individualLimitPrices]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (cooldownTimeoutRef.current) {
        clearTimeout(cooldownTimeoutRef.current);
      }
    };
  }, []);

  // Proactively send calculated individual limit prices to parent when values change
  // This ONLY applies when prices are BOUND - when unbound, each token keeps its own price
  useEffect(() => {
    // Skip when prices are unbound - individual tokens maintain their own prices
    if (!pricesBound) return;
    if (!onIndividualLimitPriceChange || !limitOrderPrice || !sellTokenUsdPrice || isDragging) return;

    // Calculate and send prices for all buy tokens (bound mode only)
    buyTokenAddresses.forEach((tokenAddress, index) => {
      if (!tokenAddress) return;

      const calculatedPrice = calculateLimitPriceForToken(tokenAddress);
      if (calculatedPrice !== null && calculatedPrice > 0) {
        onIndividualLimitPriceChange(index, calculatedPrice);
      }
    });
  }, [limitOrderPrice, buyTokenUsdPrices, sellTokenUsdPrice, buyTokenAddresses, isDragging, pricesBound]);

  return (
    <LiquidGlassCard
      className="w-full h-full flex flex-col overflow-y-auto p-6"
      shadowIntensity="sm"
      glowIntensity="sm"
      blurIntensity="xl"
    >
      {/* Token Pair Info */}
      {displayBaseTokenInfo && displayQuoteTokenInfo && (
        <div className="flex flex-col gap-2 mb-4">
          <div className="flex items-center justify-between">
            <h3 className="text-2xl font-bold text-white">
              <span className="flex items-center gap-2">
                <TokenLogo
                  ticker={displayBaseTokenInfo.ticker}
                  className="w-6 h-6 inline-block"
                />
                {formatTokenTicker(displayBaseTokenInfo.ticker)} Price
              </span>
            </h3>
            <div className="flex items-center gap-2">
              {loading && (
                <span className="text-xs text-white/50 animate-pulse">Updating...</span>
              )}
              {/* Zoom Controls */}
              <div className="flex items-center">
                <button
                  onClick={() => {
                    setZoomLevel(prev => {
                      // Zoom out: use larger steps at higher levels
                      if (prev >= 100) return prev + 50;
                      if (prev >= 50) return prev + 25;
                      return prev + 10;
                    });
                  }}
                  className="px-2 py-1 rounded-l text-xs font-medium transition-colors bg-white/10 text-white/60 border border-white/20 hover:bg-white/20 hover:text-white"
                  title={`Zoom out (±${effectiveZoomLevel}%${isAutoExpanded ? ' - auto-expanded' : ''})`}
                >
                  <ZoomOut className="w-4 h-4" />
                </button>
                <button
                  onClick={() => {
                    setZoomLevel(prev => {
                      // Zoom in: use larger steps at higher levels
                      if (prev > 100) return Math.max(prev - 50, 100);
                      if (prev > 50) return Math.max(prev - 25, 50);
                      return Math.max(prev - 10, 10);
                    });
                  }}
                  className="px-2 py-1 rounded-r text-xs font-medium transition-colors bg-white/10 text-white/60 border border-l-0 border-white/20 hover:bg-white/20 hover:text-white"
                  title={`Zoom in (±${effectiveZoomLevel}%${isAutoExpanded ? ' - auto-expanded' : ''})`}
                >
                  <ZoomIn className="w-4 h-4" />
                </button>
              </div>
              {/* USD/Units Toggle */}
              <button
                onClick={() => setShowUsdPrices(!showUsdPrices)}
                className={`px-2 py-1 rounded text-xs font-medium transition-colors ${
                  showUsdPrices
                    ? 'bg-green-500/20 text-green-400 border border-green-500/30'
                    : 'bg-white/10 text-white/60 border border-white/20 hover:bg-white/20'
                }`}
              >
                {showUsdPrices ? '$' : 'Units'}
              </button>
            </div>
          </div>
          {/* Explanation of percentage scale */}
          <p className="text-xs text-white/50">
            Scale shows % from market price (0% = current price)
          </p>
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
            onMouseDown={() => {
              // Blur any focused input when clicking on the chart to prevent
              // focus state from blocking price updates during drag
              if (document.activeElement instanceof HTMLElement) {
                document.activeElement.blur();
              }
            }}
          >
            {/* Y-axis tick marks - using percentage-based positioning */}
            {(() => {
              // Generate tick marks based on effective zoom level (includes auto-expand)
              // Use sparser ticks at higher zoom levels to avoid crowding
              // Always generate ticks symmetrically around 0% with nice round numbers
              let tickIncrement: number;
              if (effectiveZoomLevel <= 30) {
                tickIncrement = 5;
              } else if (effectiveZoomLevel <= 50) {
                tickIncrement = 10;
              } else if (effectiveZoomLevel <= 100) {
                tickIncrement = 20;
              } else if (effectiveZoomLevel <= 200) {
                tickIncrement = 50;
              } else if (effectiveZoomLevel <= 500) {
                tickIncrement = 100;
              } else if (effectiveZoomLevel <= 1000) {
                tickIncrement = 200;
              } else {
                tickIncrement = 500;
              }
              const ticks: number[] = [0]; // Always include 0%
              // Add positive ticks
              for (let i = tickIncrement; i <= effectiveZoomLevel; i += tickIncrement) {
                ticks.push(i);
              }
              // Add negative ticks
              for (let i = -tickIncrement; i >= -effectiveZoomLevel; i -= tickIncrement) {
                ticks.push(i);
              }
              return ticks.sort((a, b) => a - b);
            })().map((percentDiff) => {
              // Use percentage-based positioning directly
              const position = percentageToPosition(percentDiff);

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
                zIndex: currentPricePosition < (effectiveLimitPricePosition || 0) ? 20 : 10,
                transform: 'translateY(50%)',
                transition: 'bottom 200ms'
              }}
            >
              {/* Visible line */}
              <div
                className="absolute top-1/2 -translate-y-1/2 left-[58px] right-0 h-[2px] bg-[#00D9FF] rounded-full transition-all duration-500 pointer-events-none"
              />
              <LiquidGlassCard
                className={`group absolute right-0 flex items-center justify-between bg-cyan-500/10 px-3 py-1 border-cyan-500/30 w-fit min-w-[250px] ${displayQuoteTokenInfos.length > 1 ? 'cursor-pointer pointer-events-auto' : 'pointer-events-none'} ${effectiveLimitPricePosition && effectiveLimitPricePosition < currentPricePosition ? 'top-0' : 'bottom-0'}`}
                style={{
                  transform: effectiveLimitPricePosition && effectiveLimitPricePosition < currentPricePosition
                    ? 'translateY(-45%)'
                    : 'translateY(45%)'
                }}
                borderRadius="8px"
                shadowIntensity="none"
                glowIntensity="none"
                onClick={displayQuoteTokenInfos.length > 1 ? cycleDisplayedToken : undefined}
              >
                {(() => {
                  // Get the currently displayed token (same as limit price)
                  const tokenInfo = displayQuoteTokenInfos[displayedTokenIndex] || displayQuoteTokenInfos[0];
                  if (!tokenInfo) return null;

                  // Calculate current market price for this specific token
                  const tokenAddress = tokenInfo?.a?.toLowerCase();
                  const tokenCurrentPrice = tokenAddress && sellTokenUsdPrice && buyTokenUsdPrices[tokenAddress]
                    ? (invertPriceDisplay
                        ? buyTokenUsdPrices[tokenAddress] / sellTokenUsdPrice  // inverted: buy/sell
                        : sellTokenUsdPrice / buyTokenUsdPrices[tokenAddress]) // normal: sell/buy
                    : displayCurrentPrice;

                  // When inverted, show sell token as unit; otherwise show buy token
                  const unitTokenInfo = invertPriceDisplay ? sellTokenInfo : tokenInfo;

                  // Calculate USD price (price of 1 base token in USD)
                  const baseTokenUsdPrice = invertPriceDisplay
                    ? (tokenAddress ? buyTokenUsdPrices[tokenAddress] : 0)
                    : sellTokenUsdPrice;

                  return (
                    <>
                      <span className="text-xs text-white/70 whitespace-nowrap flex items-center gap-1">
                        Market Price:
                        {displayQuoteTokenInfos.length > 1 && (
                          <span className="text-[10px] text-white/40 group-hover:text-white transition-colors">
                            ({formatTokenTicker(tokenInfo?.ticker || '')})
                          </span>
                        )}
                      </span>
                      <div className="flex items-center gap-2">
                        {showUsdPrices ? (
                          <>
                            <span className="text-sm font-bold text-white">
                              ${baseTokenUsdPrice?.toLocaleString(undefined, {
                                minimumFractionDigits: 2,
                                maximumFractionDigits: baseTokenUsdPrice < 0.01 ? 6 : baseTokenUsdPrice < 1 ? 4 : 2
                              }) || '0'}
                            </span>
                          </>
                        ) : (
                          <>
                            <span className="text-sm font-bold text-white">
                              {tokenCurrentPrice?.toLocaleString(undefined, {
                                minimumSignificantDigits: 1,
                                maximumSignificantDigits: 4
                              }) || '0'}
                            </span>
                            <span className="text-xs text-[#00D9FF]">
                              {formatTokenTicker(unitTokenInfo?.ticker || '')}
                            </span>
                            <TokenLogo
                              ticker={unitTokenInfo?.ticker || ''}
                              className="w-[16px] h-[16px] object-contain"
                            />
                          </>
                        )}
                      </div>
                    </>
                  );
                })()}
              </LiquidGlassCard>
            </div>

            {/* Limit Order Price Lines */}
            {pricesBound ? (
              /* Single draggable line when prices are bound */
              priceToDisplay && limitPricePosition !== null && onLimitPriceChange && (
                <div
                  className="absolute w-full"
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
                    className={`group absolute right-0 flex items-center gap-2 bg-pink-500/10 px-3 py-1 border-pink-500/30 w-fit ${displayQuoteTokenInfos.length >= 5 ? '' : 'min-w-[250px] justify-between'} ${displayQuoteTokenInfos.length > 1 ? 'cursor-pointer pointer-events-auto' : 'pointer-events-none'} ${limitPricePosition < currentPricePosition ? 'bottom-0' : 'top-0'}`}
                    style={{
                      transform: limitPricePosition < currentPricePosition
                        ? 'translateY(45%)'
                        : 'translateY(-45%)'
                    }}
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

                      // When inverted, price is "X sell_tokens per 1 buy_token", so show sell token as unit
                      // When not inverted, price is "X buy_tokens per 1 sell_token", so show buy token as unit
                      const unitTokenInfo = invertPriceDisplay ? sellTokenInfo : tokenInfo;

                      // Calculate USD price for limit (what 1 base token would be worth at this limit price)
                      // When inverted, base token is the buy token
                      const tokenAddrLower = tokenAddress?.toLowerCase();
                      const buyTokenUsdPrice = tokenAddrLower ? buyTokenUsdPrices[tokenAddrLower] : 0;
                      const limitUsdPrice = invertPriceDisplay
                        ? (priceForThisToken && sellTokenUsdPrice ? priceForThisToken * sellTokenUsdPrice : 0)
                        : (priceForThisToken && buyTokenUsdPrice ? priceForThisToken * buyTokenUsdPrice : 0);

                      // Use compact layout for 5+ tokens
                      const useCompactLayout = displayQuoteTokenInfos.length >= 5;

                      if (useCompactLayout) {
                        // Compact layout: Logo | Ticker | Price - all in a row
                        return (
                          <>
                            <TokenLogo
                              ticker={tokenInfo?.ticker || ''}
                              className="w-[16px] h-[16px] object-contain flex-shrink-0"
                            />
                            <span className="text-xs whitespace-nowrap text-[#FF0080]">
                              {formatTokenTicker(tokenInfo?.ticker || '')}
                            </span>
                            <span className="text-sm font-bold text-white whitespace-nowrap">
                              {showUsdPrices
                                ? `$${limitUsdPrice.toLocaleString(undefined, {
                                    minimumFractionDigits: 2,
                                    maximumFractionDigits: limitUsdPrice < 0.01 ? 6 : limitUsdPrice < 1 ? 4 : 2
                                  })}`
                                : (priceForThisToken || 0).toPrecision(4).replace(/\.?0+$/, '')}
                            </span>
                            <span className="text-[10px] text-white/40">
                              ({displayedTokenIndex + 1}/{displayQuoteTokenInfos.length})
                            </span>
                          </>
                        );
                      }

                      return (
                        <>
                          <span className="text-xs text-white/70 whitespace-nowrap flex items-center gap-1">
                            Limit Price:
                            {displayQuoteTokenInfos.length > 1 && (
                              <span className="text-[10px] text-white/40 group-hover:text-white transition-colors">
                                ({formatTokenTicker(tokenInfo?.ticker || '')})
                              </span>
                            )}
                          </span>
                          <div className="flex items-center gap-2">
                            {showUsdPrices ? (
                              <span className="text-sm font-bold text-white">
                                ${limitUsdPrice.toLocaleString(undefined, {
                                  minimumFractionDigits: 2,
                                  maximumFractionDigits: limitUsdPrice < 0.01 ? 6 : limitUsdPrice < 1 ? 4 : 2
                                })}
                              </span>
                            ) : (
                              <>
                                <span className="text-sm font-bold text-white">
                                  {(priceForThisToken || 0).toPrecision(4).replace(/\.?0+$/, '')}
                                </span>
                                <span className="text-xs text-[#FF0080]">
                                  {formatTokenTicker(unitTokenInfo?.ticker || '')}
                                </span>
                                <TokenLogo
                                  ticker={unitTokenInfo?.ticker || ''}
                                  className="w-[16px] h-[16px] object-contain"
                                />
                              </>
                            )}
                          </div>
                        </>
                      );
                    })()}
                  </LiquidGlassCard>
                </div>
              )
            ) : (
              /* Unbound prices: Show faded lines for non-active tokens + full line for active token */
              <>
                {/* Faded lines for non-active tokens (no labels) */}
                {displayQuoteTokenInfos.map((tokenInfo, idx) => {
                  if (idx === displayedTokenIndex) return null; // Skip active token, rendered separately
                  if (!tokenInfo) return null;

                  // Token colors
                  const tokenColors = [
                    { accent: '#FF0080' },      // Pink
                    { accent: '#8B5CF6' },      // Purple
                    { accent: '#F59E0B' },      // Amber
                    { accent: '#10B981' },      // Emerald
                    { accent: '#EF4444' },      // Red
                    { accent: '#3B82F6' },      // Blue
                    { accent: '#EC4899' },      // Fuchsia
                    { accent: '#14B8A6' },      // Teal
                    { accent: '#F97316' },      // Orange
                    { accent: '#6366F1' },      // Indigo
                  ];
                  const lineColor = tokenColors[idx % tokenColors.length].accent;

                  // Get individual price for this token
                  let basePrice = individualLimitPrices[idx];
                  if (!basePrice && limitOrderPrice) {
                    const tokenAddress = tokenInfo?.a;
                    basePrice = calculateLimitPriceForToken(tokenAddress) || undefined;
                  }
                  if (!basePrice) return null;

                  // Apply inversion if needed
                  const displayPrice = invertPriceDisplay && basePrice > 0 ? 1 / basePrice : basePrice;

                  // Calculate market price for this token
                  const tokenAddress = tokenInfo?.a?.toLowerCase();
                  const tokenMarketPrice = tokenAddress && sellTokenUsdPrice && buyTokenUsdPrices[tokenAddress]
                    ? (invertPriceDisplay
                        ? buyTokenUsdPrices[tokenAddress] / sellTokenUsdPrice
                        : sellTokenUsdPrice / buyTokenUsdPrices[tokenAddress])
                    : null;
                  if (!tokenMarketPrice) return null;

                  // Calculate percentage deviation
                  const percentDeviation = displayPrice
                    ? ((displayPrice - tokenMarketPrice) / tokenMarketPrice) * 100
                    : 0;
                  const pricePosition = percentageToPosition(percentDeviation);
                  if (pricePosition === null) return null;

                  return (
                    <div
                      key={`inactive-line-${idx}`}
                      className="absolute w-full pointer-events-none"
                      style={{
                        bottom: `${pricePosition}%`,
                        height: '4px',
                        zIndex: 5,
                        transform: 'translateY(50%)',
                        transition: 'bottom 200ms'
                      }}
                    >
                      {/* Faded line - no label */}
                      <div
                        className="absolute top-1/2 -translate-y-1/2 left-[58px] right-0 h-[2px] rounded-full opacity-30"
                        style={{ backgroundColor: lineColor }}
                      />
                    </div>
                  );
                })}

                {/* Active token line with full label */}
                {(() => {
                  const activeIndex = displayedTokenIndex;
                  const activeTokenInfo = displayQuoteTokenInfos[activeIndex];
                  if (!activeTokenInfo) return null;

                  // Token colors matching LimitOrderForm - first token is pink, others use this array
                  const tokenColors = [
                    { accent: '#FF0080', bg: 'bg-pink-500/10', border: 'border-pink-500/30' },      // First token (index 0)
                    { accent: '#8B5CF6', bg: 'bg-purple-500/10', border: 'border-purple-500/30' },  // Purple
                    { accent: '#F59E0B', bg: 'bg-amber-500/10', border: 'border-amber-500/30' },    // Amber
                    { accent: '#10B981', bg: 'bg-emerald-500/10', border: 'border-emerald-500/30' }, // Emerald
                    { accent: '#EF4444', bg: 'bg-red-500/10', border: 'border-red-500/30' },        // Red
                    { accent: '#3B82F6', bg: 'bg-blue-500/10', border: 'border-blue-500/30' },      // Blue
                    { accent: '#EC4899', bg: 'bg-fuchsia-500/10', border: 'border-fuchsia-500/30' }, // Fuchsia
                    { accent: '#14B8A6', bg: 'bg-teal-500/10', border: 'border-teal-500/30' },      // Teal
                    { accent: '#F97316', bg: 'bg-orange-500/10', border: 'border-orange-500/30' },  // Orange
                    { accent: '#6366F1', bg: 'bg-indigo-500/10', border: 'border-indigo-500/30' },  // Indigo
                  ];
                  const colors = tokenColors[activeIndex % tokenColors.length];
                  const lineColor = colors.accent;

                // Get the individual limit price for the active token
                // Use draggedPrice during dragging OR during cooldown period (justReleasedRef)
                // IMPORTANT: During cooldown, only use draggedPrice if THIS line was the one that was just released
                const isThisLineJustReleased = justReleasedRef.current && justReleasedLineIndexRef.current === activeIndex;
                let baseIndividualPrice = ((isDragging && draggingLineIndex === activeIndex) || isThisLineJustReleased) && draggedPrice
                  ? draggedPrice
                  : individualLimitPrices[activeIndex];

                // If no individual price, try to calculate from the main limit price
                if (!baseIndividualPrice && limitOrderPrice) {
                  const tokenAddress = activeTokenInfo?.a;
                  const calculatedPrice = calculateLimitPriceForToken(tokenAddress);
                  baseIndividualPrice = calculatedPrice || undefined;
                }

                if (!baseIndividualPrice) return null;

                // Apply inversion if needed
                const displayIndividualPrice = invertPriceDisplay && baseIndividualPrice > 0
                  ? 1 / baseIndividualPrice
                  : baseIndividualPrice;

                // Calculate THIS token's market price to determine % deviation
                const tokenAddress = activeTokenInfo?.a?.toLowerCase();
                const tokenMarketPrice = tokenAddress && sellTokenUsdPrice && buyTokenUsdPrices[tokenAddress]
                  ? (invertPriceDisplay
                      ? buyTokenUsdPrices[tokenAddress] / sellTokenUsdPrice
                      : sellTokenUsdPrice / buyTokenUsdPrices[tokenAddress])
                  : null;

                // Don't show line if no market price data available
                if (!tokenMarketPrice) return null;

                // Calculate percentage deviation from this token's market price
                const percentDeviation = displayIndividualPrice
                  ? ((displayIndividualPrice - tokenMarketPrice) / tokenMarketPrice) * 100
                  : 0;

                // Use percentage-based positioning
                const individualPricePosition = percentageToPosition(percentDeviation);

                if (individualPricePosition === null) return null;

                const isThisLineDragging = isDragging && draggingLineIndex === activeIndex;

                // When inverted, show sell token as unit; otherwise show buy token
                const unitTokenInfo = invertPriceDisplay ? sellTokenInfo : activeTokenInfo;

                return (
                  <div
                    className="absolute w-full"
                    style={{
                      bottom: `${individualPricePosition}%`,
                      height: '40px',
                      zIndex: individualPricePosition < currentPricePosition ? 20 : 10,
                      transform: 'translateY(50%)',
                      transition: isThisLineDragging ? 'none' : 'bottom 200ms'
                    }}
                    onMouseDown={(e) => handleIndividualMouseDown(e, activeIndex, baseIndividualPrice!)}
                  >
                    {/* Visible line - color matches token's form box */}
                    <div
                      className={`absolute top-1/2 -translate-y-1/2 left-[58px] right-0 rounded-full ${isThisLineDragging ? 'h-[2px] opacity-70' : 'h-[2px] opacity-100'} pointer-events-none`}
                      style={{ backgroundColor: lineColor, transition: isThisLineDragging ? 'none' : 'all 200ms' }}
                    />
                    <LiquidGlassCard
                      className={`group absolute right-0 flex items-center gap-2 px-3 py-1 w-fit min-w-[250px] justify-between ${displayQuoteTokenInfos.length > 1 ? 'cursor-pointer pointer-events-auto' : 'pointer-events-none'} ${individualPricePosition < currentPricePosition ? 'bottom-0' : 'top-0'} ${colors.bg} ${colors.border}`}
                      style={{
                        transform: individualPricePosition < currentPricePosition
                          ? 'translateY(45%)'
                          : 'translateY(-45%)'
                      }}
                      borderRadius="8px"
                      shadowIntensity="none"
                      glowIntensity="none"
                      onClick={cycleDisplayedToken}
                    >
                      <span className="text-xs text-white/70 whitespace-nowrap flex items-center gap-1">
                        Limit Price:
                        {displayQuoteTokenInfos.length > 1 && (
                          <span className="text-[10px] text-white/40 group-hover:text-white transition-colors">
                            ({formatTokenTicker(activeTokenInfo?.ticker || '')})
                          </span>
                        )}
                      </span>
                      <div className="flex items-center gap-2">
                        {(() => {
                          // Calculate USD price for this token's limit
                          const activeTokenUsdPrice = tokenAddress ? buyTokenUsdPrices[tokenAddress] : 0;
                          const limitUsdPrice = invertPriceDisplay
                            ? (displayIndividualPrice && sellTokenUsdPrice ? displayIndividualPrice * sellTokenUsdPrice : 0)
                            : (displayIndividualPrice && activeTokenUsdPrice ? displayIndividualPrice * activeTokenUsdPrice : 0);

                          if (showUsdPrices) {
                            return (
                              <span className="text-sm font-bold text-white">
                                ${limitUsdPrice.toLocaleString(undefined, {
                                  minimumFractionDigits: 2,
                                  maximumFractionDigits: limitUsdPrice < 0.01 ? 6 : limitUsdPrice < 1 ? 4 : 2
                                })}
                              </span>
                            );
                          }
                          return (
                            <>
                              <span className="text-sm font-bold text-white">
                                {(displayIndividualPrice || 0).toPrecision(4).replace(/\.?0+$/, '')}
                              </span>
                              <span className="text-xs" style={{ color: lineColor }}>
                                {formatTokenTicker(unitTokenInfo?.ticker || '')}
                              </span>
                              <TokenLogo
                                ticker={unitTokenInfo?.ticker || ''}
                                className="w-[16px] h-[16px] object-contain"
                              />
                            </>
                          );
                        })()}
                        {displayQuoteTokenInfos.length > 1 && (
                          <span className="text-[10px] text-white/40 group-hover:text-white transition-colors ml-1">
                            ({activeIndex + 1}/{displayQuoteTokenInfos.length})
                          </span>
                        )}
                      </div>
                    </LiquidGlassCard>
                  </div>
                );
              })()}
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

