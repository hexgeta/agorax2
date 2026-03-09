'use client';

import { useState } from 'react';
import { motion, useMotionValue, useTransform, animate, PanInfo } from 'framer-motion';
import { LiquidGlassCard } from '@/components/ui/liquid-glass';
import { TokenLogo } from '@/components/TokenLogo';
import { CompleteOrderDetails } from '@/hooks/contracts/useOpenPositions';
import { TokenPrices } from '@/hooks/crypto/useTokenPrices';
import { getTokenInfo, getTokenInfoByIndex, formatTokenTicker } from '@/utils/tokenUtils';
import { formatUnits } from 'viem';
import { cn } from '@/lib/utils';

export interface CompletedCardRef {
  swipe: (direction: 'left' | 'right') => void;
}

interface CompletedOrderCardProps {
  order: CompleteOrderDetails;
  onSwipeComplete: (direction: 'left' | 'right') => void;
  isTop: boolean;
  stackIndex: number;
  cardRef?: React.MutableRefObject<CompletedCardRef | null>;
  prices?: TokenPrices;
}

export function CompletedOrderCard({ order, onSwipeComplete, isTop, stackIndex, cardRef, prices = {} }: CompletedOrderCardProps) {
  const x = useMotionValue(0);
  const [selectedBuyTokenIndex, setSelectedBuyTokenIndex] = useState(0);

  const triggerSwipe = async (direction: 'left' | 'right') => {
    const flyOutX = direction === 'right' ? 600 : -600;
    await animate(x, flyOutX, {
      type: 'tween',
      duration: 0.4,
      ease: [0.32, 0.72, 0, 1],
    });
    onSwipeComplete(direction);
  };

  if (cardRef && isTop) {
    cardRef.current = { swipe: triggerSwipe };
  }

  const arcY = useTransform(x, (xValue) => -0.0004 * xValue * xValue);
  const rotate = useTransform(x, [-300, 0, 300], [-25, 0, 25]);

  const SWIPE_THRESHOLD = 100;
  const VELOCITY_THRESHOLD = 300;

  const handleDragEnd = async (_: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
    const { offset, velocity } = info;
    const swipedRight = offset.x > SWIPE_THRESHOLD || (offset.x > 50 && velocity.x > VELOCITY_THRESHOLD);
    const swipedLeft = offset.x < -SWIPE_THRESHOLD || (offset.x < -50 && velocity.x < -VELOCITY_THRESHOLD);

    if (swipedRight || swipedLeft) {
      const direction = swipedRight ? 'right' : 'left';
      const flyOutX = direction === 'right' ? 600 : -600;
      await animate(x, flyOutX, { type: 'tween', duration: 0.3, ease: 'easeOut' });
      onSwipeComplete(direction);
    } else {
      animate(x, 0, { type: 'spring', stiffness: 400, damping: 25 });
    }
  };

  const orderDetails = order.orderDetailsWithID.orderDetails;
  const sellTokenInfo = getTokenInfo(orderDetails.sellToken);
  const redeemedAmount = order.orderDetailsWithID.redeemedSellAmount;
  const remainingAmount = order.orderDetailsWithID.remainingSellAmount;
  // Total is remaining + redeemed (not orderDetails.sellAmount which includes protocol fees)
  const totalSellAmount = remainingAmount + redeemedAmount;

  // Detect unfillable (dust) orders — mirrors contract fillOrder logic
  const isUnfillable = (() => {
    if (order.orderDetailsWithID.status !== 0) return false;
    if (remainingAmount === 0n) return true;
    const sellAmt = orderDetails.sellAmount;
    if (sellAmt === 0n || orderDetails.buyAmounts.length === 0) return false;
    for (const ba of orderDetails.buyAmounts) {
      if (ba === 0n) continue;
      const minBuy = (ba + sellAmt - 1n) / sellAmt;
      const soldAmount = (minBuy * sellAmt) / ba;
      if (soldAmount > 0n && soldAmount <= remainingAmount) return false;
    }
    return true;
  })();

  // Fill percentage — based on how much of the original sell amount has been filled
  const fillPercentage = isUnfillable ? 100 : (
    orderDetails.sellAmount > 0n
      ? Number(((orderDetails.sellAmount - remainingAmount) * 10000n) / orderDetails.sellAmount) / 100
      : 0
  );

  // Status — unfillable orders display as "Completed"
  const status = order.orderDetailsWithID.status;
  const effectiveCompleted = status === 2 || isUnfillable;
  const statusText = effectiveCompleted ? 'Completed' : status === 1 ? 'Cancelled' : 'Active';
  const statusColor = effectiveCompleted ? 'text-blue-400 bg-blue-500/20 border-blue-500/30'
    : status === 1 ? 'text-red-400 bg-red-500/20 border-red-500/30'
    : 'text-green-400 bg-green-500/20 border-green-500/30';

  // Buy tokens
  const buyTokensIndex = orderDetails.buyTokensIndex;
  const buyAmounts = orderDetails.buyAmounts;
  const currentBuyTokenIndex = selectedBuyTokenIndex % buyTokensIndex.length;
  const currentBuyTokenInfo = getTokenInfoByIndex(Number(buyTokensIndex[currentBuyTokenIndex]));
  const originalBuyAmount = buyAmounts[currentBuyTokenIndex];

  // Format amounts — show filled amounts (sellAmount - remaining = what was actually traded)
  const filledSellAmount = orderDetails.sellAmount - remainingAmount;
  const sellAmountForDisplay = filledSellAmount;
  const buyAmountForDisplay = orderDetails.sellAmount > 0n
    ? (originalBuyAmount * filledSellAmount) / orderDetails.sellAmount
    : 0n;
  const sellAmountFormatted = parseFloat(formatUnits(sellAmountForDisplay, sellTokenInfo.decimals));
  const buyAmountFormatted = parseFloat(formatUnits(buyAmountForDisplay, currentBuyTokenInfo.decimals));

  // USD values
  const sellTokenAddress = orderDetails.sellToken.toLowerCase();
  const currentBuyTokenAddress = currentBuyTokenInfo.address.toLowerCase();
  const sellTokenPrice = prices[sellTokenAddress]?.price ?? 0;
  const currentBuyTokenPrice = prices[currentBuyTokenAddress]?.price ?? 0;

  const sellValueUsd = sellAmountFormatted * sellTokenPrice;

  // OTC vs market — use the original order rate (sellAmount / buyAmount) vs market rate
  // The rate is fixed at order creation and doesn't change with fills
  const originalSellFormatted = parseFloat(formatUnits(orderDetails.sellAmount, sellTokenInfo.decimals));
  const originalBuyFormatted = parseFloat(formatUnits(originalBuyAmount, currentBuyTokenInfo.decimals));
  let priceDiscount = 0;
  if (sellTokenPrice > 0 && currentBuyTokenPrice > 0 && originalBuyFormatted > 0 && originalSellFormatted > 0) {
    const originalSellValueUsd = originalSellFormatted * sellTokenPrice;
    const askingValueUsd = originalBuyFormatted * currentBuyTokenPrice;
    priceDiscount = ((askingValueUsd - originalSellValueUsd) / originalSellValueUsd) * 100;
    priceDiscount = Math.round(priceDiscount * 10) / 10;
  }

  const handleBuyTokenClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (buyTokensIndex.length > 1) {
      setSelectedBuyTokenIndex(prev => (prev + 1) % buyTokensIndex.length);
    }
  };

  const formatAmount = (amount: number): string => {
    if (amount >= 1_000_000_000) return `${(amount / 1_000_000_000).toFixed(2)}B`;
    if (amount >= 1_000_000) return `${(amount / 1_000_000).toFixed(2)}M`;
    if (amount >= 1_000) return `${(amount / 1_000).toFixed(2)}K`;
    if (amount >= 1) return amount.toFixed(2);
    if (amount === 0) return '0';
    return amount.toPrecision(4);
  };

  const orderId = Number(order.orderDetailsWithID.orderID);

  return (
    <motion.div
      className="absolute inset-0"
      style={{ zIndex: 10 - stackIndex }}
      initial={false}
      animate={{
        scale: 1 - stackIndex * 0.04,
        opacity: stackIndex < 3 ? 1 : 0,
        y: stackIndex * 8,
      }}
      exit={{ opacity: 0, transition: { duration: 0.1 } }}
      transition={{ type: 'spring', stiffness: 400, damping: 30 }}
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
          {/* Header */}
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <span className="text-white/50 text-sm font-mono">#{orderId}</span>
              <span className={cn('px-2 py-0.5 rounded-full text-xs font-medium border', statusColor)}>
                {statusText}
              </span>
              {orderDetails.allOrNothing && (
                <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-purple-500/20 text-purple-400 border border-purple-400">
                  AON
                </span>
              )}
            </div>
            <div className="flex flex-col items-end">
              {priceDiscount !== 0 ? (
                <>
                  <span className={cn(
                    'text-sm font-medium',
                    priceDiscount < 0 ? 'text-red-400' : 'text-green-400'
                  )}>
                    {priceDiscount > 0 ? '+' : ''}{priceDiscount.toFixed(1)}%
                  </span>
                  <span className="text-xs text-white/40">
                    {priceDiscount < 0 ? 'below market' : 'above market'}
                  </span>
                </>
              ) : (
                <span className="text-sm text-white/40">--</span>
              )}
            </div>
          </div>

          {/* Sell token */}
          <div className="mb-4">
            <span className="text-xs text-white/40 uppercase tracking-wider">Sold</span>
            <div className="flex items-center gap-3 mt-1">
              <div className="w-12 h-12 rounded-full bg-white/5 flex items-center justify-center overflow-hidden">
                <TokenLogo ticker={sellTokenInfo.ticker} className="w-10 h-10" />
              </div>
              <div>
                <div className="text-xl font-semibold text-white">
                  {formatAmount(sellAmountFormatted)} {formatTokenTicker(sellTokenInfo.ticker)}
                </div>
                <div className="text-sm text-white/40">
                  {sellValueUsd > 0 ? `$${formatAmount(sellValueUsd)}` : sellTokenInfo.name}
                </div>
              </div>
            </div>
          </div>

          {/* Arrow */}
          <div className="flex justify-center my-2">
            <div className="text-white/30 text-2xl">↓</div>
          </div>

          {/* Buy token */}
          <div className="mb-4">
            <div className="flex items-center justify-between">
              <span className="text-xs text-white/40 uppercase tracking-wider">For</span>
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

          {/* Fill Progress */}
          <div className="mt-4 mb-3">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs text-white/40">Filled</span>
              <span className={cn(
                'text-xs font-medium',
                fillPercentage >= 100 ? 'text-blue-400' :
                fillPercentage > 0 ? 'text-white' : 'text-white/40'
              )}>
                {fillPercentage.toFixed(1)}%
              </span>
            </div>
            <div className="w-full h-2 bg-white/10 rounded-full overflow-hidden">
              <div
                className={cn(
                  'h-full rounded-full transition-all duration-300',
                  fillPercentage >= 100 ? 'bg-blue-500' :
                  fillPercentage > 0 ? 'bg-blue-500/70' : 'bg-white/20'
                )}
                style={{ width: `${Math.min(fillPercentage, 100)}%` }}
              />
            </div>
          </div>

          {/* Divider */}
          <div className="border-t border-white/10 my-3" />

          {/* Footer info */}
          <div className="text-sm space-y-1">
            {sellValueUsd > 0 && (
              <div className="flex justify-between">
                <span className="text-white/40">Value</span>
                <span className="text-white/60">${formatAmount(sellValueUsd)}</span>
              </div>
            )}
            <div className="flex justify-between">
              <span className="text-white/40">Maker</span>
              <span className="text-white/60 font-mono text-xs">
                {order.userDetails.orderOwner.slice(0, 6)}...{order.userDetails.orderOwner.slice(-4)}
              </span>
            </div>
          </div>

          {/* Swipe hint */}
          {isTop && (
            <div className="absolute bottom-2 left-0 right-0 flex justify-center">
              <span className="text-xs text-white/20">← Swipe to browse →</span>
            </div>
          )}
        </LiquidGlassCard>
      </motion.div>
    </motion.div>
  );
}
