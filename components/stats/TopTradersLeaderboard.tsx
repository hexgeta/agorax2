'use client';

import { useState, useMemo, useEffect } from 'react';
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationPrevious,
  PaginationNext,
} from '@/components/ui/pagination';
import { useAccount } from 'wagmi';
import { LiquidGlassCard } from '@/components/ui/liquid-glass';
import { CompleteOrderDetails } from '@/hooks/contracts/useOpenPositions';
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

const BUYER_COLORS = [
  { bg: 'rgba(239, 68, 68, 0.2)', text: '#fca5a5', border: 'rgba(239, 68, 68, 0.4)' },
  { bg: 'rgba(59, 130, 246, 0.2)', text: '#93c5fd', border: 'rgba(59, 130, 246, 0.4)' },
  { bg: 'rgba(16, 185, 129, 0.2)', text: '#6ee7b7', border: 'rgba(16, 185, 129, 0.4)' },
  { bg: 'rgba(245, 158, 11, 0.2)', text: '#fcd34d', border: 'rgba(245, 158, 11, 0.4)' },
  { bg: 'rgba(139, 92, 246, 0.2)', text: '#c4b5fd', border: 'rgba(139, 92, 246, 0.4)' },
  { bg: 'rgba(236, 72, 153, 0.2)', text: '#f9a8d4', border: 'rgba(236, 72, 153, 0.4)' },
  { bg: 'rgba(6, 182, 212, 0.2)', text: '#67e8f9', border: 'rgba(6, 182, 212, 0.4)' },
  { bg: 'rgba(251, 146, 60, 0.2)', text: '#fdba74', border: 'rgba(251, 146, 60, 0.4)' },
  { bg: 'rgba(52, 211, 153, 0.2)', text: '#6ee7b7', border: 'rgba(52, 211, 153, 0.4)' },
  { bg: 'rgba(167, 139, 250, 0.2)', text: '#ddd6fe', border: 'rgba(167, 139, 250, 0.4)' },
];

function getAddressColor(address: string) {
  const addr = address.toLowerCase();
  let hash = 0;
  for (let i = 0; i < addr.length; i++) {
    hash = ((hash << 5) - hash + addr.charCodeAt(i)) | 0;
  }
  return BUYER_COLORS[Math.abs(hash) % BUYER_COLORS.length];
}

interface TopTradersLeaderboardProps {
  transactions: Transaction[];
  orders: OrderPlaced[];
  tokenPrices: Record<string, { price: number }>;
  contractOrders?: CompleteOrderDetails[];
  onTraderClick?: (address: string) => void;
  selectedTraders?: string[];
  searchQuery?: string;
  onSearchChange?: (query: string) => void;
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
  gotFilledVolumeUsd: number;
  gotFilledCount: number;
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

export default function TopTradersLeaderboard({ transactions, orders, tokenPrices, contractOrders = [], onTraderClick, selectedTraders = [], searchQuery = '', onSearchChange }: TopTradersLeaderboardProps) {
  const { address: connectedAddress } = useAccount();

  // Fetch Supabase leaderboard data for XP, volume, prestige
  const { leaderboard, isLoading } = useLeaderboard(500);

  // Merge API data with Supabase leaderboard data
  const mergedUsers = useMemo(() => {
    // Build order stats map from contractOrders prop (API data)
    const onChainMap = new Map<string, {
      address: string;
      totalOrders: number;
      activeOrders: number;
      completedOrders: number;
      cancelledOrders: number;
    }>();

    contractOrders.forEach((order: CompleteOrderDetails) => {
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

    // Build Got Filled map: volume of a maker's orders that were filled by others
    const gotFilledMap = new Map<string, { volume: number; count: number }>();

    // Build order owner lookup from contractOrders or orders prop
    const orderOwnerMap = new Map<string, string>();
    if (contractOrders.length > 0) {
      contractOrders.forEach(order => {
        const oid = order.orderDetailsWithID.orderID.toString();
        const owner = order.userDetails.orderOwner?.toLowerCase();
        if (owner) orderOwnerMap.set(oid, owner);
      });
    } else {
      orders.forEach(order => {
        const owner = order.orderOwner?.toLowerCase();
        if (owner) orderOwnerMap.set(order.orderId, owner);
      });
    }

    // For each fill transaction, credit the order maker
    transactions.forEach(tx => {
      const maker = orderOwnerMap.get(tx.orderId);
      if (!maker) return;

      const price = getTokenPrice(tx.sellToken, tokenPrices);
      const volume = tx.sellAmount * price;

      if (!gotFilledMap.has(maker)) {
        gotFilledMap.set(maker, { volume: 0, count: 0 });
      }
      const gf = gotFilledMap.get(maker)!;
      gf.volume += volume;
      gf.count += 1;
    });

    // Collect all unique addresses
    const allAddresses = new Set<string>();
    onChainMap.forEach((_, addr) => allAddresses.add(addr));
    supabaseMap.forEach((_, addr) => allAddresses.add(addr));
    listedMap.forEach((_, addr) => allAddresses.add(addr));
    filledMap.forEach((_, addr) => allAddresses.add(addr));
    gotFilledMap.forEach((_, addr) => allAddresses.add(addr));

    // Merge
    const merged: MergedUserStats[] = [];
    allAddresses.forEach((addr) => {
      const onChain = onChainMap.get(addr);
      const supabase = supabaseMap.get(addr);
      const listed = listedMap.get(addr);
      const filled = filledMap.get(addr);
      const gotFilled = gotFilledMap.get(addr);

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
        gotFilledVolumeUsd: gotFilled?.volume || 0,
        gotFilledCount: gotFilled?.count || 0,
      });
    });

    // Sort by XP first, then by total orders as tiebreaker
    return merged.sort((a, b) => {
      if (b.totalXp !== a.totalXp) return b.totalXp - a.totalXp;
      return b.totalOrders - a.totalOrders;
    });
  }, [contractOrders, leaderboard, transactions, orders, tokenPrices]);

  // Add rank
  const rankedUsers = mergedUsers.map((user, idx) => ({
    ...user,
    rank: idx + 1,
    fillRate: user.totalOrders > 0
      ? Math.round((user.completedOrders / user.totalOrders) * 100)
      : 0,
  }));

  // Filter by search query (from cross-table filtering)
  const filteredUsers = useMemo(() => {
    if (!searchQuery.trim()) return rankedUsers;
    const q = searchQuery.trim().toLowerCase();
    const isNumeric = /^\d+$/.test(q);

    if (isNumeric) {
      // Filter by order ID: find all addresses that participated in this order
      const participants = new Set<string>();
      // Maker of the order
      contractOrders.forEach(order => {
        if (order.orderDetailsWithID.orderID.toString() === q) {
          participants.add(order.userDetails.orderOwner.toLowerCase());
        }
      });
      orders.forEach(order => {
        if (order.orderId === q) {
          participants.add(order.orderOwner.toLowerCase());
        }
      });
      // Fillers of the order
      transactions.forEach(tx => {
        if (tx.orderId === q && tx.buyer) {
          participants.add(tx.buyer.toLowerCase());
        }
      });
      return rankedUsers.filter(user => participants.has(user.address.toLowerCase()));
    }

    return rankedUsers.filter(user => user.address.toLowerCase().includes(q));
  }, [rankedUsers, searchQuery, contractOrders, orders, transactions]);

  type LeaderboardSortKey = 'rank' | 'totalXp' | 'listedVolumeUsd' | 'gotFilledVolumeUsd' | 'filledVolumeUsd' | 'totalVolume';
  const [lbSortKey, setLbSortKey] = useState<LeaderboardSortKey>('rank');
  const [lbSortDir, setLbSortDir] = useState<'asc' | 'desc'>('asc');

  function toggleLbSort(key: LeaderboardSortKey) {
    if (lbSortKey === key) {
      setLbSortDir(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setLbSortKey(key);
      setLbSortDir(key === 'rank' ? 'asc' : 'desc');
    }
    setPage(1);
  }

  const sortedUsers = useMemo(() => {
    if (lbSortKey === 'rank') {
      return lbSortDir === 'asc' ? filteredUsers : [...filteredUsers].reverse();
    }
    const dir = lbSortDir === 'asc' ? 1 : -1;
    return [...filteredUsers].sort((a, b) => {
      if (lbSortKey === 'totalVolume') {
        return ((a.filledVolumeUsd + a.gotFilledVolumeUsd) - (b.filledVolumeUsd + b.gotFilledVolumeUsd)) * dir;
      }
      return (a[lbSortKey] - b[lbSortKey]) * dir;
    });
  }, [filteredUsers, lbSortKey, lbSortDir]);

  const PAGE_SIZE = 10;
  const [page, setPage] = useState(1);
  useEffect(() => { setPage(1); }, [searchQuery]);
  const totalPages = Math.max(1, Math.ceil(sortedUsers.length / PAGE_SIZE));
  const paginatedUsers = sortedUsers.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  return (
    <LiquidGlassCard
      className="p-4 md:p-6 bg-black/40"
      shadowIntensity="none"
      glowIntensity="none"
    >
      <h3 className="text-2xl font-bold text-white mb-6">Top Traders</h3>

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <PixelSpinner size={32} />
          <span className="ml-3 text-gray-400">Loading leaderboard...</span>
        </div>
      ) : (
        <>
        <div className="overflow-x-auto pb-2 modern-scrollbar">
          <div className="min-w-[1000px]">
            {/* Header */}
            <div className="grid grid-cols-7 border-b border-white/10">
              <div className="text-center py-3 px-2 text-gray-400 font-medium text-sm whitespace-nowrap cursor-pointer hover:text-white select-none" onClick={() => toggleLbSort('rank')}>
                Rank{lbSortKey === 'rank' && <span className="ml-1 text-white/60">{lbSortDir === 'asc' ? '▲' : '▼'}</span>}
              </div>
              <div className="text-center py-3 px-2 text-gray-400 font-medium text-sm whitespace-nowrap">Trader</div>
              <div className="text-center py-3 px-2 text-gray-400 font-medium text-sm whitespace-nowrap cursor-pointer hover:text-white select-none" onClick={() => toggleLbSort('totalXp')}>
                XP{lbSortKey === 'totalXp' && <span className="ml-1 text-white/60">{lbSortDir === 'asc' ? '▲' : '▼'}</span>}
              </div>
              <div className="text-center py-3 px-2 text-gray-400 font-medium text-sm whitespace-nowrap cursor-pointer hover:text-white select-none" onClick={() => toggleLbSort('listedVolumeUsd')}>
                Listed{lbSortKey === 'listedVolumeUsd' && <span className="ml-1 text-white/60">{lbSortDir === 'asc' ? '▲' : '▼'}</span>}
              </div>
              <div className="text-center py-3 px-2 text-gray-400 font-medium text-sm whitespace-nowrap cursor-pointer hover:text-white select-none" onClick={() => toggleLbSort('gotFilledVolumeUsd')}>
                Got Filled{lbSortKey === 'gotFilledVolumeUsd' && <span className="ml-1 text-white/60">{lbSortDir === 'asc' ? '▲' : '▼'}</span>}
              </div>
              <div className="text-center py-3 px-2 text-gray-400 font-medium text-sm whitespace-nowrap cursor-pointer hover:text-white select-none" onClick={() => toggleLbSort('filledVolumeUsd')}>
                They Filled{lbSortKey === 'filledVolumeUsd' && <span className="ml-1 text-white/60">{lbSortDir === 'asc' ? '▲' : '▼'}</span>}
              </div>
              <div className="text-center py-3 px-2 text-gray-400 font-medium text-sm whitespace-nowrap cursor-pointer hover:text-white select-none" onClick={() => toggleLbSort('totalVolume')}>
                Total Vol. Traded{lbSortKey === 'totalVolume' && <span className="ml-1 text-white/60">{lbSortDir === 'asc' ? '▲' : '▼'}</span>}
              </div>
            </div>

            {/* Rows */}
            {paginatedUsers.length === 0 ? (
              <div className="py-8 text-center text-gray-500">
                No traders found yet.
              </div>
            ) : (
              paginatedUsers.map((user) => {
                const isCurrentUser = connectedAddress?.toLowerCase() === user.address.toLowerCase();
                const isSelected = selectedTraders.some(t => t.toLowerCase() === user.address.toLowerCase());
                const hasCompletedFirstLegion = user.prestigeLevel >= 1;
                const displayLevel = hasCompletedFirstLegion ? user.prestigeLevel - 1 : 0;
                const prestige = PRESTIGE_LEVELS[displayLevel] || PRESTIGE_LEVELS[0];
                const rankDisplay = getRankDisplay(user.rank);
                const totalVolume = user.filledVolumeUsd + user.gotFilledVolumeUsd;
                const color = getAddressColor(user.address);

                return (
                  <div
                    key={user.address}
                    className={`grid grid-cols-7 items-center cursor-pointer transition-all rounded-lg ${isSelected ? 'border border-white/50 bg-white/10' : 'border border-transparent hover:bg-white/5'} ${isCurrentUser && !isSelected ? 'bg-white/5' : ''}`}
                    onClick={() => onTraderClick?.(user.address)}
                  >
                    <div className="py-4 px-2 text-center">
                      <span className={`font-bold ${rankDisplay.color}`}>
                        {rankDisplay.text}
                      </span>
                    </div>
                    <div className="py-4 px-2 text-center">
                      <div className="flex items-center justify-center gap-2">
                        <span
                          className="font-mono text-xs px-2.5 py-1 rounded-full inline-block"
                          style={{ backgroundColor: color.bg, color: color.text, border: `1px solid ${color.border}` }}
                        >
                          {formatAddress(user.address)}
                        </span>
                        {isCurrentUser && (
                          <span className="text-xs bg-white/10 px-2 py-0.5 rounded text-gray-300">You</span>
                        )}
                        {isSelected && (
                          <span className="text-[10px] px-1.5 py-0.5 bg-white/20 text-white rounded">FILTERED</span>
                        )}
                      </div>
                    </div>
                    <div className="py-4 px-2 text-center">
                      <span className={`font-medium ${user.totalXp > 0 ? 'text-amber-400' : 'text-gray-600'}`}>
                        {formatXp(user.totalXp)}
                      </span>
                    </div>
                    <div className="py-4 px-2 text-center">
                      {user.listedVolumeUsd > 0 ? (
                        <>
                          <span className="text-pink-400 text-sm">{formatUSD(user.listedVolumeUsd)}</span>
                          <span className="text-gray-500 text-xs ml-1">({user.listedOrderCount})</span>
                        </>
                      ) : (
                        <span className="text-gray-600 text-sm">-</span>
                      )}
                    </div>
                    <div className="py-4 px-2 text-center">
                      {user.gotFilledVolumeUsd > 0 ? (
                        <>
                          <span className="text-blue-400 text-sm">{formatUSD(user.gotFilledVolumeUsd)}</span>
                          <span className="text-gray-500 text-xs ml-1">({user.gotFilledCount})</span>
                        </>
                      ) : (
                        <span className="text-gray-600 text-sm">-</span>
                      )}
                    </div>
                    <div className="py-4 px-2 text-center">
                      {user.filledVolumeUsd > 0 ? (
                        <>
                          <span className="text-green-400 text-sm">{formatUSD(user.filledVolumeUsd)}</span>
                          <span className="text-gray-500 text-xs ml-1">({user.filledCount})</span>
                        </>
                      ) : (
                        <span className="text-gray-600 text-sm">-</span>
                      )}
                    </div>
                    <div className="py-4 px-2 text-center">
                      <span className="text-white font-bold text-sm">
                        {totalVolume > 0 ? formatUSD(totalVolume) : '-'}
                      </span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
        {totalPages > 1 && (
          <div className="flex items-center justify-end mt-4">
            <Pagination>
              <PaginationContent>
                <PaginationItem>
                  <PaginationPrevious
                    className={page <= 1 ? 'pointer-events-none opacity-40' : 'cursor-pointer'}
                    onClick={() => setPage(p => Math.max(1, p - 1))}
                  />
                </PaginationItem>
                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                  let pg: number;
                  if (totalPages <= 5) {
                    pg = i + 1;
                  } else if (page <= 3) {
                    pg = i + 1;
                  } else if (page >= totalPages - 2) {
                    pg = totalPages - 4 + i;
                  } else {
                    pg = page - 2 + i;
                  }
                  return (
                    <PaginationItem key={pg}>
                      <PaginationLink
                        isActive={pg === page}
                        className="cursor-pointer"
                        onClick={() => setPage(pg)}
                      >
                        {pg}
                      </PaginationLink>
                    </PaginationItem>
                  );
                })}
                <PaginationItem>
                  <PaginationNext
                    className={page >= totalPages ? 'pointer-events-none opacity-40' : 'cursor-pointer'}
                    onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                  />
                </PaginationItem>
              </PaginationContent>
            </Pagination>
          </div>
        )}
        </>
      )}

    </LiquidGlassCard>
  );
}
