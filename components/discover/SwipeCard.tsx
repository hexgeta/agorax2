'use client';

import { useState } from 'react';
import { motion, useMotionValue, useTransform, animate, PanInfo } from 'framer-motion';
import { LiquidGlassCard } from '@/components/ui/liquid-glass';
import { TokenLogo } from '@/components/TokenLogo';
import { ScoreIndicator } from './ScoreIndicator';
import { ScoredOrder } from '@/types/discover';
import { TokenPrices } from '@/hooks/crypto/useTokenPrices';
import { getTokenInfo, getTokenInfoByIndex, formatTokenTicker } from '@/utils/tokenUtils';
import { getRemainingPercentage } from '@/utils/orderUtils';
import { formatUnits } from 'viem';
import { cn } from '@/lib/utils';

export interface SwipeCardRef {
  swipe: (direction: 'left' | 'right') => void;
}

interface SwipeCardProps {
  order: ScoredOrder;
  onSwipeComplete: (direction: 'left' | 'right') => void;
  isTop: boolean;
  stackIndex: number;
  cardRef?: React.MutableRefObject<SwipeCardRef | null>;
  prices?: TokenPrices;
}

export function SwipeCard({ order, onSwipeComplete, isTop, stackIndex, cardRef, prices = {} }: SwipeCardProps) {
  const x = useMotionValue(0);

  // Track which buy token is currently displayed (for cycling through)
  const [selectedBuyTokenIndex, setSelectedBuyTokenIndex] = useState(0);

  // Expose swipe method for programmatic swipes (button clicks)
  const triggerSwipe = async (direction: 'left' | 'right') => {
    const flyOutX = direction === 'right' ? 600 : -600;

    await animate(x, flyOutX, {
      type: 'tween',
      duration: 0.4,
      ease: [0.32, 0.72, 0, 1], // Custom ease for natural feel
    });

    onSwipeComplete(direction);
  };

  // Attach ref for parent to trigger swipes
  if (cardRef && isTop) {
    cardRef.current = { swipe: triggerSwipe };
  }

  // Y follows an arc based on X position (upside-down parabola)
  // At x=0, y=0. As |x| increases, y goes negative (card rises up)
  // Formula: y = -k * x^2 where k controls the arc steepness
  const arcY = useTransform(x, (xValue) => {
    const arcIntensity = 0.0004; // Controls how pronounced the arc is
    return -arcIntensity * xValue * xValue;
  });

  // Rotation follows horizontal drag - pivots from bottom of card like Tinder
  const rotate = useTransform(x, [-300, 0, 300], [-25, 0, 25]);

  // Overlay opacity based on drag distance
  const saveOverlayOpacity = useTransform(x, [0, 60, 120], [0, 0.6, 1]);
  const passOverlayOpacity = useTransform(x, [-120, -60, 0], [1, 0.6, 0]);

  const SWIPE_THRESHOLD = 100;
  const VELOCITY_THRESHOLD = 300;

  const handleDragEnd = async (_: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
    const { offset, velocity } = info;

    // Check if swipe meets threshold - consider both position and velocity
    const swipedRight = offset.x > SWIPE_THRESHOLD || (offset.x > 50 && velocity.x > VELOCITY_THRESHOLD);
    const swipedLeft = offset.x < -SWIPE_THRESHOLD || (offset.x < -50 && velocity.x < -VELOCITY_THRESHOLD);

    if (swipedRight || swipedLeft) {
      const direction = swipedRight ? 'right' : 'left';

      // Animate card flying off screen along the arc
      const flyOutX = direction === 'right' ? 600 : -600;

      await animate(x, flyOutX, {
        type: 'tween',
        duration: 0.3,
        ease: 'easeOut',
      });

      onSwipeComplete(direction);
    } else {
      // Snap back to center with spring animation
      animate(x, 0, { type: 'spring', stiffness: 400, damping: 25 });
    }
  };

  // Get order details
  const orderDetails = order.orderDetailsWithID.orderDetails;
  const sellTokenInfo = getTokenInfo(orderDetails.sellToken);
  const remainingSellAmount = order.orderDetailsWithID.remainingSellAmount;
  const isAllOrNothing = orderDetails.allOrNothing;

  // Calculate fill percentage (how much has been filled)
  const remainingPercentage = Number(getRemainingPercentage(order.orderDetailsWithID)) / 1e18;
  const fillPercentage = 100 - (remainingPercentage * 100);

  // Get current buy token (with cycling support)
  const buyTokensIndex = orderDetails.buyTokensIndex;
  const buyAmounts = orderDetails.buyAmounts;
  const currentBuyTokenIndex = selectedBuyTokenIndex % buyTokensIndex.length;
  const currentBuyTokenInfo = getTokenInfoByIndex(Number(buyTokensIndex[currentBuyTokenIndex]));
  const originalBuyAmount = buyAmounts[currentBuyTokenIndex];

  // Calculate remaining buy amount (proportional to remaining sell amount)
  const remainingBuyAmount = (originalBuyAmount * BigInt(Math.floor(remainingPercentage * 1e18))) / BigInt(1e18);

  // Format amounts
  const sellAmountFormatted = parseFloat(formatUnits(remainingSellAmount, sellTokenInfo.decimals));
  const buyAmountFormatted = parseFloat(formatUnits(remainingBuyAmount, currentBuyTokenInfo.decimals));

  // Calculate dynamic market discount for the currently selected buy token
  const sellTokenAddress = orderDetails.sellToken.toLowerCase();
  const currentBuyTokenAddress = currentBuyTokenInfo.address.toLowerCase();
  const sellTokenPrice = prices[sellTokenAddress]?.price ?? 0;
  const currentBuyTokenPrice = prices[currentBuyTokenAddress]?.price ?? 0;

  let currentPriceDiscount = 0;
  if (sellTokenPrice > 0 && currentBuyTokenPrice > 0 && buyAmountFormatted > 0) {
    // Calculate sell value in USD
    const sellValueUsd = sellAmountFormatted * sellTokenPrice;
    // Calculate the limit price per buy token (what the seller is implicitly pricing their token at)
    const limitBuyTokenPrice = sellValueUsd / buyAmountFormatted;
    // How much above/below market is this limit price?
    // Positive = seller pricing buy token above market = good deal for buyer
    // Negative = seller pricing buy token below market = bad deal for buyer
    currentPriceDiscount = ((limitBuyTokenPrice - currentBuyTokenPrice) / currentBuyTokenPrice) * 100;
    currentPriceDiscount = Math.round(currentPriceDiscount * 10) / 10; // Round to 1 decimal
  }

  // Handle cycling through buy tokens
  const handleBuyTokenClick = (e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent drag from triggering
    if (buyTokensIndex.length > 1) {
      setSelectedBuyTokenIndex(prev => (prev + 1) % buyTokensIndex.length);
    }
  };

  // Format large numbers
  const formatAmount = (amount: number): string => {
    if (amount >= 1_000_000_000) return `${(amount / 1_000_000_000).toFixed(2)}B`;
    if (amount >= 1_000_000) return `${(amount / 1_000_000).toFixed(2)}M`;
    if (amount >= 1_000) return `${(amount / 1_000).toFixed(2)}K`;
    if (amount >= 1) return amount.toFixed(2);
    return amount.toPrecision(4);
  };

  // Calculate expiration
  const expirationTime = Number(orderDetails.expirationTime) * 1000;
  const now = Date.now();
  const daysUntilExpiry = Math.max(0, Math.floor((expirationTime - now) / (1000 * 60 * 60 * 24)));
  const expiryText = daysUntilExpiry === 0 ? 'Expires today' :
                     daysUntilExpiry === 1 ? 'Expires tomorrow' :
                     `Expires in ${daysUntilExpiry} days`;

  return (
    <motion.div
      className="absolute inset-0"
      style={{ zIndex: 10 - stackIndex }}
      initial={{ scale: 0.95, opacity: 0, y: stackIndex * 8 }}
      animate={{
        scale: 1 - stackIndex * 0.04,
        opacity: stackIndex < 3 ? 1 : 0,
        y: stackIndex * 8,
      }}
      exit={{ opacity: 0, transition: { duration: 0.15 } }}
      transition={{ type: 'spring', stiffness: 300, damping: 25 }}
    >
      <motion.div
        style={{ x, y: arcY, rotate, touchAction: isTop ? 'none' : 'auto' }}
        drag={isTop ? 'x' : false}
        dragElastic={1}
        dragMomentum={false}
        onDragEnd={isTop ? handleDragEnd : undefined}
        whileDrag={{ scale: 1.02 }}
        className={cn(
          'w-full h-full select-none',
          isTop ? 'cursor-grab active:cursor-grabbing' : 'pointer-events-none'
        )}
      >
      <LiquidGlassCard
        className="w-full h-full p-5 relative overflow-hidden"
        glowIntensity="low"
        blurIntensity="md"
        borderRadius="20px"
      >
        {/* SAVE overlay */}
        <motion.div
          style={{ opacity: saveOverlayOpacity }}
          className="absolute inset-0 bg-green-500/20 flex items-center justify-center pointer-events-none z-10"
        >
          <div className="border-4 border-green-500 rounded-lg px-6 py-2 rotate-[-20deg]">
            <span className="text-green-500 text-3xl font-bold tracking-wider">SAVE</span>
          </div>
        </motion.div>

        {/* PASS overlay */}
        <motion.div
          style={{ opacity: passOverlayOpacity }}
          className="absolute inset-0 bg-red-500/20 flex items-center justify-center pointer-events-none z-10"
        >
          <div className="border-4 border-red-500 rounded-lg px-6 py-2 rotate-[20deg]">
            <span className="text-red-500 text-3xl font-bold tracking-wider">PASS</span>
          </div>
        </motion.div>

        {/* Header with score and AON badge */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <ScoreIndicator score={order.score} size="md" />
            {isAllOrNothing && (
              <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-purple-500/20 text-purple-400 border border-purple-400">
                AON
              </span>
            )}
          </div>
          <div className="flex flex-col items-end">
            {currentPriceDiscount !== 0 ? (
              <>
                <span className={cn(
                  'text-sm font-medium',
                  currentPriceDiscount < 0 ? 'text-red-400' : 'text-green-400'
                )}>
                  {currentPriceDiscount > 0 ? '+' : ''}{currentPriceDiscount.toFixed(1)}%
                </span>
                <span className="text-xs text-white/40">
                  {currentPriceDiscount < 0 ? 'below market' : 'above market'}
                </span>
              </>
            ) : (
              <span className="text-sm text-white/40">--</span>
            )}
          </div>
        </div>

        {/* Sell token section */}
        <div className="mb-4">
          <span className="text-xs text-white/40 uppercase tracking-wider">Selling</span>
          <div className="flex items-center gap-3 mt-1">
            <div className="w-12 h-12 rounded-full bg-white/5 flex items-center justify-center overflow-hidden">
              <TokenLogo ticker={sellTokenInfo.ticker} className="w-10 h-10" />
            </div>
            <div>
              <div className="text-xl font-semibold text-white">
                {formatAmount(sellAmountFormatted)} {formatTokenTicker(sellTokenInfo.ticker)}
              </div>
              <div className="text-sm text-white/40">
                {sellTokenPrice > 0
                  ? `$${formatAmount(sellAmountFormatted * sellTokenPrice)}`
                  : sellTokenInfo.name}
              </div>
            </div>
          </div>
        </div>

        {/* Arrow */}
        <div className="flex justify-center my-2">
          <div className="text-white/30 text-2xl">↓</div>
        </div>

        {/* Buy token section - clickable to cycle through options */}
        <div className="mb-4">
          <div className="flex items-center justify-between">
            <span className="text-xs text-white/40 uppercase tracking-wider">Wants</span>
            {buyTokensIndex.length > 1 && (
              <span className="text-xs text-white/40">
                {currentBuyTokenIndex + 1}/{buyTokensIndex.length} options
              </span>
            )}
          </div>
          <div
            onClick={handleBuyTokenClick}
            className={cn(
              "flex items-center gap-3 mt-1 p-2 -mx-2 rounded-lg transition-colors",
              buyTokensIndex.length > 1 && "cursor-pointer hover:bg-white/5 active:bg-white/10"
            )}
          >
            <div className="w-12 h-12 rounded-full bg-white/5 flex items-center justify-center overflow-hidden">
              <TokenLogo ticker={currentBuyTokenInfo.ticker} className="w-10 h-10" />
            </div>
            <div className="flex-1">
              <div className="text-xl font-semibold text-white">
                {formatAmount(buyAmountFormatted)} {formatTokenTicker(currentBuyTokenInfo.ticker)}
              </div>
              <div className="text-sm text-white/40">
                {currentBuyTokenPrice > 0
                  ? `$${formatAmount(buyAmountFormatted * currentBuyTokenPrice)}`
                  : currentBuyTokenInfo.name}
              </div>
            </div>
            {buyTokensIndex.length > 1 && (
              <div className="text-white/30">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" />
                </svg>
              </div>
            )}
          </div>
        </div>

        {/* Fill Progress Bar - spans full width */}
        <div className="mt-4 mb-3">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs text-white/40">Filled</span>
            <span className={cn(
              'text-xs font-medium',
              fillPercentage === 0 ? 'text-white/40' : 'text-white'
            )}>
              {fillPercentage.toFixed(0)}%
            </span>
          </div>
          <div className="w-full h-2 bg-white/10 rounded-full overflow-hidden">
            <div
              className={cn(
                'h-full rounded-full transition-all duration-300',
                fillPercentage === 0 ? 'bg-white/20' : 'bg-blue-500'
              )}
              style={{ width: `${fillPercentage}%` }}
            />
          </div>
        </div>

        {/* Divider */}
        <div className="border-t border-white/10 my-3" />

        {/* Footer info */}
        <div className="text-sm">
          <div className="flex justify-between">
            <span className="text-white/40">Expiry</span>
            <span className="text-white/60">{expiryText}</span>
          </div>
        </div>

        {/* Swipe hint for top card */}
        {isTop && (
          <div className="absolute bottom-2 left-0 right-0 flex justify-center">
            <span className="text-xs text-white/20">← Swipe to decide →</span>
          </div>
        )}
      </LiquidGlassCard>
      </motion.div>
    </motion.div>
  );
}
