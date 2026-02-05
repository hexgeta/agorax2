'use client';

import { useMemo } from 'react';
import { LiquidGlassCard } from '@/components/ui/liquid-glass';
import { formatUSD, getTokenPrice } from '@/utils/format';
import { getTokenInfo, formatTokenAmount } from '@/utils/tokenUtils';
import { CompleteOrderDetails } from '@/hooks/contracts/useOpenPositions';

interface Transaction {
  transactionHash: string;
  orderId: string;
  sellToken: string;
  sellAmount: number;
  buyTokens: Record<string, number>;
  blockNumber: bigint;
  timestamp?: number;
  buyer?: string;
}

interface OrderPlaced {
  transactionHash: string;
  orderId: string;
  sellToken: string;
  sellAmount: number;
  blockNumber: bigint;
  timestamp?: number;
  orderOwner: string;
}

interface StatsOverviewCardsProps {
  transactions: Transaction[];
  orders: OrderPlaced[];
  tokenPrices: Record<string, { price: number }>;
  contractOrders?: CompleteOrderDetails[]; // Orders from contract (more reliable)
  activeOrders?: CompleteOrderDetails[]; // Currently active unfilled orders
}

interface StatCardProps {
  label: string;
  value: string;
  subValue?: string;
  trend?: 'up' | 'down' | 'neutral';
}

function StatCard({ label, value, subValue }: StatCardProps) {
  return (
    <LiquidGlassCard
      className="p-5 bg-black/40 flex flex-col justify-between min-h-[120px]"
      shadowIntensity="none"
      glowIntensity="none"
    >
      <p className="text-gray-400 text-sm font-medium">{label}</p>
      <div>
        <p className="text-white text-2xl md:text-3xl font-bold">{value}</p>
        {subValue && (
          <p className="text-gray-500 text-xs mt-1">{subValue}</p>
        )}
      </div>
    </LiquidGlassCard>
  );
}

export default function StatsOverviewCards({ transactions, orders, tokenPrices, contractOrders = [], activeOrders = [] }: StatsOverviewCardsProps) {
  // Use contract orders if event orders are empty (more reliable source)
  const effectiveOrderCount = contractOrders.length > 0 ? contractOrders.length : orders.length;

  // Calculate total trading volume (filled orders) from transactions
  // Use same calculation as VolumeChart: max of sell or buy volume
  const totalTradingVolume = useMemo(() => {
    return transactions.reduce((sum, tx) => {
      const sellPrice = getTokenPrice(tx.sellToken, tokenPrices);
      const sellVolumeUSD = tx.sellAmount * sellPrice;

      // Calculate buy volume (use max of all buy tokens)
      const buyVolumesUSD = Object.entries(tx.buyTokens).map(([addr, amount]) => {
        const price = getTokenPrice(addr, tokenPrices);
        return amount * price;
      });
      const buyVolumeUSD = buyVolumesUSD.length > 0 ? Math.max(...buyVolumesUSD) : 0;

      // Use the higher of sell or buy volume (matches VolumeChart)
      return sum + Math.max(sellVolumeUSD, buyVolumeUSD);
    }, 0);
  }, [transactions, tokenPrices]);

  // Calculate total listed volume - prefer contract orders if available
  const totalListedVolume = useMemo(() => {
    if (contractOrders.length > 0) {
      return contractOrders.reduce((sum, order) => {
        const sellTokenAddr = order.orderDetailsWithID.orderDetails.sellToken;
        const sellTokenInfo = getTokenInfo(sellTokenAddr);
        const sellAmount = Number(order.orderDetailsWithID.orderDetails.sellAmount) / Math.pow(10, sellTokenInfo.decimals);
        const price = getTokenPrice(sellTokenAddr, tokenPrices);
        return sum + (sellAmount * price);
      }, 0);
    }
    return orders.reduce((sum, order) => {
      const price = getTokenPrice(order.sellToken, tokenPrices);
      return sum + (order.sellAmount * price);
    }, 0);
  }, [orders, contractOrders, tokenPrices]);

  // Calculate unique traders (both buyers and sellers)
  const uniqueTraders = useMemo(() => {
    const traders = new Set<string>();
    transactions.forEach(tx => {
      if (tx.buyer) traders.add(tx.buyer.toLowerCase());
    });
    // Use contract orders if available
    if (contractOrders.length > 0) {
      contractOrders.forEach(order => {
        const owner = order.userDetails.orderOwner;
        if (owner) traders.add(owner.toLowerCase());
      });
    } else {
      orders.forEach(order => {
        if (order.orderOwner) traders.add(order.orderOwner.toLowerCase());
      });
    }
    return traders.size;
  }, [transactions, orders, contractOrders]);

  // Calculate completion rate
  const completionRate = useMemo(() => {
    if (effectiveOrderCount === 0) return 0;
    // Count completed orders from contract data
    if (contractOrders.length > 0) {
      const completedCount = contractOrders.filter(o => o.orderDetailsWithID.status === 2).length;
      return (completedCount / effectiveOrderCount) * 100;
    }
    // Fallback to event-based calculation
    const filledOrderIds = new Set(transactions.map(tx => tx.orderId));
    return (filledOrderIds.size / effectiveOrderCount) * 100;
  }, [transactions, contractOrders, effectiveOrderCount]);

  // Calculate average order size
  const avgOrderSize = useMemo(() => {
    if (effectiveOrderCount === 0) return 0;
    return totalListedVolume / effectiveOrderCount;
  }, [totalListedVolume, effectiveOrderCount]);

  // Calculate average trade size
  const avgTradeSize = useMemo(() => {
    if (transactions.length === 0) return 0;
    return totalTradingVolume / transactions.length;
  }, [totalTradingVolume, transactions.length]);

  // Calculate fill rate (volume traded vs volume listed)
  const fillRate = useMemo(() => {
    if (totalListedVolume === 0) return 0;
    return (totalTradingVolume / totalListedVolume) * 100;
  }, [totalTradingVolume, totalListedVolume]);

  // Calculate Total Value Locked (TVL) - USD value of active unfilled orders
  const totalValueLocked = useMemo(() => {
    return activeOrders.reduce((sum, order) => {
      const sellTokenAddr = order.orderDetailsWithID.orderDetails.sellToken;
      const sellTokenInfo = getTokenInfo(sellTokenAddr);
      const sellAmount = Number(order.orderDetailsWithID.orderDetails.sellAmount) / Math.pow(10, sellTokenInfo.decimals);
      const price = getTokenPrice(sellTokenAddr, tokenPrices);
      return sum + (sellAmount * price);
    }, 0);
  }, [activeOrders, tokenPrices]);

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      <StatCard
        label="Total Volume Traded"
        value={formatUSD(totalTradingVolume)}
        subValue={`${transactions.length} fills`}
      />
      <StatCard
        label="Total Volume Listed"
        value={formatUSD(totalListedVolume)}
        subValue={`${effectiveOrderCount} orders`}
      />
      <StatCard
        label="Unique Traders"
        value={uniqueTraders.toLocaleString()}
        subValue="Buyers & Sellers"
      />
      <StatCard
        label="Fill Rate"
        value={`${fillRate.toFixed(1)}%`}
        subValue="Volume traded vs listed"
      />
      <StatCard
        label="Avg Order Size"
        value={formatUSD(avgOrderSize)}
        subValue="Per order created"
      />
      <StatCard
        label="Avg Trade Size"
        value={formatUSD(avgTradeSize)}
        subValue="Per fill"
      />
      <StatCard
        label="Completion Rate"
        value={`${completionRate.toFixed(1)}%`}
        subValue="Orders with fills"
      />
      <StatCard
        label="Total Value Locked"
        value={formatUSD(totalValueLocked)}
        subValue={`${activeOrders.length} active orders`}
      />
    </div>
  );
}
