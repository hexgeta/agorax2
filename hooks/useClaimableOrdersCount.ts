'use client';

import { useMemo } from 'react';
import { useAccount } from 'wagmi';
import { usePathname } from 'next/navigation';
import { useOpenPositions } from './contracts/useOpenPositions';

// Mock count for testing page - matches the mock orders with claimable proceeds
// Orders with claimable: #1001 (25%), #1004 (partial), #1005 (expired with partial),
// #1011 (40%), #1012 (80%), #1014 (20%), #1015 (5%) = 7 total
const MOCK_CLAIMABLE_COUNT = 7;

/**
 * Hook to count orders with claimable proceeds for the connected user
 * Returns the count of orders that have filled amounts not yet redeemed
 */
export function useClaimableOrdersCount() {
  const { address, isConnected } = useAccount();
  const { data, isLoading } = useOpenPositions(address);
  const pathname = usePathname();

  const claimableCount = useMemo(() => {
    // On testing page, return mock count for UI preview
    if (pathname === '/testing') {
      return MOCK_CLAIMABLE_COUNT;
    }

    if (!isConnected || !address || !data?.allOrders) return 0;

    return data.allOrders.filter(order => {
      // Only count active orders (status 0)
      if (order.orderDetailsWithID.status !== 0) return false;

      const proceeds = order.collectableProceeds;
      return proceeds && proceeds.buyTokens.length > 0;
    }).length;
  }, [isConnected, address, data?.allOrders, pathname]);

  return {
    claimableCount,
    isLoading: pathname === '/testing' ? false : isLoading
  };
}
