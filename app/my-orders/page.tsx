'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAccount } from 'wagmi';
import { useSearchParams, usePathname } from 'next/navigation';
import { DisclaimerDialog } from '@/components/DisclaimerDialog';
import { LogoPreloader } from '@/components/LogoPreloader';
import { PixelSpinner } from '@/components/ui/PixelSpinner';
import PixelBlastBackground from '@/components/ui/PixelBlastBackground';
import { motion } from 'framer-motion';
import { ConnectButton } from '@/components/ConnectButton';
import { OpenPositionsTable } from '@/components/OpenPositionsTable';
import { OrderHistoryLog } from '@/components/OrderHistoryLog';
import Link from 'next/link';

export default function MyOrdersPage() {
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const orderIdFromUrl = searchParams.get('orderId') || '';

  // Parse filter query parameters
  const claimableParam = searchParams.get('claimable');
  const fillMinParam = searchParams.get('fillMin');
  const fillMaxParam = searchParams.get('fillMax');
  const posMinParam = searchParams.get('posMin');
  const posMaxParam = searchParams.get('posMax');
  const statusParam = searchParams.get('status') as 'active' | 'expired' | 'completed' | 'cancelled' | null;

  // Parse claimable filter
  const initialClaimable = claimableParam === 'true';

  // Parse fill range (default 0-100)
  const initialFillRange: [number, number] | undefined =
    (fillMinParam !== null || fillMaxParam !== null)
      ? [
          fillMinParam ? Math.max(0, Math.min(100, parseInt(fillMinParam, 10) || 0)) : 0,
          fillMaxParam ? Math.max(0, Math.min(100, parseInt(fillMaxParam, 10) || 100)) : 100
        ]
      : undefined;

  // Parse position range (default -100 to 100)
  const initialPositionRange: [number, number] | undefined =
    (posMinParam !== null || posMaxParam !== null)
      ? [
          posMinParam ? Math.max(-100, Math.min(100, parseInt(posMinParam, 10) || -100)) : -100,
          posMaxParam ? Math.max(-100, Math.min(100, parseInt(posMaxParam, 10) || 100)) : 100
        ]
      : undefined;

  const [showDisclaimer, setShowDisclaimer] = useState(false);
  const { isConnected, isConnecting } = useAccount();
  const [isInitializing, setIsInitializing] = useState(true);

  // Update URL when filters change
  const handleFiltersChange = useCallback((filters: {
    searchQuery: string;
    status: 'active' | 'expired' | 'completed' | 'cancelled' | 'order-history';
    dateFilter: '1h' | '12h' | '24h' | '7d' | '30d' | '90d' | '180d' | 'custom' | null;
    customDateStart: number | null;
    customDateEnd: number | null;
    aonFilter: boolean;
    dustFilter: string | null;
    claimableFilter: boolean;
    fillRange: [number, number];
    positionRange: [number, number];
  }) => {
    const params = new URLSearchParams();

    // Add order ID search query
    if (filters.searchQuery && /^\d+$/.test(filters.searchQuery.trim())) {
      params.set('orderId', filters.searchQuery.trim());
    }

    // Add status if not default (active)
    if (filters.status && filters.status !== 'active' && filters.status !== 'order-history') {
      params.set('status', filters.status);
    }

    // Add claimable filter
    if (filters.claimableFilter) {
      params.set('claimable', 'true');
    }

    // Add fill range if not default (0-100)
    if (filters.fillRange[0] > 0 || filters.fillRange[1] < 100) {
      if (filters.fillRange[0] > 0) params.set('fillMin', filters.fillRange[0].toString());
      if (filters.fillRange[1] < 100) params.set('fillMax', filters.fillRange[1].toString());
    }

    // Add position range if not default (-100 to 100)
    if (filters.positionRange[0] > -100 || filters.positionRange[1] < 100) {
      if (filters.positionRange[0] > -100) params.set('posMin', filters.positionRange[0].toString());
      if (filters.positionRange[1] < 100) params.set('posMax', filters.positionRange[1].toString());
    }

    // Update URL without navigation (just replace state)
    const newUrl = params.toString() ? `${pathname}?${params.toString()}` : pathname;
    window.history.replaceState(null, '', newUrl);
  }, [pathname]);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const accepted = localStorage.getItem('disclaimer-accepted');
      setShowDisclaimer(accepted !== 'true');
    }
  }, []);

  // Set initializing to false once connection status is determined
  useEffect(() => {
    if (!isConnecting) {
      const timer = setTimeout(() => {
        setIsInitializing(false);
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [isConnecting]);

  // Fallback: Force initialization complete after max timeout
  useEffect(() => {
    const maxTimeout = setTimeout(() => {
      setIsInitializing(false);
    }, 2000);
    return () => clearTimeout(maxTimeout);
  }, []);

  const [pageVisible, setPageVisible] = useState(false);

  useEffect(() => {
    if (!isInitializing && !isConnecting) {
      requestAnimationFrame(() => setPageVisible(true));
    }
  }, [isInitializing, isConnecting]);

  return (
    <>
      <DisclaimerDialog open={showDisclaimer} onAccept={() => setShowDisclaimer(false)} />
      <LogoPreloader />
      <main className="flex min-h-screen flex-col items-center relative">
        {/* Animated background effect */}
        <div className="fixed inset-0 z-0">
          <PixelBlastBackground />
        </div>

        {/* Main Content */}
        <div
          style={{ opacity: pageVisible ? 1 : 0, transition: 'opacity 0.6s ease-out' }}
          className="w-full px-2 md:px-8 mt-2 mb-0 relative z-10"
        >
          <div className="max-w-[1200px] mx-auto">
            {/* Loading State */}
            {(isInitializing || isConnecting) && (
              <div className="flex flex-col items-center justify-center py-20">
                <PixelSpinner size={48} className="mb-4" />
              </div>
            )}

            {/* Not Connected State */}
            {!isInitializing && !isConnecting && !isConnected && (
              <div className="flex flex-col items-center justify-center py-20 px-4">
                <h1 className="text-2xl md:text-4xl font-bold text-white mb-4 text-center">
                  Connect Your Wallet
                </h1>
                <p className="text-gray-400 text-center max-w-md mb-8">
                  Connect your wallet to view and manage your limit orders.
                </p>
                <ConnectButton />
              </div>
            )}

            {/* Connected State - Orders Table */}
            {!isInitializing && !isConnecting && isConnected && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.4 }}
              >
                <div className="flex flex-col gap-2">
                  {/* Header */}
                  <div className="flex items-center justify-between">
                    <h1 className="text-2xl md:text-3xl font-bold text-white">My Orders</h1>
                    <Link
                      href="/trade"
                      className="flex items-center gap-2 px-4 py-2 bg-white/10 hover:bg-white/20 border border-white/20 rounded-full text-white font-medium transition-colors"
                    >
                      <span className="text-lg">+</span>
                      Create New Order
                    </Link>
                  </div>

                  {/* Orders Table */}
                  <OpenPositionsTable
                    initialSearchQuery={orderIdFromUrl}
                    initialStatus={statusParam || undefined}
                    initialClaimableFilter={initialClaimable}
                    initialFillRange={initialFillRange}
                    initialPositionRange={initialPositionRange}
                    onFiltersChange={handleFiltersChange}
                  />

                  {/* Order History Log */}
                  <OrderHistoryLog />
                </div>
              </motion.div>
            )}
          </div>
        </div>
      </main>
    </>
  );
}
