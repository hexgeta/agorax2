'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import NumberFlow from '@number-flow/react';
import { TOKEN_CONSTANTS } from '@/constants/crypto';
import { formatTokenTicker } from '@/utils/tokenUtils';
import { CoinLogo } from '@/components/ui/CoinLogo';

interface LimitOrderChartProps {
  sellTokenAddress?: string;
  buyTokenAddresses?: (string | undefined)[];
  limitOrderPrice?: number;
  invertPriceDisplay?: boolean;
  onLimitPriceChange?: (newPrice: number) => void;
  onCurrentPriceChange?: (price: number) => void;
  onDragStateChange?: (isDragging: boolean) => void;
}

export function LimitOrderChart({ sellTokenAddress, buyTokenAddresses = [], limitOrderPrice, invertPriceDisplay = true, onLimitPriceChange, onCurrentPriceChange, onDragStateChange }: LimitOrderChartProps) {
  const [currentPrice, setCurrentPrice] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [draggedPrice, setDraggedPrice] = useState<number | null>(null);
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
  }, [sellToken, buyToken]);

  const fetchPriceData = async () => {
    if (!sellToken || !buyToken) return;
    
    setLoading(true);
    try {
      // Fetch both token configs
      const sellTokenConfig = TOKEN_CONSTANTS.find(t => t.a?.toLowerCase() === sellToken.toLowerCase());
      const buyTokenConfig = TOKEN_CONSTANTS.find(t => t.a?.toLowerCase() === buyToken.toLowerCase());
      
      if (!sellTokenConfig?.dexs || !buyTokenConfig?.dexs) {
        setLoading(false);
        return;
      }

      // Get pair addresses for DexScreener
      const sellPairAddress = Array.isArray(sellTokenConfig.dexs) ? sellTokenConfig.dexs[0] : sellTokenConfig.dexs;
      const buyPairAddress = Array.isArray(buyTokenConfig.dexs) ? buyTokenConfig.dexs[0] : buyTokenConfig.dexs;
      
      // Fetch current prices from DexScreener
      const [sellResponse, buyResponse] = await Promise.all([
        fetch(`https://api.dexscreener.com/latest/dex/pairs/pulsechain/${sellPairAddress}`),
        fetch(`https://api.dexscreener.com/latest/dex/pairs/pulsechain/${buyPairAddress}`)
      ]);
      
      if (!sellResponse.ok || !buyResponse.ok) {
        throw new Error('Failed to fetch current price data');
      }

      const [sellData, buyData] = await Promise.all([
        sellResponse.json(),
        buyResponse.json()
      ]);
      
      const sellPair = sellData.pairs?.[0];
      const buyPair = buyData.pairs?.[0];
      
      if (!sellPair || !buyPair || !sellPair.priceUsd || !buyPair.priceUsd) {
        throw new Error('Invalid price data from DexScreener');
      }

      const sellPriceUsd = parseFloat(sellPair.priceUsd);
      const buyPriceUsd = parseFloat(buyPair.priceUsd);
      
      // Calculate current ratio: how many buy tokens per sell token
      const currentRatio = sellPriceUsd / buyPriceUsd;
      setCurrentPrice(currentRatio);
      
      // Notify parent of current price change (always in base direction)
      if (onCurrentPriceChange) {
        onCurrentPriceChange(currentRatio);
      }
      
    } catch (error) {
      // Error fetching price data
    } finally {
      setLoading(false);
    }
  };

  const sellTokenInfo = TOKEN_CONSTANTS.find(t => t.a?.toLowerCase() === sellToken.toLowerCase());
  const buyTokenInfo = TOKEN_CONSTANTS.find(t => t.a?.toLowerCase() === buyToken.toLowerCase());
  
  // Get info for all buy tokens
  const buyTokenInfos = buyTokenAddresses
    .filter(addr => addr)
    .map(addr => TOKEN_CONSTANTS.find(t => t.a?.toLowerCase() === addr?.toLowerCase()))
    .filter(info => info);

  // When inverted, swap the display token info
  const displayBaseTokenInfo = invertPriceDisplay ? buyTokenInfo : sellTokenInfo;
  const displayQuoteTokenInfo = invertPriceDisplay ? sellTokenInfo : buyTokenInfo;
  
  // For multiple tokens, get all display tokens
  const displayQuoteTokenInfos = invertPriceDisplay 
    ? [sellTokenInfo].filter(Boolean)
    : buyTokenInfos;

  // Calculate display prices (invert if needed)
  const displayCurrentPrice = currentPrice && invertPriceDisplay && currentPrice > 0
    ? 1 / currentPrice
    : currentPrice;
  
  const displayLimitPrice = limitOrderPrice && invertPriceDisplay && limitOrderPrice > 0
    ? 1 / limitOrderPrice
    : limitOrderPrice;

  // Calculate visual scale for the price display
  // Use a symmetric percentage range around current price for accurate % representation
  const minPrice = (displayCurrentPrice || 0) * 0.7; // 30% below current price
  const maxPrice = (displayCurrentPrice || 0) * 1.3; // 30% above current price
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
      
      // Calculate price range dynamically based on display price
      const minPriceCalc = displayPrice * 0.7;
      const maxPriceCalc = displayPrice * 1.3;
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
  }, [isDragging, currentPrice, invertPriceDisplay, onLimitPriceChange]);

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
    <div className="w-full h-full max-h-[calc(100vh-200px)] bg-black/80 backdrop-blur-sm border-2 border-[#00D9FF] p-6 shadow-[0_0_30px_rgba(0,217,255,0.3)] overflow-y-auto">
        {/* Token Pair Info */}
        {displayBaseTokenInfo && displayQuoteTokenInfo && (
        <div className="flex flex-col gap-4 mb-6">
          <div className="flex items-center justify-between">
            <h3 className="text-2xl font-bold text-[#00D9FF]">
                <span className="flex items-center gap-2">
                  <img 
                    src={`/coin-logos/${displayBaseTokenInfo.ticker}.svg`} 
                    alt={`${displayBaseTokenInfo.ticker} logo`} 
                    className="w-6 h-6 inline-block"
                  />
                  {formatTokenTicker(displayBaseTokenInfo.ticker)} Price
                </span>
              </h3>
            {loading && (
              <span className="text-xs text-[#00D9FF]/50 animate-pulse">Updating...</span>
            )}
          </div>
        </div>
      )}

      {/* Price Display */}
      {loading && !currentPrice ? (
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-[#00D9FF]/70">Loading price data...</div>
        </div>
      ) : currentPrice ? (
        <div className="space-y-6">
          {/* Visual Price Scale */}
          <div 
            ref={containerRef}
            className="relative min-h-[400px] bg-black/40 border border-[#00D9FF]/20 rounded select-none"
          >
            {/* Y-axis tick marks */}
            {[-30, -25, -20, -15, -10, -5, 0, 5, 10, 15, 20, 25, 30].map((percentDiff) => {
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
                  <div className="flex items-center gap-1 px-2 bg-black/80 rounded py-0.5">
                    <div className="w-2 h-px bg-[#00D9FF]/30"></div>
                    <span className="text-xs text-[#00D9FF]/50 font-mono">
                      {percentDiff > 0 ? '+' : ''}{percentDiff}%
                    </span>
                  </div>
                  <div className="flex-1 h-px border-t border-dashed border-[#00D9FF]/10"></div>
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
                className="absolute top-1/2 -translate-y-1/2 w-full border-t-2 border-[#00D9FF] shadow-[0_0_15px_rgba(0,217,255,0.8)] transition-all duration-500 pointer-events-none"
              />
              <div 
                className={`absolute right-0 flex items-center gap-2 bg-black/90 px-3 py-1 border border-[#00D9FF] w-[250px] ${
                  limitPricePosition && limitPricePosition < currentPricePosition ? 'top-0 -translate-y-[calc(100%+0px)]' : 'bottom-0 translate-y-[calc(100%+0px)]'
                }`}
              >
                <span className="text-xs text-[#00D9FF]/70 whitespace-nowrap">Current Price:</span>
                <span className="text-sm font-bold text-[#00D9FF] min-w-[60px] text-right">
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
                    <img
                      src={`/coin-logos/${displayQuoteTokenInfo.ticker}.svg`}
                      alt={`${displayQuoteTokenInfo.ticker} logo`}
                      className="w-[16px] h-[16px] object-contain"
                      style={{ filter: 'brightness(0) saturate(100%) invert(68%) sepia(96%) saturate(2367%) hue-rotate(167deg) brightness(103%) contrast(101%)' }}
                      onError={(e) => {
                        e.currentTarget.src = '/coin-logos/default.svg';
                      }}
                    />
                  </>
                )}
              </div>
            </div>

            {/* Limit Order Price Line - Draggable */}
            {priceToDisplay && limitPricePosition !== null && onLimitPriceChange && (
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
                  className={`absolute top-1/2 -translate-y-1/2 w-full border-t-2 border-1 border-[#FF0080] ${isDragging ? 'shadow-[0_0_35px_rgba(255,0,128,1)] border-t-[3px]' : 'shadow-[0_0_15px_rgba(255,0,128,0.8)] hover:shadow-[0_0_25px_rgba(255,0,128,1)]'} pointer-events-none`}
                  style={{
                    transition: isDragging ? 'none' : 'all 200ms'
                  }}
                />
                <div 
                  className={`absolute right-0 flex flex-col gap-1 bg-black/90 px-3 py-1 border border-[#FF0080] pointer-events-none w-[250px] ${
                    limitPricePosition < currentPricePosition ? 'bottom-0 translate-y-[calc(100%+0px)]' : 'top-0 -translate-y-[calc(100%+0px)]'
                  }`}
                >
                  {displayQuoteTokenInfos.length > 0 && displayQuoteTokenInfos.map((tokenInfo, index) => (
                    <div key={index} className="flex items-center justify-between">
                      {index === 0 && (
                        <span className="text-xs text-[#FF0080]/70 whitespace-nowrap">
                          Limit Price:
                        </span>
                      )}
                      {index > 0 && (
                        <span className="text-xs text-[#FF0080]/70 whitespace-nowrap">
                          {/* Empty space to align with first row */}
                        </span>
                      )}
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-bold text-[#FF0080]">
                          <NumberFlow 
                            value={priceToDisplay || 0} 
                            format={{ 
                              minimumSignificantDigits: 1,
                              maximumSignificantDigits: 4 
                            }}
                          />
                        </span>
                        {tokenInfo && (
                          <>
                            <span className="text-xs text-[#FF0080]">
                              {formatTokenTicker(tokenInfo.ticker)}
                            </span>
                            <img
                              src={`/coin-logos/${tokenInfo.ticker}.svg`}
                              alt={`${tokenInfo.ticker} logo`}
                              className="w-[16px] h-[16px] object-contain"
                              style={{ filter: 'brightness(0) saturate(100%) invert(47%) sepia(99%) saturate(6544%) hue-rotate(312deg) brightness(103%) contrast(103%)' }}
                              onError={(e) => {
                                e.currentTarget.src = '/coin-logos/default.svg';
                              }}
                            />
                          </>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
        </div>
        </div>
      ) : (
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-[#00D9FF]/70">No price data available</div>
          </div>
        )}
    </div>
  );
}

