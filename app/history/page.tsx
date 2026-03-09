'use client';

import { useState, useCallback, useRef, useMemo } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { CompletedOrderCard, CompletedCardRef } from '@/components/discover/CompletedOrderCard';
import { LiquidGlassCard } from '@/components/ui/liquid-glass';
import { PixelSpinner } from '@/components/ui/PixelSpinner';
import PixelBlastBackground from '@/components/ui/PixelBlastBackground';
import { LogoPreloader } from '@/components/LogoPreloader';
import { DisclaimerDialog } from '@/components/DisclaimerDialog';
import { useOpenPositions, CompleteOrderDetails } from '@/hooks/contracts/useOpenPositions';
import { useTokenPrices } from '@/hooks/crypto/useTokenPrices';
import { useContractWhitelistRead } from '@/hooks/contracts/useContractWhitelistRead';
import { getTokenInfo, getTokenInfoByIndex } from '@/utils/tokenUtils';
import { cn } from '@/lib/utils';

type StatusFilter = 'all' | 'completed' | 'cancelled';

export default function HistoryPage() {
  const [showDisclaimer, setShowDisclaimer] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const topCardRef = useRef<CompletedCardRef | null>(null);

  const { allOrders, isLoading: ordersLoading } = useOpenPositions(undefined, true);
  const { activeTokens } = useContractWhitelistRead();
  const whitelist = useMemo(() =>
    activeTokens.map(t => t.tokenAddress.toLowerCase()),
    [activeTokens]
  );

  // Get all token addresses for price fetching
  const allTokenAddresses = useMemo(() => {
    const addresses = new Set<string>();
    allOrders.forEach(order => {
      addresses.add(order.orderDetailsWithID.orderDetails.sellToken.toLowerCase());
      order.orderDetailsWithID.orderDetails.buyTokensIndex.forEach((idx) => {
        const addr = whitelist[Number(idx)];
        if (addr) addresses.add(addr);
      });
    });
    return Array.from(addresses);
  }, [allOrders, whitelist]);

  const { prices: tokenPrices, isLoading: pricesLoading } = useTokenPrices(allTokenAddresses, { disableRefresh: true });

  // Check if an order is unfillable (dust) — mirrors contract fillOrder logic
  const isUnfillable = useCallback((order: CompleteOrderDetails) => {
    const details = order.orderDetailsWithID;
    if (details.status !== 0) return false;
    const remaining = details.remainingSellAmount;
    if (remaining === 0n) return true;
    const sellAmount = details.orderDetails.sellAmount;
    const buyAmounts = details.orderDetails.buyAmounts;
    if (buyAmounts.length === 0 || sellAmount === 0n) return false;
    for (const buyAmount of buyAmounts) {
      if (buyAmount === 0n) continue;
      const minBuy = (buyAmount + sellAmount - 1n) / sellAmount;
      const soldAmount = (minBuy * sellAmount) / buyAmount;
      if (soldAmount > 0n && soldAmount <= remaining) return false;
    }
    return true;
  }, []);

  // Filter to completed, cancelled, and unfillable orders, sorted by order ID descending
  const filteredOrders = useMemo(() => {
    let orders = allOrders.filter(o => {
      const status = o.orderDetailsWithID.status;
      const unfillable = status === 0 && isUnfillable(o);
      if (statusFilter === 'completed') return status === 2 || unfillable;
      if (statusFilter === 'cancelled') return status === 1;
      return status === 1 || status === 2 || unfillable;
    });

    // Sort by order ID descending (newest first)
    orders.sort((a, b) => Number(b.orderDetailsWithID.orderID) - Number(a.orderDetailsWithID.orderID));
    return orders;
  }, [allOrders, statusFilter, isUnfillable]);

  const handleSwipeComplete = useCallback((_direction: 'left' | 'right') => {
    setCurrentIndex(prev => prev + 1);
  }, []);

  const handleButtonSwipe = useCallback((direction: 'left' | 'right') => {
    if (topCardRef.current) {
      topCardRef.current.swipe(direction);
    }
  }, []);

  const handleReset = useCallback(() => {
    setCurrentIndex(0);
  }, []);

  const handleFilterChange = useCallback((filter: StatusFilter) => {
    setStatusFilter(filter);
    setCurrentIndex(0);
  }, []);

  const visibleOrders = filteredOrders.slice(currentIndex);
  const stackCards = visibleOrders.slice(0, 3);
  const dataReady = !ordersLoading && !pricesLoading;

  useState(() => {
    if (typeof window !== 'undefined') {
      const accepted = localStorage.getItem('disclaimer-accepted');
      if (accepted !== 'true') setShowDisclaimer(true);
    }
  });

  return (
    <>
      <DisclaimerDialog open={showDisclaimer} onAccept={() => setShowDisclaimer(false)} />
      <LogoPreloader />
      <main className="flex min-h-screen flex-col items-center relative">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: dataReady ? 1 : 0 }}
          transition={{ duration: 1.2, delay: 0.3 }}
          className="fixed inset-0 z-0"
        >
          <PixelBlastBackground />
        </motion.div>

        <div className="w-full px-4 mt-4 pb-12 relative z-10">
          <div className="max-w-md mx-auto">
            {/* Header */}
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-center mb-6"
            >
              <h1 className="text-2xl font-bold text-white mb-1">Order History</h1>
              <p className="text-white/50 text-sm">Browse completed and cancelled orders</p>
            </motion.div>

            {/* Status filter pills */}
            <div className="flex justify-center gap-2 mb-6">
              {([
                { key: 'all', label: 'All' },
                { key: 'completed', label: 'Completed' },
                { key: 'cancelled', label: 'Cancelled' },
              ] as const).map(({ key, label }) => (
                <button
                  key={key}
                  onClick={() => handleFilterChange(key)}
                  className={cn(
                    'px-4 py-1.5 rounded-full text-sm font-medium transition-all',
                    statusFilter === key
                      ? 'bg-white/15 text-white border border-white/20'
                      : 'bg-white/5 text-white/50 border border-transparent hover:bg-white/10 hover:text-white/70'
                  )}
                >
                  {label}
                </button>
              ))}
            </div>

            {!dataReady ? (
              <div className="flex flex-col items-center justify-center py-20">
                <PixelSpinner size={48} className="mb-6" />
                <p className="text-white text-lg mb-2">Loading Orders</p>
                <p className="text-gray-400 text-sm">
                  {ordersLoading ? 'Fetching orders...' : 'Loading prices...'}
                </p>
              </div>
            ) : filteredOrders.length === 0 ? (
              <div className="flex items-center justify-center min-h-[400px]">
                <LiquidGlassCard className="p-8 text-center max-w-sm" glowIntensity="low" blurIntensity="md">
                  <div className="text-5xl mb-4">📭</div>
                  <h3 className="text-xl font-semibold text-white mb-2">No Orders Found</h3>
                  <p className="text-white/60 text-sm">No {statusFilter === 'all' ? 'completed or cancelled' : statusFilter} orders yet.</p>
                </LiquidGlassCard>
              </div>
            ) : visibleOrders.length === 0 ? (
              <div className="flex items-center justify-center min-h-[400px]">
                <LiquidGlassCard className="p-8 text-center max-w-sm" glowIntensity="low" blurIntensity="md">
                  <div className="text-5xl mb-4">✨</div>
                  <h3 className="text-xl font-semibold text-white mb-2">You've Seen Them All!</h3>
                  <p className="text-white/60 text-sm mb-6">
                    Browsed through all {filteredOrders.length} orders.
                  </p>
                  <button
                    onClick={handleReset}
                    className="px-6 py-2 bg-white/10 hover:bg-white/20 text-white rounded-lg transition-colors"
                  >
                    Start Over
                  </button>
                </LiquidGlassCard>
              </div>
            ) : (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="flex flex-col items-center"
              >
                {/* Card stack */}
                <div className="relative w-full max-w-sm h-[480px]">
                  <AnimatePresence mode="popLayout">
                    {stackCards.map((order, index) => (
                      <CompletedOrderCard
                        key={order.orderDetailsWithID.orderID.toString()}
                        order={order}
                        isTop={index === 0}
                        stackIndex={index}
                        onSwipeComplete={handleSwipeComplete}
                        cardRef={index === 0 ? topCardRef : undefined}
                        prices={tokenPrices}
                      />
                    ))}
                  </AnimatePresence>
                </div>

                {/* Navigation buttons */}
                <div className="flex gap-8 mt-6">
                  <button
                    onClick={() => handleButtonSwipe('left')}
                    className="w-14 h-14 rounded-full bg-white/5 hover:bg-white/15 active:bg-white/25 border border-white/10 hover:border-white/20 flex items-center justify-center transition-all duration-150 hover:scale-110 active:scale-95"
                    aria-label="Previous"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-6 h-6 text-white/60">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
                    </svg>
                  </button>

                  <button
                    onClick={() => handleButtonSwipe('right')}
                    className="w-14 h-14 rounded-full bg-white/5 hover:bg-white/15 active:bg-white/25 border border-white/10 hover:border-white/20 flex items-center justify-center transition-all duration-150 hover:scale-110 active:scale-95"
                    aria-label="Next"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-6 h-6 text-white/60">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                    </svg>
                  </button>
                </div>

                {/* Counter */}
                <div className="mt-4 text-white/40 text-sm">
                  {currentIndex + 1} / {filteredOrders.length}
                </div>
              </motion.div>
            )}
          </div>
        </div>
      </main>
    </>
  );
}
