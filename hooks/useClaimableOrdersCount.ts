'use client';

import { useMemo } from 'react';
import { useAccount } from 'wagmi';
import { useOpenPositions } from './contracts/useOpenPositions';

/**
 * Hook to count orders with claimable proceeds for the connected user
 * Returns the count of orders that have filled amounts not yet redeemed
 */
export function useClaimableOrdersCount() {
  const { address, isConnected } = useAccount();
  const { data, isLoading } = useOpenPositions(address);

  const claimableCount = useMemo(() => {
    if (!isConnected || !address || !data?.allOrders) return 0;

    return data.allOrders.filter(order => {
      // Only count active orders (status 0)
      if (order.orderDetailsWithID.status !== 0) return false;

      const sellAmount = order.orderDetailsWithID.orderDetails.sellAmount;
      const filled = sellAmount - order.orderDetailsWithID.remainingSellAmount;
      const hasProceeds = filled > order.orderDetailsWithID.redeemedSellAmount;

      return hasProceeds;
    }).length;
  }, [isConnected, address, data?.allOrders]);

  return {
    claimableCount,
    isLoading
  };
}
