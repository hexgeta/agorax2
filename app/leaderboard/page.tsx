'use client';

import { useMemo } from 'react';
import { motion } from 'framer-motion';
import { useAccount } from 'wagmi';
import { LiquidGlassCard } from '@/components/ui/liquid-glass';
import PixelBlastBackground from '@/components/ui/PixelBlastBackground';
import { useOpenPositions, CompleteOrderDetails } from '@/hooks/contracts/useOpenPositions';
import { useLeaderboard } from '@/hooks/useUserAchievements';
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

// Interface for merged user stats
interface MergedUserStats {
  address: string;
  totalOrders: number;
  activeOrders: number;
  completedOrders: number;
  cancelledOrders: number;
  // From Supabase (optional - may not exist yet)
  totalXp: number;
  prestigeLevel: number;
  totalVolumeUsd: number;
  totalTrades: number;
  totalOrdersFilled: number;
}

function getRankDisplay(rank: number) {
  if (rank === 1) return { text: '1st', color: 'text-yellow-400' };
  if (rank === 2) return { text: '2nd', color: 'text-gray-300' };
  if (rank === 3) return { text: '3rd', color: 'text-amber-600' };
  return { text: `${rank}th`, color: 'text-gray-400' };
}

function formatAddress(address: string): string {
  if (address.length > 10) {
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  }
  return address;
}

function formatVolume(usd: number): string {
  if (usd >= 1000000) return `$${(usd / 1000000).toFixed(1)}M`;
  if (usd >= 1000) return `$${(usd / 1000).toFixed(1)}K`;
  if (usd > 0) return `$${usd.toFixed(0)}`;
  return '-';
}

function formatXp(xp: number): string {
  if (xp >= 1000000) return `${(xp / 1000000).toFixed(1)}M`;
  if (xp >= 1000) return `${(xp / 1000).toFixed(1)}K`;
  if (xp > 0) return xp.toLocaleString();
  return '-';
}

export default function LeaderboardPage() {
  const { address: connectedAddress } = useAccount();

  // Fetch all orders from the contract (fetchAllOrders = true)
  const { allOrders, isLoading: ordersLoading } = useOpenPositions(undefined, true);

  // Fetch Supabase leaderboard data for XP, volume, prestige
  const { leaderboard, isLoading: leaderboardLoading } = useLeaderboard(500);

  const isLoading = ordersLoading;

  // Merge on-chain data with Supabase leaderboard data
  const mergedUsers = useMemo(() => {
    // Build on-chain stats map
    const onChainMap = new Map<string, {
      address: string;
      totalOrders: number;
      activeOrders: number;
      completedOrders: number;
      cancelledOrders: number;
    }>();

    allOrders.forEach((order: CompleteOrderDetails) => {
      const maker = order.userDetails.orderOwner;
      const orderDetails = order.orderDetailsWithID;
      const makerLower = maker.toLowerCase();

      if (!onChainMap.has(makerLower)) {
        onChainMap.set(makerLower, {
          address: maker,
          totalOrders: 0,
          activeOrders: 0,
          completedOrders: 0,
          cancelledOrders: 0,
        });
      }
      const stats = onChainMap.get(makerLower)!;
      stats.totalOrders++;
      if (orderDetails.status === 0) stats.activeOrders++;
      if (orderDetails.status === 1) stats.cancelledOrders++;
      if (orderDetails.status === 2) stats.completedOrders++;
    });

    // Build Supabase data map
    const supabaseMap = new Map<string, {
      totalXp: number;
      prestigeLevel: number;
      totalVolumeUsd: number;
      totalTrades: number;
      totalOrdersFilled: number;
    }>();

    leaderboard.forEach((entry) => {
      supabaseMap.set(entry.wallet_address.toLowerCase(), {
        totalXp: entry.total_xp,
        prestigeLevel: entry.current_prestige,
        totalVolumeUsd: entry.total_volume_usd,
        totalTrades: entry.total_trades,
        totalOrdersFilled: entry.total_orders_filled,
      });
    });

    // Collect all unique addresses
    const allAddresses = new Set<string>();
    onChainMap.forEach((_, addr) => allAddresses.add(addr));
    supabaseMap.forEach((_, addr) => allAddresses.add(addr));

    // Merge
    const merged: MergedUserStats[] = [];
    allAddresses.forEach((addr) => {
      const onChain = onChainMap.get(addr);
      const supabase = supabaseMap.get(addr);

      merged.push({
        address: onChain?.address || addr,
        totalOrders: onChain?.totalOrders || 0,
        activeOrders: onChain?.activeOrders || 0,
        completedOrders: onChain?.completedOrders || 0,
        cancelledOrders: onChain?.cancelledOrders || 0,
        totalXp: supabase?.totalXp || 0,
        prestigeLevel: supabase?.prestigeLevel ?? (onChain ? Math.min(Math.floor((onChain.completedOrders) / 10), 8) : 0),
        totalVolumeUsd: supabase?.totalVolumeUsd || 0,
        totalTrades: supabase?.totalTrades || 0,
        totalOrdersFilled: supabase?.totalOrdersFilled || 0,
      });
    });

    // Sort by XP first, then by total orders as tiebreaker
    return merged.sort((a, b) => {
      if (b.totalXp !== a.totalXp) return b.totalXp - a.totalXp;
      return b.totalOrders - a.totalOrders;
    });
  }, [allOrders, leaderboard]);

  // Add rank
  const rankedUsers = mergedUsers.map((user, idx) => ({
    ...user,
    rank: idx + 1,
    fillRate: user.totalOrders > 0
      ? Math.round((user.completedOrders / user.totalOrders) * 100)
      : 0,
  }));

  return (
    <main className="min-h-screen bg-black text-white relative overflow-hidden">
      {/* Animated background */}
      <div className="fixed inset-0 z-0">
        <PixelBlastBackground />
      </div>

      {/* Main Content */}
      <div className="w-full px-4 md:px-8 mt-20 mb-12 relative z-10">
        <div className="max-w-[1400px] mx-auto">
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
                      <th className="text-right py-3 px-2 text-gray-400 font-medium text-sm">XP</th>
                      <th className="text-right py-3 px-2 text-gray-400 font-medium text-sm hidden sm:table-cell">Volume</th>
                      <th className="text-right py-3 px-2 text-gray-400 font-medium text-sm hidden sm:table-cell">Trades</th>
                      <th className="text-right py-3 px-2 text-gray-400 font-medium text-sm hidden md:table-cell">Orders</th>
                      <th className="text-right py-3 px-2 text-gray-400 font-medium text-sm hidden md:table-cell">Filled</th>
                      <th className="text-right py-3 px-2 text-gray-400 font-medium text-sm hidden lg:table-cell">Active</th>
                      <th className="text-right py-3 px-2 text-gray-400 font-medium text-sm hidden lg:table-cell">Cancelled</th>
                      <th className="text-right py-3 px-2 text-gray-400 font-medium text-sm hidden lg:table-cell">Fill Rate</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rankedUsers.length === 0 ? (
                      <tr>
                        <td colSpan={11} className="py-8 text-center text-gray-500">
                          No traders found yet.
                        </td>
                      </tr>
                    ) : (
                      rankedUsers.map((user) => {
                        const isCurrentUser = connectedAddress?.toLowerCase() === user.address.toLowerCase();
                        const prestige = PRESTIGE_LEVELS[user.prestigeLevel] || PRESTIGE_LEVELS[0];
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
                            <td className="py-4 px-2 text-right">
                              <span className={`font-medium ${user.totalXp > 0 ? 'text-amber-400' : 'text-gray-600'}`}>
                                {formatXp(user.totalXp)}
                              </span>
                            </td>
                            <td className="py-4 px-2 text-right hidden sm:table-cell">
                              <span className={`text-sm ${user.totalVolumeUsd > 0 ? 'text-green-400' : 'text-gray-600'}`}>
                                {formatVolume(user.totalVolumeUsd)}
                              </span>
                            </td>
                            <td className="py-4 px-2 text-right hidden sm:table-cell">
                              <span className="text-gray-400">
                                {user.totalTrades || user.completedOrders || '-'}
                              </span>
                            </td>
                            <td className="py-4 px-2 text-right hidden md:table-cell">
                              <span className="text-gray-400">
                                {user.totalOrders}
                              </span>
                            </td>
                            <td className="py-4 px-2 text-right hidden md:table-cell">
                              <span className="text-gray-400">
                                {user.completedOrders}
                              </span>
                            </td>
                            <td className="py-4 px-2 text-right hidden lg:table-cell">
                              <span className="text-gray-400">{user.activeOrders}</span>
                            </td>
                            <td className="py-4 px-2 text-right hidden lg:table-cell">
                              <span className={`${user.cancelledOrders > 0 ? 'text-red-400' : 'text-gray-600'}`}>
                                {user.cancelledOrders || '-'}
                              </span>
                            </td>
                            <td className="py-4 px-2 text-right hidden lg:table-cell">
                              <span className={`text-sm ${
                                user.fillRate >= 80 ? 'text-green-400' :
                                user.fillRate >= 50 ? 'text-yellow-400' :
                                user.fillRate > 0 ? 'text-orange-400' :
                                'text-gray-600'
                              }`}>
                                {user.fillRate > 0 ? `${user.fillRate}%` : '-'}
                              </span>
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
            Rankings based on XP earned from achievements. Order data sourced live from PulseChain.
            {leaderboardLoading && <span className="ml-2 text-gray-600">(Loading XP data...)</span>}
          </motion.p>
        </div>
      </div>
    </main>
  );
}
