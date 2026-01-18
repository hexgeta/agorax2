'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { LiquidGlassCard } from '@/components/ui/liquid-glass';
import PixelBlastBackground from '@/components/ui/PixelBlastBackground';

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

// Mock leaderboard data
const MOCK_LEADERBOARD = [
  { rank: 1, address: '0x1234...5678', prestigeLevel: 7, totalVolume: 2450000, historicalOrders: 342, activeOrders: 12, completedTrades: 298 },
  { rank: 2, address: '0x8765...4321', prestigeLevel: 6, totalVolume: 1890000, historicalOrders: 256, activeOrders: 8, completedTrades: 221 },
  { rank: 3, address: '0xABCD...EFGH', prestigeLevel: 6, totalVolume: 1650000, historicalOrders: 198, activeOrders: 15, completedTrades: 176 },
  { rank: 4, address: '0x5b87...0f1c', prestigeLevel: 0, totalVolume: 1420000, historicalOrders: 167, activeOrders: 5, completedTrades: 154 }, // Current user
  { rank: 5, address: '0x9999...1111', prestigeLevel: 5, totalVolume: 1180000, historicalOrders: 145, activeOrders: 3, completedTrades: 132 },
  { rank: 6, address: '0x2222...3333', prestigeLevel: 4, totalVolume: 980000, historicalOrders: 123, activeOrders: 7, completedTrades: 108 },
  { rank: 7, address: '0x4444...5555', prestigeLevel: 4, totalVolume: 756000, historicalOrders: 98, activeOrders: 2, completedTrades: 89 },
  { rank: 8, address: '0x6666...7777', prestigeLevel: 3, totalVolume: 543000, historicalOrders: 76, activeOrders: 4, completedTrades: 68 },
  { rank: 9, address: '0x8888...9999', prestigeLevel: 3, totalVolume: 421000, historicalOrders: 54, activeOrders: 1, completedTrades: 49 },
  { rank: 10, address: '0xAAAA...BBBB', prestigeLevel: 2, totalVolume: 298000, historicalOrders: 42, activeOrders: 6, completedTrades: 35 },
  { rank: 11, address: '0xCCCC...DDDD', prestigeLevel: 2, totalVolume: 187000, historicalOrders: 31, activeOrders: 2, completedTrades: 27 },
  { rank: 12, address: '0xEEEE...FFFF', prestigeLevel: 1, totalVolume: 125000, historicalOrders: 23, activeOrders: 3, completedTrades: 19 },
  { rank: 13, address: '0x1111...2222', prestigeLevel: 1, totalVolume: 89000, historicalOrders: 18, activeOrders: 1, completedTrades: 15 },
  { rank: 14, address: '0x3333...4444', prestigeLevel: 0, totalVolume: 54000, historicalOrders: 12, activeOrders: 2, completedTrades: 9 },
  { rank: 15, address: '0x5555...6666', prestigeLevel: 0, totalVolume: 32000, historicalOrders: 8, activeOrders: 1, completedTrades: 6 },
];

// Current user address (mock)
const CURRENT_USER = '0x5b87...0f1c';

// Mock all orders data
const MOCK_ALL_ORDERS = [
  { id: 1, maker: '0x1234...5678', type: 'sell', sellToken: 'HEX', buyToken: 'PLS', sellAmount: 500000, buyAmount: 85000000, pricePerToken: 170, status: 'active', filled: 0, createdAt: '2024-01-15 14:32' },
  { id: 2, maker: '0x8765...4321', type: 'buy', sellToken: 'PLS', buyToken: 'HEX', sellAmount: 50000000, buyAmount: 300000, pricePerToken: 166.67, status: 'active', filled: 45, createdAt: '2024-01-15 12:18' },
  { id: 3, maker: '0x5b87...0f1c', type: 'sell', sellToken: 'PLSX', buyToken: 'PLS', sellAmount: 1000000, buyAmount: 2500000, pricePerToken: 2.5, status: 'active', filled: 0, createdAt: '2024-01-15 10:45' },
  { id: 4, maker: '0xABCD...EFGH', type: 'sell', sellToken: 'HEX', buyToken: 'USDC', sellAmount: 250000, buyAmount: 12500, pricePerToken: 0.05, status: 'partial', filled: 62, createdAt: '2024-01-14 22:11' },
  { id: 5, maker: '0x9999...1111', type: 'buy', sellToken: 'DAI', buyToken: 'HEX', sellAmount: 10000, buyAmount: 200000, pricePerToken: 0.05, status: 'active', filled: 0, createdAt: '2024-01-14 18:55' },
  { id: 6, maker: '0x2222...3333', type: 'sell', sellToken: 'PLSX', buyToken: 'HEX', sellAmount: 5000000, buyAmount: 150000, pricePerToken: 0.03, status: 'filled', filled: 100, createdAt: '2024-01-14 15:30' },
  { id: 7, maker: '0x1234...5678', type: 'buy', sellToken: 'PLS', buyToken: 'PLSX', sellAmount: 100000000, buyAmount: 40000000, pricePerToken: 2.5, status: 'active', filled: 20, createdAt: '2024-01-14 11:22' },
  { id: 8, maker: '0x4444...5555', type: 'sell', sellToken: 'HEX', buyToken: 'PLS', sellAmount: 100000, buyAmount: 16500000, pricePerToken: 165, status: 'cancelled', filled: 0, createdAt: '2024-01-13 19:44' },
  { id: 9, maker: '0x6666...7777', type: 'sell', sellToken: 'INC', buyToken: 'PLS', sellAmount: 50, buyAmount: 500000000, pricePerToken: 10000000, status: 'active', filled: 0, createdAt: '2024-01-13 16:08' },
  { id: 10, maker: '0x5b87...0f1c', type: 'buy', sellToken: 'USDC', buyToken: 'PLSX', sellAmount: 5000, buyAmount: 2500000, pricePerToken: 0.002, status: 'filled', filled: 100, createdAt: '2024-01-13 09:33' },
  { id: 11, maker: '0x8888...9999', type: 'sell', sellToken: 'HEX', buyToken: 'DAI', sellAmount: 1000000, buyAmount: 50000, pricePerToken: 0.05, status: 'active', filled: 15, createdAt: '2024-01-12 21:17' },
  { id: 12, maker: '0xAAAA...BBBB', type: 'buy', sellToken: 'PLS', buyToken: 'INC', sellAmount: 1000000000, buyAmount: 100, pricePerToken: 10000000, status: 'partial', filled: 35, createdAt: '2024-01-12 14:52' },
  { id: 13, maker: '0xCCCC...DDDD', type: 'sell', sellToken: 'PLSX', buyToken: 'USDC', sellAmount: 10000000, buyAmount: 25000, pricePerToken: 0.0025, status: 'active', filled: 0, createdAt: '2024-01-12 08:29' },
  { id: 14, maker: '0xEEEE...FFFF', type: 'buy', sellToken: 'HEX', buyToken: 'PLS', sellAmount: 50000, buyAmount: 8500000, pricePerToken: 170, status: 'filled', filled: 100, createdAt: '2024-01-11 17:41' },
  { id: 15, maker: '0x1111...2222', type: 'sell', sellToken: 'INC', buyToken: 'HEX', sellAmount: 10, buyAmount: 2000000, pricePerToken: 200000, status: 'active', filled: 0, createdAt: '2024-01-11 10:15' },
];

function formatVolume(volume: number): string {
  if (volume >= 1000000) {
    return `$${(volume / 1000000).toFixed(2)}M`;
  } else if (volume >= 1000) {
    return `$${(volume / 1000).toFixed(1)}K`;
  }
  return `$${volume.toLocaleString()}`;
}

function getRankDisplay(rank: number) {
  if (rank === 1) return { text: '1st', color: 'text-yellow-400' };
  if (rank === 2) return { text: '2nd', color: 'text-gray-300' };
  if (rank === 3) return { text: '3rd', color: 'text-amber-600' };
  return { text: `${rank}th`, color: 'text-gray-400' };
}

function formatAmount(amount: number): string {
  if (amount >= 1000000000) {
    return `${(amount / 1000000000).toFixed(2)}B`;
  } else if (amount >= 1000000) {
    return `${(amount / 1000000).toFixed(2)}M`;
  } else if (amount >= 1000) {
    return `${(amount / 1000).toFixed(1)}K`;
  }
  return amount.toLocaleString();
}

function getStatusColor(status: string) {
  switch (status) {
    case 'active': return 'text-green-400 bg-green-500/20';
    case 'partial': return 'text-yellow-400 bg-yellow-500/20';
    case 'filled': return 'text-blue-400 bg-blue-500/20';
    case 'cancelled': return 'text-red-400 bg-red-500/20';
    default: return 'text-gray-400 bg-gray-500/20';
  }
}

export default function LeaderboardPage() {
  const [sortBy, setSortBy] = useState<'volume' | 'trades' | 'orders'>('volume');
  const [orderFilter, setOrderFilter] = useState<'all' | 'active' | 'filled' | 'cancelled'>('all');

  const filteredOrders = MOCK_ALL_ORDERS.filter(order => {
    if (orderFilter === 'all') return true;
    if (orderFilter === 'active') return order.status === 'active' || order.status === 'partial';
    return order.status === orderFilter;
  });

  const sortedLeaderboard = [...MOCK_LEADERBOARD].sort((a, b) => {
    if (sortBy === 'volume') return b.totalVolume - a.totalVolume;
    if (sortBy === 'trades') return b.completedTrades - a.completedTrades;
    return b.historicalOrders - a.historicalOrders;
  }).map((user, idx) => ({ ...user, rank: idx + 1 }));

  return (
    <main className="min-h-screen bg-black text-white relative overflow-hidden">
      {/* Animated background */}
      <div className="fixed inset-0 z-0">
        <PixelBlastBackground />
      </div>

      {/* Main Content */}
      <div className="w-full px-4 md:px-8 mt-20 mb-12 relative z-10">
        <div className="max-w-[1200px] mx-auto">
          {/* Header */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="text-center mb-8"
          >
            <h1 className="text-4xl md:text-5xl font-bold text-white mb-4">Leaderboard</h1>
            <p className="text-gray-400 text-lg max-w-2xl mx-auto">
              Top traders ranked by total volume. Climb the ranks by trading more.
            </p>
          </motion.div>

          {/* Sort Options */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="flex justify-center gap-2 mb-6"
          >
            <button
              onClick={() => setSortBy('volume')}
              className={`px-4 py-2 rounded-lg font-medium transition-all ${
                sortBy === 'volume'
                  ? 'bg-white/10 text-white border border-white/20'
                  : 'bg-white/5 text-gray-400 border border-transparent hover:bg-white/10 hover:text-white'
              }`}
            >
              Volume
            </button>
            <button
              onClick={() => setSortBy('trades')}
              className={`px-4 py-2 rounded-lg font-medium transition-all ${
                sortBy === 'trades'
                  ? 'bg-white/10 text-white border border-white/20'
                  : 'bg-white/5 text-gray-400 border border-transparent hover:bg-white/10 hover:text-white'
              }`}
            >
              Trades
            </button>
            <button
              onClick={() => setSortBy('orders')}
              className={`px-4 py-2 rounded-lg font-medium transition-all ${
                sortBy === 'orders'
                  ? 'bg-white/10 text-white border border-white/20'
                  : 'bg-white/5 text-gray-400 border border-transparent hover:bg-white/10 hover:text-white'
              }`}
            >
              Orders
            </button>
          </motion.div>

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
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-white/10">
                      <th className="text-left py-3 px-2 text-gray-400 font-medium text-sm">Rank</th>
                      <th className="text-left py-3 px-2 text-gray-400 font-medium text-sm">Trader</th>
                      <th className="text-center py-3 px-2 text-gray-400 font-medium text-sm">Level</th>
                      <th className="text-right py-3 px-2 text-gray-400 font-medium text-sm">Total Volume</th>
                      <th className="text-right py-3 px-2 text-gray-400 font-medium text-sm hidden sm:table-cell">Trades</th>
                      <th className="text-right py-3 px-2 text-gray-400 font-medium text-sm hidden md:table-cell">Historical Orders</th>
                      <th className="text-right py-3 px-2 text-gray-400 font-medium text-sm hidden lg:table-cell">Active Orders</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sortedLeaderboard.map((user) => {
                      const isCurrentUser = user.address === CURRENT_USER;
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
                                {user.address}
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
                          <td className="py-4 px-2 text-right">
                            <span className={`font-semibold ${sortBy === 'volume' ? 'text-white' : 'text-gray-300'}`}>
                              {formatVolume(user.totalVolume)}
                            </span>
                          </td>
                          <td className="py-4 px-2 text-right hidden sm:table-cell">
                            <span className={`${sortBy === 'trades' ? 'text-white font-semibold' : 'text-gray-400'}`}>
                              {user.completedTrades}
                            </span>
                          </td>
                          <td className="py-4 px-2 text-right hidden md:table-cell">
                            <span className={`${sortBy === 'orders' ? 'text-white font-semibold' : 'text-gray-400'}`}>
                              {user.historicalOrders}
                            </span>
                          </td>
                          <td className="py-4 px-2 text-right hidden lg:table-cell">
                            <span className="text-gray-400">{user.activeOrders}</span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
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
              {(['all', 'active', 'filled', 'cancelled'] as const).map((filter) => (
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
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-white/10">
                      <th className="text-left py-3 px-2 text-gray-400 font-medium text-sm">Maker</th>
                      <th className="text-left py-3 px-2 text-gray-400 font-medium text-sm">Type</th>
                      <th className="text-left py-3 px-2 text-gray-400 font-medium text-sm">Pair</th>
                      <th className="text-right py-3 px-2 text-gray-400 font-medium text-sm">Sell Amount</th>
                      <th className="text-right py-3 px-2 text-gray-400 font-medium text-sm hidden sm:table-cell">Buy Amount</th>
                      <th className="text-center py-3 px-2 text-gray-400 font-medium text-sm hidden md:table-cell">Filled</th>
                      <th className="text-center py-3 px-2 text-gray-400 font-medium text-sm">Status</th>
                      <th className="text-right py-3 px-2 text-gray-400 font-medium text-sm hidden lg:table-cell">Created</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredOrders.map((order) => {
                      const isCurrentUser = order.maker === CURRENT_USER;
                      const statusColors = getStatusColor(order.status);

                      return (
                        <tr
                          key={order.id}
                          className={`border-b border-white/5 transition-colors ${
                            isCurrentUser ? 'bg-white/5' : 'hover:bg-white/5'
                          }`}
                        >
                          <td className="py-4 px-2">
                            <div className="flex items-center gap-2">
                              <span className={`font-mono text-sm ${isCurrentUser ? 'text-white' : 'text-gray-300'}`}>
                                {order.maker}
                              </span>
                              {isCurrentUser && (
                                <span className="text-xs bg-white/10 px-2 py-0.5 rounded text-gray-300">You</span>
                              )}
                            </div>
                          </td>
                          <td className="py-4 px-2">
                            <span className={`text-sm font-medium ${order.type === 'sell' ? 'text-red-400' : 'text-green-400'}`}>
                              {order.type.toUpperCase()}
                            </span>
                          </td>
                          <td className="py-4 px-2">
                            <span className="text-white text-sm">
                              {order.sellToken}/{order.buyToken}
                            </span>
                          </td>
                          <td className="py-4 px-2 text-right">
                            <span className="text-gray-300 text-sm">
                              {formatAmount(order.sellAmount)} {order.sellToken}
                            </span>
                          </td>
                          <td className="py-4 px-2 text-right hidden sm:table-cell">
                            <span className="text-gray-300 text-sm">
                              {formatAmount(order.buyAmount)} {order.buyToken}
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
                    })}
                  </tbody>
                </table>
              </div>
              {filteredOrders.length === 0 && (
                <p className="text-center text-gray-500 py-8">No orders found with this filter.</p>
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
