'use client';

import { useState, useCallback, useRef } from 'react';
import { AnimatePresence } from 'framer-motion';
import { SwipeCard, SwipeCardRef } from './SwipeCard';
import { EmptyState } from './EmptyState';
import { ScoredOrder } from '@/types/discover';
import { TokenPrices } from '@/hooks/crypto/useTokenPrices';
import { cn } from '@/lib/utils';

interface SwipeStackProps {
  orders: ScoredOrder[];
  onSwipeRight: (order: ScoredOrder) => void;
  onSwipeLeft: (order: ScoredOrder) => void;
  isLoading?: boolean;
  isConnected?: boolean;
  onRefresh?: () => void;
  className?: string;
  prices?: TokenPrices;
}

export function SwipeStack({
  orders,
  onSwipeRight,
  onSwipeLeft,
  isLoading = false,
  isConnected = true,
  onRefresh,
  className,
  prices = {},
}: SwipeStackProps) {
  // Track which order IDs have been swiped away
  const [swipedIds, setSwipedIds] = useState<Set<string>>(new Set());

  // Ref to access the top card's swipe method
  const topCardRef = useRef<SwipeCardRef | null>(null);

  // Filter out swiped orders
  const visibleOrders = orders.filter(
    order => !swipedIds.has(order.orderDetailsWithID.orderID.toString())
  );

  const handleSwipeComplete = useCallback((order: ScoredOrder, direction: 'left' | 'right') => {
    const orderId = order.orderDetailsWithID.orderID.toString();

    // Mark as swiped immediately for smooth transition
    setSwipedIds(prev => new Set(prev).add(orderId));

    // Call appropriate callback
    if (direction === 'right') {
      onSwipeRight(order);
    } else {
      onSwipeLeft(order);
    }
  }, [onSwipeRight, onSwipeLeft]);

  const handleRefresh = useCallback(() => {
    setSwipedIds(new Set());
    onRefresh?.();
  }, [onRefresh]);

  // Handle button clicks - triggers animated swipe via ref
  const handleButtonSwipe = useCallback((direction: 'left' | 'right') => {
    if (visibleOrders.length > 0 && topCardRef.current) {
      topCardRef.current.swipe(direction);
    }
  }, [visibleOrders]);

  // Show loading state
  if (isLoading) {
    return <EmptyState type="loading" className={className} />;
  }

  // Show connect wallet state
  if (!isConnected) {
    return <EmptyState type="not-connected" className={className} />;
  }

  // Show no orders state
  if (orders.length === 0) {
    return <EmptyState type="no-orders" onRefresh={onRefresh} className={className} />;
  }

  // Show end of stack state
  if (visibleOrders.length === 0) {
    return <EmptyState type="end-of-stack" onRefresh={handleRefresh} className={className} />;
  }

  // Take top 3 cards for stack effect
  const stackCards = visibleOrders.slice(0, 3);

  return (
    <div className={cn('flex flex-col items-center', className)}>
      {/* Card stack container */}
      <div className="relative w-full max-w-sm h-[480px]">
        <AnimatePresence mode="popLayout">
          {stackCards.map((order, index) => (
            <SwipeCard
              key={order.orderDetailsWithID.orderID.toString()}
              order={order}
              isTop={index === 0}
              stackIndex={index}
              onSwipeComplete={(direction) => handleSwipeComplete(order, direction)}
              cardRef={index === 0 ? topCardRef : undefined}
              prices={prices}
            />
          ))}
        </AnimatePresence>
      </div>

      {/* Action buttons */}
      <div className="flex gap-8 mt-6">
        <button
          onClick={() => handleButtonSwipe('left')}
          className="w-16 h-16 rounded-full bg-red-500/10 hover:bg-red-500/25 active:bg-red-500/40 border-2 border-red-500/40 hover:border-red-500/60 flex items-center justify-center transition-all duration-150 hover:scale-110 active:scale-95 shadow-lg shadow-red-500/10"
          aria-label="Pass"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={2.5}
            stroke="currentColor"
            className="w-7 h-7 text-red-400"
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        <button
          onClick={() => handleButtonSwipe('right')}
          className="w-16 h-16 rounded-full bg-green-500/10 hover:bg-green-500/25 active:bg-green-500/40 border-2 border-green-500/40 hover:border-green-500/60 flex items-center justify-center transition-all duration-150 hover:scale-110 active:scale-95 shadow-lg shadow-green-500/10"
          aria-label="Save"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={2.5}
            stroke="currentColor"
            className="w-7 h-7 text-green-400"
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
          </svg>
        </button>
      </div>

      {/* Counter */}
      <div className="mt-4 text-white/40 text-sm">
        {visibleOrders.length} order{visibleOrders.length !== 1 ? 's' : ''} remaining
      </div>
    </div>
  );
}
