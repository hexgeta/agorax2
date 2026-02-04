'use client';

import { useState, useMemo, useCallback, useEffect } from 'react';
import { useAccount } from 'wagmi';
import { useOpenPositions } from '@/hooks/contracts/useOpenPositions';
import { useContractWhitelistRead } from '@/hooks/contracts/useContractWhitelistRead';
import { useTokenPrices } from '@/hooks/crypto/useTokenPrices';
import { useTokenBalances } from '@/context/TokenBalancesContext';
import { useOrderScoring, extractUniqueTokenAddresses } from '@/hooks/useOrderScoring';
import { useSavedOrders } from '@/hooks/useSavedOrders';
import { useViewedOrders } from '@/hooks/useViewedOrders';
import { SwipeStack } from '@/components/discover/SwipeStack';
import { SavedOrdersDrawer } from '@/components/discover/SavedOrdersDrawer';
import { ScoredOrder } from '@/types/discover';
import { DisclaimerDialog } from '@/components/DisclaimerDialog';
import { LogoPreloader } from '@/components/LogoPreloader';
import PixelBlastBackground from '@/components/ui/PixelBlastBackground';

export default function DiscoverPage() {
  const [showDisclaimer, setShowDisclaimer] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);

  // Wallet connection
  const { address, isConnected } = useAccount();

  // Load contract whitelist to populate token lookup cache
  useContractWhitelistRead();

  // Fetch all marketplace orders
  const {
    activeOrders,
    isLoading: ordersLoading,
    refetch: refetchOrders,
  } = useOpenPositions(undefined, true);

  // Get unique token addresses for price fetching
  const tokenAddresses = useMemo(
    () => extractUniqueTokenAddresses(activeOrders),
    [activeOrders]
  );

  // Fetch token prices
  const { prices, isLoading: pricesLoading } = useTokenPrices(tokenAddresses);

  // Get user's token balances from shared context (fetched in background on app load)
  const { rawBalances, isLoading: balancesLoading } = useTokenBalances();

  // Score and sort orders
  const { scoredOrders } = useOrderScoring(activeOrders, rawBalances, prices);

  // Saved orders state
  const { savedOrderIds, saveOrder, removeOrder, isSaved } = useSavedOrders();

  // Viewed orders tracking
  const {
    viewedOrderIds,
    markAsViewed,
    clearViewed,
    settings: viewSettings,
    updateSettings,
    getViewedCount,
    getPassedCount,
  } = useViewedOrders();

  // Get saved orders as full ScoredOrder objects
  const savedOrders = useMemo(() => {
    return scoredOrders.filter(order =>
      savedOrderIds.has(order.orderDetailsWithID.orderID.toString())
    );
  }, [scoredOrders, savedOrderIds]);

  // Filter out already saved orders and viewed orders from the stack
  const unsavedOrders = useMemo(() => {
    return scoredOrders.filter(order => {
      const orderId = order.orderDetailsWithID.orderID.toString();
      // Always hide saved orders
      if (savedOrderIds.has(orderId)) return false;
      // Hide viewed orders if setting is enabled
      if (viewSettings.hideViewed && viewedOrderIds.has(orderId)) return false;
      return true;
    });
  }, [scoredOrders, savedOrderIds, viewedOrderIds, viewSettings.hideViewed]);

  // Handle disclaimer
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const accepted = localStorage.getItem('disclaimer-accepted');
      setShowDisclaimer(accepted !== 'true');
    }
  }, []);

  // Handle swipe actions
  const handleSwipeRight = useCallback((order: ScoredOrder) => {
    const orderId = order.orderDetailsWithID.orderID.toString();
    saveOrder(order);
    markAsViewed(orderId, 'saved');
  }, [saveOrder, markAsViewed]);

  const handleSwipeLeft = useCallback((order: ScoredOrder) => {
    const orderId = order.orderDetailsWithID.orderID.toString();
    markAsViewed(orderId, 'passed');
  }, [markAsViewed]);

  // Handle fill order
  const handleFillOrder = useCallback((order: ScoredOrder) => {
    setDrawerOpen(false);
    window.location.href = `/marketplace?orderId=${order.orderDetailsWithID.orderID}`;
  }, []);

  const handleRefresh = useCallback(() => {
    refetchOrders();
  }, [refetchOrders]);

  const isLoading = ordersLoading || pricesLoading || (isConnected && balancesLoading);

  return (
    <>
      <DisclaimerDialog open={showDisclaimer} onAccept={() => setShowDisclaimer(false)} />
      <LogoPreloader />

      <main className="flex min-h-screen flex-col items-center relative overflow-hidden">
        {/* Animated background effect */}
        <div className="fixed inset-0 z-0">
          <PixelBlastBackground />
        </div>

        {/* Main Content */}
        <div className="w-full px-4 mt-20 relative z-10">
          <div className="max-w-md mx-auto">
            {/* Swipe stack */}
            <SwipeStack
              orders={unsavedOrders}
              onSwipeRight={handleSwipeRight}
              onSwipeLeft={handleSwipeLeft}
              isLoading={isLoading}
              isConnected={isConnected}
              onRefresh={handleRefresh}
              prices={prices}
            />
          </div>
        </div>

        {/* Saved orders FAB */}
        {savedOrders.length > 0 && (
          <button
            onClick={() => setDrawerOpen(true)}
            className="fixed bottom-6 right-6 z-[110] flex items-center gap-2 px-4 py-3 bg-green-500/20 hover:bg-green-500/30 border border-green-500/50 rounded-full text-green-400 font-medium transition-colors backdrop-blur-md"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={1.5}
              stroke="currentColor"
              className="w-5 h-5"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M17.593 3.322c1.1.128 1.907 1.077 1.907 2.185V21L12 17.25 4.5 21V5.507c0-1.108.806-2.057 1.907-2.185a48.507 48.507 0 0111.186 0z"
              />
            </svg>
            <span>{savedOrders.length} Saved</span>
          </button>
        )}

        {/* Saved orders drawer */}
        <SavedOrdersDrawer
          isOpen={drawerOpen}
          onClose={() => setDrawerOpen(false)}
          orders={savedOrders}
          onFillOrder={handleFillOrder}
          onRemoveOrder={removeOrder}
        />

        {/* Settings button */}
        <button
          onClick={() => setSettingsOpen(!settingsOpen)}
          className="fixed bottom-6 left-6 z-[110] p-3 bg-white/10 hover:bg-white/20 border border-white/20 rounded-full text-white/60 hover:text-white transition-colors backdrop-blur-md"
          aria-label="Settings"
        >
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
            <path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.325.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 0 1 1.37.49l1.296 2.247a1.125 1.125 0 0 1-.26 1.431l-1.003.827c-.293.241-.438.613-.43.992a7.723 7.723 0 0 1 0 .255c-.008.378.137.75.43.991l1.004.827c.424.35.534.955.26 1.43l-1.298 2.247a1.125 1.125 0 0 1-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.47 6.47 0 0 1-.22.128c-.331.183-.581.495-.644.869l-.213 1.281c-.09.543-.56.94-1.11.94h-2.594c-.55 0-1.019-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 0 1-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 0 1-1.369-.49l-1.297-2.247a1.125 1.125 0 0 1 .26-1.431l1.004-.827c.292-.24.437-.613.43-.991a6.932 6.932 0 0 1 0-.255c.007-.38-.138-.751-.43-.992l-1.004-.827a1.125 1.125 0 0 1-.26-1.43l1.297-2.247a1.125 1.125 0 0 1 1.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.086.22-.128.332-.183.582-.495.644-.869l.214-1.28Z" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
          </svg>
        </button>

        {/* Settings panel */}
        {settingsOpen && (
          <div className="fixed bottom-20 left-6 z-[110] w-72 p-4 bg-black/90 border border-white/20 rounded-xl backdrop-blur-md">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-white font-medium">Discover Settings</h3>
              <button
                onClick={() => setSettingsOpen(false)}
                className="text-white/40 hover:text-white"
              >
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Stats */}
            <div className="mb-4 p-3 bg-white/5 rounded-lg">
              <div className="text-xs text-white/40 mb-2">Statistics</div>
              <div className="flex justify-between text-sm">
                <span className="text-white/60">Total viewed:</span>
                <span className="text-white">{getViewedCount()}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-white/60">Passed:</span>
                <span className="text-white">{getPassedCount()}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-white/60">Saved:</span>
                <span className="text-white">{savedOrders.length}</span>
              </div>
            </div>

            {/* Hide viewed toggle */}
            <div className="mb-4">
              <label className="flex items-center justify-between cursor-pointer">
                <span className="text-sm text-white/80">Hide viewed orders</span>
                <button
                  onClick={() => updateSettings({ hideViewed: !viewSettings.hideViewed })}
                  className={`relative w-11 h-6 rounded-full transition-colors ${
                    viewSettings.hideViewed ? 'bg-green-500' : 'bg-white/20'
                  }`}
                >
                  <div
                    className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-transform ${
                      viewSettings.hideViewed ? 'translate-x-6' : 'translate-x-1'
                    }`}
                  />
                </button>
              </label>
            </div>

            {/* Expiry time */}
            <div className="mb-4">
              <label className="block text-sm text-white/80 mb-2">
                Show passed orders again after
              </label>
              <select
                value={viewSettings.expiryHours}
                onChange={(e) => updateSettings({ expiryHours: Number(e.target.value) })}
                className="w-full p-2 bg-white/10 border border-white/20 rounded-lg text-white text-sm focus:outline-none focus:border-white/40"
              >
                <option value={1}>1 hour</option>
                <option value={6}>6 hours</option>
                <option value={12}>12 hours</option>
                <option value={24}>24 hours</option>
                <option value={48}>2 days</option>
                <option value={168}>1 week</option>
                <option value={720}>30 days</option>
                <option value={8760}>Never (1 year)</option>
              </select>
            </div>

            {/* Clear history */}
            <button
              onClick={() => {
                clearViewed();
                setSettingsOpen(false);
              }}
              className="w-full p-2 bg-red-500/20 hover:bg-red-500/30 border border-red-500/40 rounded-lg text-red-400 text-sm transition-colors"
            >
              Clear viewed history
            </button>
          </div>
        )}
      </main>
    </>
  );
}
