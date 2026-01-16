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
  const [draggingLineIndex, setDraggingLineIndex] = useState<number | null>(null); // Track which line is being dragged (for unbound mode)
  const [displayedTokenIndex, setDisplayedTokenIndex] = useState(0); // For cycling through tokens
  const containerRef = useRef<HTMLDivElement>(null);
  const rafRef = useRef<number | null>(null);
  const justReleasedRef = useRef<boolean>(false);
  const lastUpdateRef = useRef<number>(0);
  const cooldownTimeoutRef = useRef<NodeJS.Timeout | null>(null);

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

      setSellTokenUsdPrice(sellPriceUsd);

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

  // Calculate display prices (invert if needed)
  const displayCurrentPrice = currentPrice && invertPriceDisplay && currentPrice > 0
    ? 1 / currentPrice
    : currentPrice;

  const displayLimitPrice = limitOrderPrice && invertPriceDisplay && limitOrderPrice > 0
    ? 1 / limitOrderPrice
    : limitOrderPrice;

  // NEW: Use percentage-based positioning
  // The chart shows -30% to +30% from market price
  // Current price (market) is always at 50% (center)
  // This allows multiple tokens with different absolute prices to be compared
  const percentageRangeMin = -30; // -30% from market
  const percentageRangeMax = 30;  // +30% from market
  const percentageRange = percentageRangeMax - percentageRangeMin; // 60%

  // Convert a percentage deviation to a Y position (0-100%)
  const percentageToPosition = (percentDeviation: number): number => {
    // Clamp to range and convert to 0-100 scale
    const clampedPercent = Math.max(percentageRangeMin, Math.min(percentageRangeMax, percentDeviation));
    return ((clampedPercent - percentageRangeMin) / percentageRange) * 100;
  };

  // Current price is always at 0% deviation = center of chart
  const currentPricePosition = percentageToPosition(0); // Always 50%

  // Use draggedPrice during drag and briefly after for smooth rendering
  const basePriceToDisplay = (isDragging || justReleasedRef.current) && draggedPrice
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
  const limitPricePosition = priceToDisplay
    ? percentageToPosition(limitPricePercentDeviation)
    : null;

  // Drag handlers for limit price line (bound mode)
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
    setDraggingLineIndex(null); // No specific line index for bound mode
    setDraggedPrice(limitOrderPrice); // Initialize with current price
    if (onDragStateChange) onDragStateChange(true);
  }, [limitOrderPrice, onLimitPriceChange, onDragStateChange]);

  // Drag handler for individual lines (unbound mode)
  const handleIndividualMouseDown = useCallback((e: React.MouseEvent, index: number, price: number) => {
    if (!onIndividualLimitPriceChange) return;
    e.preventDefault();

    // Clear any pending cooldown from previous drag
    if (cooldownTimeoutRef.current) {
      clearTimeout(cooldownTimeoutRef.current);
      cooldownTimeoutRef.current = null;
    }

    justReleasedRef.current = false;
    setIsDragging(true);
    setDraggingLineIndex(index);
    setDraggedPrice(price); // Initialize with current price for this line
    if (onDragStateChange) onDragStateChange(true);
  }, [onIndividualLimitPriceChange, onDragStateChange]);

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

  const handleMouseUp = useCallback(() => {
    // Cancel any pending animation frame
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }

    // Send final update immediately on release
    if (draggedPrice) {
      if (draggingLineIndex !== null && onIndividualLimitPriceChange) {
        onIndividualLimitPriceChange(draggingLineIndex, draggedPrice);
      } else if (onLimitPriceChange) {
        onLimitPriceChange(draggedPrice);
      }
    }

    setIsDragging(false);
    setDraggingLineIndex(null);
    justReleasedRef.current = true; // Keep using dragged price during cooldown
    if (onDragStateChange) onDragStateChange(false);

    // Keep using draggedPrice for a short time to prevent glitches
    // This gives the form time to process and stabilize
    cooldownTimeoutRef.current = setTimeout(() => {
      justReleasedRef.current = false;
      setDraggedPrice(null);
      cooldownTimeoutRef.current = null;
    }, 300);
  }, [draggedPrice, onLimitPriceChange, onIndividualLimitPriceChange, draggingLineIndex, onDragStateChange]);

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
            onMouseDown={() => {
              // Blur any focused input when clicking on the chart to prevent
              // focus state from blocking price updates during drag
              if (document.activeElement instanceof HTMLElement) {
                document.activeElement.blur();
              }
            }}
          >
            {/* Y-axis tick marks - using percentage-based positioning */}
            {[-30, -25, -20, -15, -10, -5, 0, 5, 10, 15, 20, 25, 30].map((percentDiff) => {
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
                      />
                    </>
                  )}
                </div>
              </LiquidGlassCard>
            </div>

            {/* Limit Order Price Lines */}
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

                      // When inverted, price is "X sell_tokens per 1 buy_token", so show sell token as unit
                      // When not inverted, price is "X buy_tokens per 1 sell_token", so show buy token as unit
                      const unitTokenInfo = invertPriceDisplay ? sellTokenInfo : tokenInfo;

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
                              {formatTokenTicker(unitTokenInfo?.ticker || '')}
                            </span>
                            <TokenLogo
                              ticker={unitTokenInfo?.ticker || ''}
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
              /* Multiple draggable lines when prices are unbound - one for each token */
              displayQuoteTokenInfos.map((tokenInfo, index) => {
                if (!tokenInfo) return null;

                // Get the individual limit price for this token
                // Use dragged price if this line is being dragged
                // Fall back to calculating from the main limit price if individual price not set
                let baseIndividualPrice = (isDragging && draggingLineIndex === index && draggedPrice)
                  ? draggedPrice
                  : individualLimitPrices[index];

                // If no individual price, try to calculate from the main limit price
                if (!baseIndividualPrice && limitOrderPrice) {
                  const tokenAddress = tokenInfo?.a;
                  const calculatedPrice = calculateLimitPriceForToken(tokenAddress);
                  baseIndividualPrice = calculatedPrice || undefined;
                }

                if (!baseIndividualPrice) return null;

                // Apply inversion if needed
                const displayIndividualPrice = invertPriceDisplay && baseIndividualPrice > 0
                  ? 1 / baseIndividualPrice
                  : baseIndividualPrice;

                // Calculate THIS token's market price to determine % deviation
                const tokenAddress = tokenInfo?.a?.toLowerCase();
                const tokenMarketPrice = tokenAddress && sellTokenUsdPrice && buyTokenUsdPrices[tokenAddress]
                  ? (invertPriceDisplay
                      ? buyTokenUsdPrices[tokenAddress] / sellTokenUsdPrice  // inverted: buy/sell
                      : sellTokenUsdPrice / buyTokenUsdPrices[tokenAddress]) // normal: sell/buy
                  : null;

                // Calculate percentage deviation from this token's market price
                const percentDeviation = tokenMarketPrice && displayIndividualPrice
                  ? ((displayIndividualPrice - tokenMarketPrice) / tokenMarketPrice) * 100
                  : 0;

                // Use percentage-based positioning
                const individualPricePosition = percentageToPosition(percentDeviation);

                if (individualPricePosition === null) return null;

                // Generate a unique color for each token line
                const colors = ['#FF0080', '#8000FF', '#FF8000', '#0080FF', '#00FF80'];
                const lineColor = colors[index % colors.length];

                const isThisLineDragging = isDragging && draggingLineIndex === index;

                return (
                  <div
                    key={`limit-line-${index}`}
                    className={`absolute w-full ${onIndividualLimitPriceChange ? (isThisLineDragging ? 'cursor-grabbing' : 'cursor-grab') : ''}`}
                    style={{
                      bottom: `${individualPricePosition}%`,
                      height: '40px',
                      zIndex: individualPricePosition < currentPricePosition ? 20 + index : 10 + index,
                      transform: 'translateY(50%)',
                      transition: isThisLineDragging ? 'none' : 'bottom 200ms'
                    }}
                    onMouseDown={(e) => handleIndividualMouseDown(e, index, baseIndividualPrice)}
                  >
                    {/* Visible line */}
                    <div
                      className={`absolute top-1/2 -translate-y-1/2 left-[58px] right-0 h-[2px] rounded-full pointer-events-none ${isThisLineDragging ? 'opacity-70' : 'opacity-100'}`}
                      style={{ backgroundColor: lineColor, transition: isThisLineDragging ? 'none' : 'all 200ms' }}
                    />
                    <LiquidGlassCard
                      className={`absolute right-0 flex items-center justify-between px-3 py-1 w-[250px] pointer-events-none ${individualPricePosition < currentPricePosition ? 'bottom-0 translate-y-[calc(45%-0px)]' : 'top-0 -translate-y-[calc(45%-0px)]'}`}
                      style={{
                        backgroundColor: `${lineColor}10`,
                        borderColor: `${lineColor}30`
                      }}
                      borderRadius="8px"
                      shadowIntensity="none"
                      glowIntensity="none"
                    >
                      <span className="text-xs text-white/70 whitespace-nowrap">
                        Limit Price:
                      </span>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-bold text-white">
                          <NumberFlow
                            value={displayIndividualPrice || 0}
                            format={{
                              minimumSignificantDigits: 1,
                              maximumSignificantDigits: 4
                            }}
                          />
                        </span>
                        <span className="text-xs" style={{ color: lineColor }}>
                          {formatTokenTicker(invertPriceDisplay ? (sellTokenInfo?.ticker || '') : tokenInfo.ticker)}
                        </span>
                        <TokenLogo
                          ticker={invertPriceDisplay ? (sellTokenInfo?.ticker || '') : tokenInfo.ticker}
                          className="w-[16px] h-[16px] object-contain"
                        />
                      </div>
                    </LiquidGlassCard>
                  </div>
                );
              })
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

