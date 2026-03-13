'use client';

import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
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
  dbTvl?: number; // TVL calculated from DB remaining_sell_amount (accurate, no contract read needed)
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

export default function StatsOverviewCards({ transactions, orders, tokenPrices, contractOrders = [], activeOrders = [], dbTvl }: StatsOverviewCardsProps) {
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

  // Calculate unique traders (both buyers and sellers from all sources)
  const uniqueTraders = useMemo(() => {
    const traders = new Set<string>();
    transactions.forEach(tx => {
      if (tx.buyer) traders.add(tx.buyer.toLowerCase());
    });
    // Include makers from contract orders
    if (contractOrders.length > 0) {
      contractOrders.forEach(order => {
        const owner = order.userDetails.orderOwner;
        if (owner) traders.add(owner.toLowerCase());
      });
    }
    // Also include makers from event-based orders (may have addresses not in contractOrders)
    orders.forEach(order => {
      if (order.orderOwner) traders.add(order.orderOwner.toLowerCase());
    });
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

  // Calculate Total Value Locked (TVL) - USD value of remaining sell amounts in active orders
  // Prefer dbTvl (from DB remaining_sell_amount) as it's available instantly and accurate
  const totalValueLocked = useMemo(() => {
    if (dbTvl !== undefined) return dbTvl;
    return activeOrders.reduce((sum, order) => {
      const sellTokenAddr = order.orderDetailsWithID.orderDetails.sellToken;
      const sellTokenInfo = getTokenInfo(sellTokenAddr);
      const sellAmount = Number(order.orderDetailsWithID.orderDetails.sellAmount) / Math.pow(10, sellTokenInfo.decimals);
      const price = getTokenPrice(sellTokenAddr, tokenPrices);
      return sum + (sellAmount * price);
    }, 0);
  }, [activeOrders, tokenPrices, dbTvl]);

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

  // Total filled volume
  const totalFilledVolume = totalTradingVolume;

  // Total fills count
  const totalFills = transactions.length;

  // Unique tokens traded
  const uniqueTokenCount = useMemo(() => {
    const tokens = new Set<string>();
    if (contractOrders.length > 0) {
      contractOrders.forEach(order => {
        tokens.add(order.orderDetailsWithID.orderDetails.sellToken.toLowerCase());
        order.orderDetailsWithID.orderDetails.buyTokensIndex.forEach(() => {
          // buy tokens tracked via whitelist indices - count sell tokens for now
        });
      });
    }
    transactions.forEach(tx => {
      if (tx.sellToken) tokens.add(tx.sellToken.toLowerCase());
      Object.keys(tx.buyTokens).forEach(addr => tokens.add(addr.toLowerCase()));
    });
    return tokens.size;
  }, [contractOrders, transactions]);

  // Largest single order (by USD value)
  const largestOrder = useMemo(() => {
    let max = 0;
    if (contractOrders.length > 0) {
      contractOrders.forEach(order => {
        const sellTokenAddr = order.orderDetailsWithID.orderDetails.sellToken;
        const sellTokenInfo = getTokenInfo(sellTokenAddr);
        const sellAmount = Number(order.orderDetailsWithID.orderDetails.sellAmount) / Math.pow(10, sellTokenInfo.decimals);
        const price = getTokenPrice(sellTokenAddr, tokenPrices);
        const usd = sellAmount * price;
        if (usd > max) max = usd;
      });
    }
    return max;
  }, [contractOrders, tokenPrices]);

  // Protocol age in days (used for daily avg calculation)
  const protocolAge = useMemo(() => {
    let earliest = Infinity;
    if (contractOrders.length > 0) {
      contractOrders.forEach(order => {
        const ts = Number(order.orderDetailsWithID.lastUpdateTime);
        if (ts > 0 && ts < earliest) earliest = ts;
      });
    }
    orders.forEach(o => {
      if (o.timestamp && o.timestamp < earliest) earliest = o.timestamp;
    });
    if (earliest === Infinity) return 0;
    return Math.floor((Date.now() / 1000 - earliest) / 86400);
  }, [contractOrders, orders]);

  // Cancel rate
  const cancelRate = useMemo(() => {
    if (effectiveOrderCount === 0) return 0;
    return (orderCounts.cancelled / effectiveOrderCount) * 100;
  }, [orderCounts.cancelled, effectiveOrderCount]);

  const [expanded, setExpanded] = useState(false);

  return (
    <div className="space-y-4">
      {/* Stats Cards - Rows 1 & 2 */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 lg:gap-4">
        <StatCard
          label="Total Value Locked"
          value={formatUSD(totalValueLocked)}
          subValue="In active orders"
        />
        <StatCard
          label="Total Listed Volume"
          value={formatUSD(totalListedVolume)}
          subValue="All orders all time"
        />
        <StatCard
          label="Total Filled Volume"
          value={formatUSD(totalFilledVolume)}
          subValue={`${totalFills.toLocaleString()} fills`}
        />
        <StatCard
          label="Unique Traders"
          value={uniqueTraders.toLocaleString()}
          subValue="Buyers & sellers"
        />
        <StatCard
          label="Unique Tokens"
          value={uniqueTokenCount.toLocaleString()}
          subValue="Traded on protocol"
        />
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
          label="Completed Orders"
          value={orderCounts.filled.toLocaleString()}
          subValue="Fully filled"
          dotColor="blue"
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
      </div>

      {/* See More Toggle */}
      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
            className="overflow-hidden space-y-4"
          >
            {/* Stats Cards - Rows 3 & 4 */}
            <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 lg:gap-4">
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
                label="Avg Orders/Trader"
                value={avgOrdersPerAddress.toFixed(1)}
                subValue="Orders per address"
              />
              <StatCard
                label="Avg Volume/Trader"
                value={formatUSD(uniqueTraders > 0 ? totalListedVolume / uniqueTraders : 0)}
                subValue="Listed per address"
              />
              <StatCard
                label="Avg Fills/Trader"
                value={uniqueTraders > 0 ? (totalFills / uniqueTraders).toFixed(1) : '0'}
                subValue="Fills per address"
              />
              <StatCard
                label="Largest Order"
                value={formatUSD(largestOrder)}
                subValue="Single order"
              />
              <StatCard
                label="Cancel Rate"
                value={`${cancelRate.toFixed(1)}%`}
                subValue="Orders cancelled"
              />
              <StatCard
                label="Daily Avg Volume"
                value={formatUSD(protocolAge > 0 ? totalFilledVolume / protocolAge : 0)}
                subValue="Filled per day"
              />
              <StatCard
                label="Maker/Taker Ratio"
                value={transactions.length > 0 && effectiveOrderCount > 0
                  ? `${(effectiveOrderCount / transactions.length).toFixed(1)}x`
                  : '-'}
                subValue="Orders to fills"
              />
              <StatCard
                label="Active TVL Share"
                value={totalListedVolume > 0 ? `${((totalValueLocked / totalListedVolume) * 100).toFixed(1)}%` : '0%'}
                subValue="Active vs total listed"
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* See More / See Less Button */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-center gap-2 py-2.5 text-gray-400 hover:text-white transition-colors text-sm font-medium"
      >
        <span>{expanded ? 'See less' : 'See more'}</span>
        <motion.svg
          animate={{ rotate: expanded ? 180 : 0 }}
          transition={{ duration: 0.3 }}
          className="w-4 h-4"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </motion.svg>
      </button>
    </div>
  );
}
