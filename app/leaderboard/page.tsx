'use client';

import { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import { useAccount } from 'wagmi';
import { LiquidGlassCard } from '@/components/ui/liquid-glass';
import PixelBlastBackground from '@/components/ui/PixelBlastBackground';
import { useOpenPositions, CompleteOrderDetails } from '@/hooks/contracts/useOpenPositions';
import { getTokenInfo, getTokenInfoByIndex, formatTokenAmount } from '@/utils/tokenUtils';
import { PixelSpinner } from '@/components/ui/PixelSpinner';

// Prestige levels for display
const PRESTIGE_LEVELS = [
  { symbol: 'α', name: 'Alpha', color: 'text-rose-400', bgColor: 'bg-rose-500/20' },
  { symbol: 'β', name: 'Beta', color: 'text-orange-400', bgColor: 'bg-orange-500/20' },
  { symbol: 'γ', name: 'Gamma', color: 'text-lime-400', bgColor: 'bg-lime-500/20' },
  { symbol: 'δ', name: 'Delta', color: 'text-emerald-400', bgColor: 'bg-emerald-500/20' },
  { symbol: 'ε', name: 'Epsilon', color: 'text-cyan-400', bgColor: 'bg-cyan-500/20' },
  { symbol: 'ζ', name: 'Zeta', color: 'text-blue-400', bgColor: 'bg-blue-500/20' },
  { symbol: 'η', name: 'Eta', color: 'text-violet-400', bgColor: 'bg-violet-500/20' },
  { symbol: 'θ', name: 'Theta', color: 'text-fuchsia-400', bgColor: 'bg-fuchsia-500/20' },
  { symbol: 'Ω', name: 'Omega', color: 'text-yellow-400', bgColor: 'bg-yellow-500/20' },
];

// Interface for aggregated user stats
interface UserStats {
  address: string;
  totalOrders: number;
  activeOrders: number;
  completedOrders: number;
  cancelledOrders: number;
}

// Interface for formatted order data
interface FormattedOrder {
  id: number;
  maker: string;
  sellToken: string;
  buyToken: string;
  sellAmount: string;
  buyAmount: string;
  status: 'active' | 'completed' | 'cancelled';
  filled: number;
  createdAt: string;
}

function getRankDisplay(rank: number) {
  if (rank === 1) return { text: '1st', color: 'text-yellow-400' };
  if (rank === 2) return { text: '2nd', color: 'text-gray-300' };
  if (rank === 3) return { text: '3rd', color: 'text-amber-600' };
  return { text: `${rank}th`, color: 'text-gray-400' };
}

function formatDisplayAmount(amount: string): string {
  const num = parseFloat(amount);
  if (isNaN(num)) return amount;
  if (num >= 1000000000) {
    return `${(num / 1000000000).toFixed(2)}B`;
  } else if (num >= 1000000) {
    return `${(num / 1000000).toFixed(2)}M`;
  } else if (num >= 1000) {
    return `${(num / 1000).toFixed(1)}K`;
  }
  return num.toLocaleString(undefined, { maximumFractionDigits: 2 });
}

function getStatusColor(status: string) {
  switch (status) {
    case 'active': return 'text-green-400 bg-green-500/20';
    case 'completed': return 'text-blue-400 bg-blue-500/20';
    case 'cancelled': return 'text-red-400 bg-red-500/20';
    default: return 'text-gray-400 bg-gray-500/20';
  }
}

function formatAddress(address: string): string {
  if (address.length > 10) {
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  }
  return address;
}

function formatTimestamp(timestamp: number | bigint): string {
  if (!timestamp) return '-';
  const ts = typeof timestamp === 'bigint' ? Number(timestamp) : timestamp;
  const date = new Date(ts * 1000);
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export default function LeaderboardPage() {
  const [orderFilter, setOrderFilter] = useState<'all' | 'active' | 'completed' | 'cancelled'>('all');
  const { address: connectedAddress } = useAccount();

  // Fetch all orders from the contract (fetchAllOrders = true)
  const { allOrders, isLoading } = useOpenPositions(undefined, true);

  // Process orders into formatted order list and aggregate user stats
  const { formattedOrders, userStats } = useMemo(() => {
    const formatted: FormattedOrder[] = [];
    const statsMap = new Map<string, UserStats>();

    allOrders.forEach((order: CompleteOrderDetails) => {
      const maker = order.userDetails.orderOwner;
      const orderDetails = order.orderDetailsWithID;
      const sellTokenInfo = getTokenInfo(orderDetails.orderDetails.sellToken);

      // Get buy token info - use first buy token if available
      let buyTokenTicker = 'UNKNOWN';
      if (orderDetails.orderDetails.buyTokensIndex.length > 0) {
        const buyTokenInfo = getTokenInfoByIndex(Number(orderDetails.orderDetails.buyTokensIndex[0]));
        buyTokenTicker = buyTokenInfo.ticker;
      }

      // Calculate filled percentage
      const originalSellAmount = orderDetails.remainingSellAmount + orderDetails.redeemedSellAmount;
      const filledPercent = originalSellAmount > 0n
        ? Number((orderDetails.redeemedSellAmount * 100n) / originalSellAmount)
        : 0;

      // Map status: 0 = Active, 1 = Cancelled, 2 = Completed
      let status: 'active' | 'completed' | 'cancelled' = 'active';
      if (orderDetails.status === 1) status = 'cancelled';
      if (orderDetails.status === 2) status = 'completed';

      // Format sell amount
      const sellAmount = formatTokenAmount(
        orderDetails.remainingSellAmount + orderDetails.redeemedSellAmount,
        sellTokenInfo.decimals
      );

      // Format buy amount (first buy token)
      let buyAmount = '0';
      if (orderDetails.orderDetails.buyAmounts.length > 0 && orderDetails.orderDetails.buyTokensIndex.length > 0) {
        const buyTokenInfo = getTokenInfoByIndex(Number(orderDetails.orderDetails.buyTokensIndex[0]));
        buyAmount = formatTokenAmount(orderDetails.orderDetails.buyAmounts[0], buyTokenInfo.decimals);
      }

      formatted.push({
        id: Number(orderDetails.orderID),
        maker,
        sellToken: sellTokenInfo.ticker,
        buyToken: buyTokenTicker,
        sellAmount,
        buyAmount,
        status,
        filled: filledPercent,
        createdAt: formatTimestamp(orderDetails.lastUpdateTime),
      });

      // Aggregate user stats
      const makerLower = maker.toLowerCase();
      if (!statsMap.has(makerLower)) {
        statsMap.set(makerLower, {
          address: maker,
          totalOrders: 0,
          activeOrders: 0,
          completedOrders: 0,
          cancelledOrders: 0,
        });
      }
      const stats = statsMap.get(makerLower)!;
      stats.totalOrders++;
      if (orderDetails.status === 0) stats.activeOrders++;
      if (orderDetails.status === 1) stats.cancelledOrders++;
      if (orderDetails.status === 2) stats.completedOrders++;
    });

    return {
      formattedOrders: formatted.sort((a, b) => b.id - a.id), // Sort by order ID descending (newest first)
      userStats: Array.from(statsMap.values()).sort((a, b) => b.totalOrders - a.totalOrders),
    };
  }, [allOrders]);

  // Filter orders based on selected filter
  const filteredOrders = useMemo(() => {
    if (orderFilter === 'all') return formattedOrders;
    return formattedOrders.filter(order => order.status === orderFilter);
  }, [formattedOrders, orderFilter]);

  // Add rank to user stats
  const rankedUsers = userStats.map((user, idx) => ({
    ...user,
    rank: idx + 1,
    prestigeLevel: Math.min(Math.floor(user.completedOrders / 10), 8), // Simple prestige calculation based on completed orders
  }));

  return (
    <main className="min-h-screen bg-black text-white relative overflow-hidden">
      {/* Animated background */}
      <div className="fixed inset-0 z-0">
        <PixelBlastBackground />
      </div>

      {/* Main Content */}
      <div className="w-full px-4 md:px-8 mt-20 mb-12 relative z-10">
        <div className="max-w-[1200px] mx-auto">
          {/* Leaderboard Table */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
          >
            <LiquidGlassCard
              shadowIntensity="sm"
              glowIntensity="sm"
              blurIntensity="xl"
              className="p-4 md:p-6"
            >
              {isLoading ? (
                <div className="flex items-center justify-center py-12">
                  <PixelSpinner size={32} />
                  <span className="ml-3 text-gray-400">Loading leaderboard...</span>
                </div>
              ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-white/10">
                      <th className="text-left py-3 px-2 text-gray-400 font-medium text-sm">Rank</th>
                      <th className="text-left py-3 px-2 text-gray-400 font-medium text-sm">Trader</th>
                      <th className="text-center py-3 px-2 text-gray-400 font-medium text-sm">Level</th>
                      <th className="text-right py-3 px-2 text-gray-400 font-medium text-sm hidden sm:table-cell">Completed</th>
                      <th className="text-right py-3 px-2 text-gray-400 font-medium text-sm hidden md:table-cell">Total Orders</th>
                      <th className="text-right py-3 px-2 text-gray-400 font-medium text-sm hidden lg:table-cell">Active Orders</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rankedUsers.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="py-8 text-center text-gray-500">
                          No traders found yet.
                        </td>
                      </tr>
                    ) : (
                      rankedUsers.map((user) => {
                        const isCurrentUser = connectedAddress?.toLowerCase() === user.address.toLowerCase();
                        const prestige = PRESTIGE_LEVELS[user.prestigeLevel];
                        const rankDisplay = getRankDisplay(user.rank);

                        return (
                          <tr
                            key={user.address}
                            className={`border-b border-white/5 transition-colors ${
                              isCurrentUser ? 'bg-white/5' : 'hover:bg-white/5'
                            }`}
                          >
                            <td className="py-4 px-2">
                              <span className={`font-bold ${rankDisplay.color}`}>
                                {rankDisplay.text}
                              </span>
                            </td>
                            <td className="py-4 px-2">
                              <div className="flex items-center gap-2">
                                <span className={`font-mono ${isCurrentUser ? 'text-white' : 'text-gray-300'}`}>
                                  {formatAddress(user.address)}
                                </span>
                                {isCurrentUser && (
                                  <span className="text-xs bg-white/10 px-2 py-0.5 rounded text-gray-300">You</span>
                                )}
                              </div>
                            </td>
                            <td className="py-4 px-2">
                              <div className="flex justify-center">
                                <div
                                  className={`w-8 h-8 rounded-full flex items-center justify-center ${prestige.bgColor}`}
                                  title={prestige.name}
                                >
                                  <span className={`text-sm font-bold ${prestige.color}`}>
                                    {prestige.symbol}
                                  </span>
                                </div>
                              </div>
                            </td>
                            <td className="py-4 px-2 text-right hidden sm:table-cell">
                              <span className="text-gray-400">
                                {user.completedOrders}
                              </span>
                            </td>
                            <td className="py-4 px-2 text-right hidden md:table-cell">
                              <span className="text-gray-400">
                                {user.totalOrders}
                              </span>
                            </td>
                            <td className="py-4 px-2 text-right hidden lg:table-cell">
                              <span className="text-gray-400">{user.activeOrders}</span>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
              )}
            </LiquidGlassCard>
          </motion.div>

          {/* All Orders Section */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.3 }}
            className="mt-12"
          >
            <h2 className="text-2xl font-bold text-white mb-4">All Orders</h2>

            {/* Order Filters */}
            <div className="flex flex-wrap gap-2 mb-4">
              {(['all', 'active', 'completed', 'cancelled'] as const).map((filter) => (
                <button
                  key={filter}
                  onClick={() => setOrderFilter(filter)}
                  className={`px-4 py-2 rounded-lg font-medium transition-all capitalize ${
                    orderFilter === filter
                      ? 'bg-white/10 text-white border border-white/20'
                      : 'bg-white/5 text-gray-400 border border-transparent hover:bg-white/10 hover:text-white'
                  }`}
                >
                  {filter}
                </button>
              ))}
            </div>

            <LiquidGlassCard
              shadowIntensity="sm"
              glowIntensity="sm"
              blurIntensity="xl"
              className="p-4 md:p-6"
            >
              {isLoading ? (
                <div className="flex items-center justify-center py-12">
                  <PixelSpinner size={32} />
                  <span className="ml-3 text-gray-400">Loading orders...</span>
                </div>
              ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-white/10">
                      <th className="text-left py-3 px-2 text-gray-400 font-medium text-sm">ID</th>
                      <th className="text-left py-3 px-2 text-gray-400 font-medium text-sm">Maker</th>
                      <th className="text-left py-3 px-2 text-gray-400 font-medium text-sm">Pair</th>
                      <th className="text-right py-3 px-2 text-gray-400 font-medium text-sm">Sell Amount</th>
                      <th className="text-right py-3 px-2 text-gray-400 font-medium text-sm hidden sm:table-cell">Buy Amount</th>
                      <th className="text-center py-3 px-2 text-gray-400 font-medium text-sm hidden md:table-cell">Filled</th>
                      <th className="text-center py-3 px-2 text-gray-400 font-medium text-sm">Status</th>
                      <th className="text-right py-3 px-2 text-gray-400 font-medium text-sm hidden lg:table-cell">Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredOrders.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="py-8 text-center text-gray-500">
                          No orders found with this filter.
                        </td>
                      </tr>
                    ) : (
                      filteredOrders.map((order) => {
                        const isCurrentUser = connectedAddress?.toLowerCase() === order.maker.toLowerCase();
                        const statusColors = getStatusColor(order.status);

                        return (
                          <tr
                            key={order.id}
                            className={`border-b border-white/5 transition-colors ${
                              isCurrentUser ? 'bg-white/5' : 'hover:bg-white/5'
                            }`}
                          >
                            <td className="py-4 px-2">
                              <span className="text-gray-500 text-sm">#{order.id}</span>
                            </td>
                            <td className="py-4 px-2">
                              <div className="flex items-center gap-2">
                                <span className={`font-mono text-sm ${isCurrentUser ? 'text-white' : 'text-gray-300'}`}>
                                  {formatAddress(order.maker)}
                                </span>
                                {isCurrentUser && (
                                  <span className="text-xs bg-white/10 px-2 py-0.5 rounded text-gray-300">You</span>
                                )}
                              </div>
                            </td>
                            <td className="py-4 px-2">
                              <span className="text-white text-sm">
                                {order.sellToken}/{order.buyToken}
                              </span>
                            </td>
                            <td className="py-4 px-2 text-right">
                              <span className="text-gray-300 text-sm">
                                {formatDisplayAmount(order.sellAmount)} {order.sellToken}
                              </span>
                            </td>
                            <td className="py-4 px-2 text-right hidden sm:table-cell">
                              <span className="text-gray-300 text-sm">
                                {formatDisplayAmount(order.buyAmount)} {order.buyToken}
                              </span>
                            </td>
                            <td className="py-4 px-2 text-center hidden md:table-cell">
                              <span className="text-gray-400 text-sm">{order.filled}%</span>
                            </td>
                            <td className="py-4 px-2 text-center">
                              <span className={`text-xs px-2 py-1 rounded capitalize ${statusColors}`}>
                                {order.status}
                              </span>
                            </td>
                            <td className="py-4 px-2 text-right hidden lg:table-cell">
                              <span className="text-gray-500 text-sm">{order.createdAt}</span>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
              )}
            </LiquidGlassCard>
          </motion.div>

          {/* Footer Note */}
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.5, delay: 0.4 }}
            className="text-center text-gray-500 text-sm mt-8"
          >
            Leaderboard and orders update in real-time based on on-chain activity.
          </motion.p>
        </div>
      </div>
    </main>
  );
}
