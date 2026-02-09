'use client';

import { useMemo } from 'react';
import { useAccount } from 'wagmi';
import { LiquidGlassCard } from '@/components/ui/liquid-glass';
import { useOpenPositions, CompleteOrderDetails } from '@/hooks/contracts/useOpenPositions';
import { useLeaderboard } from '@/hooks/useUserAchievements';
import { PixelSpinner } from '@/components/ui/PixelSpinner';
import { formatUSD, getTokenPrice } from '@/utils/format';
import { getTokenInfo } from '@/utils/tokenUtils';

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

interface TopTradersLeaderboardProps {
  transactions: Transaction[];
  orders: OrderPlaced[];
  tokenPrices: Record<string, { price: number }>;
  contractOrders?: CompleteOrderDetails[];
}

// Interface for merged user stats
interface MergedUserStats {
  address: string;
  totalOrders: number;
  activeOrders: number;
  completedOrders: number;
  cancelledOrders: number;
  totalXp: number;
  prestigeLevel: number;
  totalVolumeUsd: number;
  totalTrades: number;
  totalOrdersFilled: number;
  // New fields for Listed/Filled
  listedVolumeUsd: number;
  listedOrderCount: number;
  filledVolumeUsd: number;
  filledCount: number;
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

function formatXp(xp: number): string {
  if (xp >= 1000000) return `${(xp / 1000000).toFixed(1)}M`;
  if (xp >= 1000) return `${(xp / 1000).toFixed(1)}K`;
  if (xp > 0) return xp.toLocaleString();
  return '-';
}

export default function TopTradersLeaderboard({ transactions, orders, tokenPrices, contractOrders = [] }: TopTradersLeaderboardProps) {
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

    // Build Listed/Filled volume maps from props
    const listedMap = new Map<string, { volume: number; count: number }>();
    const filledMap = new Map<string, { volume: number; count: number }>();

    // Process orders for Listed volume (prefer contractOrders if available)
    if (contractOrders.length > 0) {
      contractOrders.forEach(order => {
        const seller = order.userDetails.orderOwner?.toLowerCase();
        if (!seller) return;

        const sellAddr = order.orderDetailsWithID.orderDetails.sellToken.toLowerCase();
        const sellTokenInfo = getTokenInfo(sellAddr);
        const sellAmount = Number(order.orderDetailsWithID.orderDetails.sellAmount) / Math.pow(10, sellTokenInfo.decimals);
        const sellPrice = getTokenPrice(sellAddr, tokenPrices);
        const sellVolume = sellAmount * sellPrice;

        if (!listedMap.has(seller)) {
          listedMap.set(seller, { volume: 0, count: 0 });
        }
        const listed = listedMap.get(seller)!;
        listed.volume += sellVolume;
        listed.count += 1;
      });
    } else {
      orders.forEach(order => {
        const seller = order.orderOwner?.toLowerCase();
        if (!seller) return;

        const price = getTokenPrice(order.sellToken, tokenPrices);
        const volume = order.sellAmount * price;

        if (!listedMap.has(seller)) {
          listedMap.set(seller, { volume: 0, count: 0 });
        }
        const listed = listedMap.get(seller)!;
        listed.volume += volume;
        listed.count += 1;
      });
    }

    // Process transactions for Filled volume (by buyer)
    transactions.forEach(tx => {
      if (!tx.buyer) return;
      const buyer = tx.buyer.toLowerCase();

      const price = getTokenPrice(tx.sellToken, tokenPrices);
      const volume = tx.sellAmount * price;

      if (!filledMap.has(buyer)) {
        filledMap.set(buyer, { volume: 0, count: 0 });
      }
      const filled = filledMap.get(buyer)!;
      filled.volume += volume;
      filled.count += 1;
    });

    // Collect all unique addresses
    const allAddresses = new Set<string>();
    onChainMap.forEach((_, addr) => allAddresses.add(addr));
    supabaseMap.forEach((_, addr) => allAddresses.add(addr));
    listedMap.forEach((_, addr) => allAddresses.add(addr));
    filledMap.forEach((_, addr) => allAddresses.add(addr));

    // Merge
    const merged: MergedUserStats[] = [];
    allAddresses.forEach((addr) => {
      const onChain = onChainMap.get(addr);
      const supabase = supabaseMap.get(addr);
      const listed = listedMap.get(addr);
      const filled = filledMap.get(addr);

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
        listedVolumeUsd: listed?.volume || 0,
        listedOrderCount: listed?.count || 0,
        filledVolumeUsd: filled?.volume || 0,
        filledCount: filled?.count || 0,
      });
    });

    // Sort by XP first, then by total orders as tiebreaker
    return merged.sort((a, b) => {
      if (b.totalXp !== a.totalXp) return b.totalXp - a.totalXp;
      return b.totalOrders - a.totalOrders;
    });
  }, [allOrders, leaderboard, transactions, orders, tokenPrices, contractOrders]);

  // Add rank
  const rankedUsers = mergedUsers.map((user, idx) => ({
    ...user,
    rank: idx + 1,
    fillRate: user.totalOrders > 0
      ? Math.round((user.completedOrders / user.totalOrders) * 100)
      : 0,
  }));

  return (
    <LiquidGlassCard
      className="p-4 md:p-6 bg-black/40"
      shadowIntensity="none"
      glowIntensity="none"
    >
      <h3 className="text-2xl font-bold text-white mb-6">Leaderboard</h3>

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <PixelSpinner size={32} />
          <span className="ml-3 text-gray-400">Loading leaderboard...</span>
        </div>
      ) : (
        <div className="overflow-x-auto pb-2 modern-scrollbar">
          <table className="w-full min-w-[1000px]">
            <thead>
              <tr className="border-b border-white/10">
                <th className="text-left py-3 px-2 text-gray-400 font-medium text-sm whitespace-nowrap">Rank</th>
                <th className="text-left py-3 px-2 text-gray-400 font-medium text-sm whitespace-nowrap">Trader</th>
                <th className="text-center py-3 px-2 text-gray-400 font-medium text-sm whitespace-nowrap">Legion</th>
                <th className="text-right py-3 px-2 text-gray-400 font-medium text-sm whitespace-nowrap">XP</th>
                <th className="text-right py-3 px-2 text-gray-400 font-medium text-sm whitespace-nowrap">Listed</th>
                <th className="text-right py-3 px-2 text-gray-400 font-medium text-sm whitespace-nowrap">Filled</th>
                <th className="text-right py-3 px-2 text-gray-400 font-medium text-sm whitespace-nowrap">Total</th>
                <th className="text-right py-3 px-2 text-gray-400 font-medium text-sm whitespace-nowrap">Fill Rate</th>
              </tr>
            </thead>
            <tbody>
              {rankedUsers.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-gray-500">
                    No traders found yet.
                  </td>
                </tr>
              ) : (
                rankedUsers.map((user) => {
                  const isCurrentUser = connectedAddress?.toLowerCase() === user.address.toLowerCase();
                  // Show grey if user hasn't completed first legion, otherwise show completed level
                  const hasCompletedFirstLegion = user.prestigeLevel >= 1;
                  const displayLevel = hasCompletedFirstLegion ? user.prestigeLevel - 1 : 0;
                  const prestige = PRESTIGE_LEVELS[displayLevel] || PRESTIGE_LEVELS[0];
                  const rankDisplay = getRankDisplay(user.rank);
                  const totalVolume = user.listedVolumeUsd + user.filledVolumeUsd;

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
                            className={`w-8 h-8 rounded-full flex items-center justify-center ${hasCompletedFirstLegion ? prestige.bgColor : 'bg-gray-500/20'}`}
                            title={hasCompletedFirstLegion ? prestige.name : 'Alpha (In Progress)'}
                          >
                            <span className={`text-sm font-bold ${hasCompletedFirstLegion ? prestige.color : 'text-gray-500'}`}>
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
                      <td className="py-4 px-2 text-right">
                        {user.listedVolumeUsd > 0 ? (
                          <>
                            <span className="text-pink-400 text-sm">{formatUSD(user.listedVolumeUsd)}</span>
                            <span className="text-gray-500 text-xs ml-1">({user.listedOrderCount})</span>
                          </>
                        ) : (
                          <span className="text-gray-600 text-sm">-</span>
                        )}
                      </td>
                      <td className="py-4 px-2 text-right">
                        {user.filledVolumeUsd > 0 ? (
                          <>
                            <span className="text-green-400 text-sm">{formatUSD(user.filledVolumeUsd)}</span>
                            <span className="text-gray-500 text-xs ml-1">({user.filledCount})</span>
                          </>
                        ) : (
                          <span className="text-gray-600 text-sm">-</span>
                        )}
                      </td>
                      <td className="py-4 px-2 text-right">
                        <span className="text-white font-bold text-sm">
                          {totalVolume > 0 ? formatUSD(totalVolume) : '-'}
                        </span>
                      </td>
                      <td className="py-4 px-2 text-right">
                        <span className={`text-sm whitespace-nowrap ${
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
  );
}
