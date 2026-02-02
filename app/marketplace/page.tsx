'use client';

import { useState, useEffect, Suspense, useCallback } from 'react';
import { useSearchParams, usePathname } from 'next/navigation';
import { DisclaimerDialog } from '@/components/DisclaimerDialog';
import { LogoPreloader } from '@/components/LogoPreloader';
import { OpenPositionsTable } from '@/components/OpenPositionsTable';
import PixelBlastBackground from '@/components/ui/PixelBlastBackground';

function MarketplaceContent() {
  const [showDisclaimer, setShowDisclaimer] = useState(false);
  const searchParams = useSearchParams();
  const pathname = usePathname();

  // Get search query from URL params (order-id, seller, or ticker)
  const initialSearchQuery = searchParams.get('order-id')
    || searchParams.get('seller')
    || searchParams.get('ticker')
    || '';

  // Get status filter from URL params
  const statusParam = searchParams.get('status');
  const validStatuses = ['active', 'expired', 'completed', 'cancelled'] as const;
  const initialStatus = statusParam && validStatuses.includes(statusParam as any)
    ? statusParam as 'active' | 'expired' | 'completed' | 'cancelled'
    : undefined;

  // Get date/timeperiod filter from URL params
  const timeperiodParam = searchParams.get('timeperiod');
  const validTimeperiods = ['1h', '12h', '24h', '7d', '30d', '90d', '180d', 'custom'] as const;
  const initialDateFilter = timeperiodParam && validTimeperiods.includes(timeperiodParam as any)
    ? timeperiodParam as '1h' | '12h' | '24h' | '7d' | '30d' | '90d' | '180d' | 'custom'
    : undefined;

  // Get custom date range from URL params (Unix timestamps)
  const dateStartParam = searchParams.get('date-start');
  const dateEndParam = searchParams.get('date-end');
  const initialCustomDateStart = dateStartParam && !isNaN(parseInt(dateStartParam))
    ? parseInt(dateStartParam)
    : undefined;
  const initialCustomDateEnd = dateEndParam && !isNaN(parseInt(dateEndParam))
    ? parseInt(dateEndParam)
    : undefined;

  // Get AON (All or Nothing) toggle from URL params
  const aonParam = searchParams.get('aon');
  const initialAonFilter = aonParam === 'true';

  // Get dust filter from URL params (min-usd=10 means hide orders under $10)
  const dustParam = searchParams.get('min-usd');
  const initialDustFilter = dustParam && !isNaN(parseFloat(dustParam)) ? dustParam : undefined;

  // Update URL when filters change
  const handleFiltersChange = useCallback((filters: {
    searchQuery: string;
    status: 'active' | 'expired' | 'completed' | 'cancelled' | 'order-history';
    dateFilter: '1h' | '12h' | '24h' | '7d' | '30d' | '90d' | '180d' | 'custom' | null;
    customDateStart: number | null;
    customDateEnd: number | null;
    aonFilter: boolean;
    dustFilter: string | null;
  }) => {
    const params = new URLSearchParams();

    // Add search query - detect type based on format
    if (filters.searchQuery) {
      const query = filters.searchQuery.trim();
      if (/^\d+$/.test(query)) {
        // Pure numbers = order ID
        params.set('order-id', query);
      } else if (query.startsWith('0x')) {
        // Starts with 0x = address (seller)
        params.set('seller', query);
      } else {
        // Otherwise = ticker
        params.set('ticker', query);
      }
    }

    // Add status if not default (active)
    if (filters.status && filters.status !== 'active' && filters.status !== 'order-history') {
      params.set('status', filters.status);
    }

    // Add timeperiod if set
    if (filters.dateFilter) {
      params.set('timeperiod', filters.dateFilter);

      // Add custom date range if using custom filter
      if (filters.dateFilter === 'custom') {
        if (filters.customDateStart) {
          params.set('date-start', filters.customDateStart.toString());
        }
        if (filters.customDateEnd) {
          params.set('date-end', filters.customDateEnd.toString());
        }
      }
    }

    // Add AON if enabled
    if (filters.aonFilter) {
      params.set('aon', 'true');
    }

    // Add dust filter if enabled
    if (filters.dustFilter) {
      params.set('min-usd', filters.dustFilter);
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
        <div className="w-full px-2 md:px-8 mt-2 relative z-10">
          <div className="max-w-[1200px] mx-auto">
            <OpenPositionsTable
              isMarketplaceMode={true}
              initialSearchQuery={initialSearchQuery}
              initialStatus={initialStatus}
              initialDateFilter={initialDateFilter}
              initialCustomDateStart={initialCustomDateStart}
              initialCustomDateEnd={initialCustomDateEnd}
              initialAonFilter={initialAonFilter}
              initialDustFilter={initialDustFilter}
              onFiltersChange={handleFiltersChange}
            />
          </div>
        </div>
      </main>
    </>
  );
}

export default function MarketplacePage() {
  return (
    <Suspense fallback={
      <main className="flex min-h-screen flex-col items-center relative overflow-hidden">
        <div className="fixed inset-0 z-0">
          <PixelBlastBackground />
        </div>
      </main>
    }>
      <MarketplaceContent />
    </Suspense>
  );
}
