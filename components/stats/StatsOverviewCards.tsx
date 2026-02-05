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
  dotColor?: 'green' | 'yellow' | 'red' | 'blue';
}

function StatCard({ label, value, subValue, dotColor }: StatCardProps) {
  const dotColorClasses: Record<string, string> = {
    green: 'bg-green-500',
    yellow: 'bg-yellow-500',
    red: 'bg-red-500',
    blue: 'bg-blue-500',
  };
  const dotColorClass = dotColor ? dotColorClasses[dotColor] : '';

  return (
    <LiquidGlassCard
      className="p-5 bg-black/40 flex flex-col justify-between min-h-[120px]"
      shadowIntensity="none"
      glowIntensity="none"
    >
      <div className="flex items-center gap-2">
        {dotColor && <div className={`w-2.5 h-2.5 rounded-full ${dotColorClass}`} />}
        <p className="text-gray-400 text-sm font-medium">{label}</p>
      </div>
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

  // Calculate order counts by status (0 = Active/Expired, 1 = Cancelled, 2 = Filled)
  const orderCounts = useMemo(() => {
    if (contractOrders.length === 0) {
      return { total: 0, active: 0, expired: 0, cancelled: 0, filled: 0 };
    }
    const currentTime = Math.floor(Date.now() / 1000);

    // Active: status 0 and not expired
    const active = contractOrders.filter(o => {
      if (o.orderDetailsWithID.status !== 0) return false;
      const expirationTime = Number(o.orderDetailsWithID.orderDetails.expirationTime);
      // 0 means no expiration
      if (expirationTime === 0) return true;
      return expirationTime >= currentTime;
    }).length;

    // Expired: status 0 but past expiration time
    const expired = contractOrders.filter(o => {
      if (o.orderDetailsWithID.status !== 0) return false;
      const expirationTime = Number(o.orderDetailsWithID.orderDetails.expirationTime);
      return expirationTime > 0 && expirationTime < currentTime;
    }).length;

    const cancelled = contractOrders.filter(o => o.orderDetailsWithID.status === 1).length;
    const filled = contractOrders.filter(o => o.orderDetailsWithID.status === 2).length;

    return {
      total: contractOrders.length,
      active,
      expired,
      cancelled,
      filled
    };
  }, [contractOrders]);

  // Calculate average orders per address
  const avgOrdersPerAddress = useMemo(() => {
    if (uniqueTraders === 0) return 0;
    return effectiveOrderCount / uniqueTraders;
  }, [effectiveOrderCount, uniqueTraders]);

  return (
    <div className="space-y-4">
      {/* Stats Cards - Row 1 */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <StatCard
          label="Total Value Locked"
          value={formatUSD(totalValueLocked)}
          subValue="In active orders"
        />
        <StatCard
          label="Unique Traders"
          value={uniqueTraders.toLocaleString()}
          subValue="Buyers & Sellers"
        />
        <StatCard
          label="Avg Placement Size"
          value={formatUSD(avgOrderSize)}
          subValue="Per order created"
        />
        <StatCard
          label="Avg Fill Size"
          value={formatUSD(avgTradeSize)}
          subValue="Per fill"
        />
        <StatCard
          label="$ Fill %"
          value={`${fillRate.toFixed(1)}%`}
          subValue="% of $ filled vs listed"
        />
        <StatCard
          label="Order Fill %"
          value={`${completionRate.toFixed(1)}%`}
          subValue="% of orders filled vs listed"
        />
      </div>

      {/* Order Status Cards - Row 2 */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <StatCard
          label="Total Orders"
          value={orderCounts.total.toLocaleString()}
          subValue="All time"
        />
        <StatCard
          label="Active Orders"
          value={orderCounts.active.toLocaleString()}
          subValue="Currently open"
          dotColor="green"
        />
        <StatCard
          label="Expired Orders"
          value={orderCounts.expired.toLocaleString()}
          subValue="Past expiration"
          dotColor="yellow"
        />
        <StatCard
          label="Cancelled Orders"
          value={orderCounts.cancelled.toLocaleString()}
          subValue="By owner"
          dotColor="red"
        />
        <StatCard
          label="Completed Orders"
          value={orderCounts.filled.toLocaleString()}
          subValue="Fully filled"
          dotColor="blue"
        />
        <StatCard
          label="Avg Orders/Address"
          value={avgOrdersPerAddress.toFixed(1)}
          subValue="Orders per trader"
        />
      </div>
    </div>
  );
}
