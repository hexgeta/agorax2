'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { useStatsData } from '@/context/StatsDataContext';
import { useAccount } from 'wagmi';
import { motion } from 'framer-motion';
import { DisclaimerDialog } from '@/components/DisclaimerDialog';
import { PixelSpinner } from '@/components/ui/PixelSpinner';
import { LogoPreloader } from '@/components/LogoPreloader';
import PixelBlastBackground from '@/components/ui/PixelBlastBackground';
import StatsOverviewCards from '@/components/stats/StatsOverviewCards';
import TopTokensChart from '@/components/stats/TopTokensChart';
import ProtocolActivityChart from '@/components/stats/ProtocolActivityChart';
// import HourlyActivityChart from '@/components/stats/HourlyActivityChart';
import OrderbookChart from '@/components/stats/OrderbookChart';
import TopTradersLeaderboard from '@/components/stats/TopTradersLeaderboard';
import { useTokenPrices } from '@/hooks/crypto/useTokenPrices';
import { useContractWhitelistRead } from '@/hooks/contracts/useContractWhitelistRead';
import { getTokenInfo, getTokenInfoByIndex, formatTokenAmount, formatTokenTicker } from '@/utils/tokenUtils';
import { useOpenPositions, CompleteOrderDetails } from '@/hooks/contracts/useOpenPositions';
import { LiquidGlassCard } from '@/components/ui/liquid-glass';
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationPrevious,
  PaginationNext,
  PaginationEllipsis,
} from '@/components/ui/pagination';
import { CoinLogo } from '@/components/ui/CoinLogo';

// ── Shared interfaces matching existing components ──────────────────────────

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

// ── Supabase row types ──────────────────────────────────────────────────────

interface DbOrder {
  order_id: number;
  maker_address: string;
  sell_token_address: string;
  sell_token_ticker: string;
  sell_amount_raw: string;
  sell_amount_formatted: number;
  buy_tokens_addresses: string[];
  buy_tokens_tickers: string[];
  buy_amounts_raw: string[];
  buy_amounts_formatted: number[];
  status: number;
  fill_percentage: number;
  remaining_sell_amount: string;
  redeemed_sell_amount: string;
  is_all_or_nothing: boolean;
  expiration: number;
  creation_tx_hash: string;
  creation_block_number: number;
  created_at: string;
}

interface DbFill {
  order_id: number;
  filler_address: string;
  buy_token_index: number;
  buy_token_address: string;
  buy_token_ticker: string;
  buy_amount_raw: string;
  buy_amount_formatted: number;
  tx_hash: string;
  block_number: number;
  filled_at: string;
}

// ── All Orders table types ──────────────────────────────────────────────────

interface FormattedOrder {
  id: number;
  maker: string;
  sellToken: string;
  sellTokenAddress: string;
  sellAmountNum: number;
  sellUsd: number;
  buyToken: string;
  buyTokenAddress: string;
  buyAmountNum: number;
  buyUsd: number;
  sellAmount: string;
  buyAmount: string;
  status: 'active' | 'completed' | 'cancelled';
  filled: number;
  createdAt: string;
}

interface FormattedFill {
  orderId: string;
  buyer: string;
  sellToken: string;
  sellTokenAddress: string;
  sellAmountNum: number;
  sellUsd: number;
  buyToken: string;
  buyTokenAddress: string;
  buyAmountNum: number;
  buyUsd: number;
  timestamp: number;
  txHash: string;
  fillPercentage: number;
  orderStatus: string;
}

// ── Helpers ─────────────────────────────────────────────────────────────────

function formatDisplayAmount(amount: string): string {
  const num = parseFloat(amount);
  if (isNaN(num)) return amount;
  if (num >= 1000000000) return `${(num / 1000000000).toFixed(2)}B`;
  if (num >= 1000000) return `${(num / 1000000).toFixed(2)}M`;
  if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
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
  if (address.length > 10) return `${address.slice(0, 6)}...${address.slice(-4)}`;
  return address;
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

function getBuyerColor(address: string) {
  const addr = address.toLowerCase();
  let hash = 0;
  for (let i = 0; i < addr.length; i++) {
    hash = ((hash << 5) - hash + addr.charCodeAt(i)) | 0;
  }
  return BUYER_COLORS[Math.abs(hash) % BUYER_COLORS.length];
}

function formatTimestampDisplay(ts: string | number): string {
  if (!ts) return '-';
  const date = typeof ts === 'string' ? new Date(ts) : new Date(ts * 1000);
  const time = date.toLocaleString('en-US', { hour: '2-digit', minute: '2-digit', timeZone: 'UTC' });
  const day = date.toLocaleString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
  return `${time} UTC, ${day}`;
}

// ── Transform Supabase data to component shapes ────────────────────────────

function dbOrdersToOrderPlaced(dbOrders: DbOrder[]): OrderPlaced[] {
  return dbOrders.map(o => ({
    transactionHash: o.creation_tx_hash || '',
    orderId: o.order_id.toString(),
    sellToken: o.sell_token_address?.toLowerCase() || '',
    sellAmount: o.sell_amount_formatted || 0,
    blockNumber: BigInt(o.creation_block_number || 0),
    timestamp: o.created_at ? Math.floor(new Date(o.created_at).getTime() / 1000) : undefined,
    orderOwner: o.maker_address || '',
  }));
}

function dbOrdersToCompleteOrderDetails(dbOrders: DbOrder[], whitelist: string[]): CompleteOrderDetails[] {
  return dbOrders.map(o => {
    const sellAmountBigInt = BigInt(o.sell_amount_raw || '0');
    const remainingBigInt = BigInt(o.remaining_sell_amount || '0');
    const redeemedBigInt = BigInt(o.redeemed_sell_amount || '0');

    // Map buy token addresses to whitelist indices
    const buyTokensIndex: bigint[] = (o.buy_tokens_addresses || []).map(addr => {
      const idx = whitelist.findIndex(w => w.toLowerCase() === addr?.toLowerCase());
      return BigInt(idx >= 0 ? idx : 0);
    });

    const buyAmounts: bigint[] = (o.buy_amounts_raw || []).map(a => BigInt(a || '0'));

    return {
      userDetails: {
        orderIndex: BigInt(0),
        orderOwner: o.maker_address as `0x${string}`,
      },
      orderDetailsWithID: {
        orderID: BigInt(o.order_id),
        remainingSellAmount: remainingBigInt,
        redeemedSellAmount: redeemedBigInt,
        lastUpdateTime: o.created_at ? Math.floor(new Date(o.created_at).getTime() / 1000) : 0,
        status: o.status,
        creationProtocolFee: BigInt(0),
        orderDetails: {
          sellToken: o.sell_token_address as `0x${string}`,
          sellAmount: sellAmountBigInt,
          buyTokensIndex,
          buyAmounts,
          expirationTime: BigInt(o.expiration || 0),
          allOrNothing: o.is_all_or_nothing || false,
        },
      },
    } as CompleteOrderDetails;
  });
}

function dbFillsToTransactions(dbFills: DbFill[], dbOrders: DbOrder[]): Transaction[] {
  const orderMap = new Map<number, DbOrder>();
  dbOrders.forEach(o => orderMap.set(o.order_id, o));

  return dbFills.map(fill => {
    const order = orderMap.get(fill.order_id);
    const sellTokenAddr = order?.sell_token_address?.toLowerCase() || '';
    const buyTokenAddr = fill.buy_token_address?.toLowerCase() || '';
    const sellTokenInfo = getTokenInfo(sellTokenAddr);

    // Calculate proportional sell amount
    let sellAmount = 0;
    if (order) {
      const matchIdx = (order.buy_tokens_addresses || []).findIndex(
        addr => addr?.toLowerCase() === buyTokenAddr
      );
      if (matchIdx >= 0 && order.buy_amounts_raw?.[matchIdx]) {
        const originalBuyAmountRaw = Number(order.buy_amounts_raw[matchIdx]);
        if (originalBuyAmountRaw > 0) {
          const ratio = Number(fill.buy_amount_raw) / originalBuyAmountRaw;
          sellAmount = (Number(order.sell_amount_raw) * ratio) / Math.pow(10, sellTokenInfo.decimals);
        }
      }
    }

    return {
      transactionHash: fill.tx_hash || '',
      orderId: fill.order_id.toString(),
      sellToken: sellTokenAddr,
      sellAmount,
      buyTokens: { [buyTokenAddr]: fill.buy_amount_formatted || 0 },
      blockNumber: BigInt(fill.block_number || 0),
      timestamp: fill.filled_at ? Math.floor(new Date(fill.filled_at).getTime() / 1000) : undefined,
      buyer: fill.filler_address || '',
    };
  });
}

function dbFillsToFormattedFills(dbFills: DbFill[], dbOrders: DbOrder[], tokenPrices: Record<string, { price: number }>): FormattedFill[] {
  const orderMap = new Map<number, DbOrder>();
  dbOrders.forEach(o => orderMap.set(o.order_id, o));

  return dbFills.map(fill => {
    const order = orderMap.get(fill.order_id);
    const sellTokenAddr = order?.sell_token_address?.toLowerCase() || '';
    const buyTokenAddr = fill.buy_token_address?.toLowerCase() || '';
    const sellTokenInfo = getTokenInfo(sellTokenAddr);

    let sellAmountNum = 0;
    let fillPercentage = 0;
    if (order) {
      const matchIdx = (order.buy_tokens_addresses || []).findIndex(
        addr => addr?.toLowerCase() === buyTokenAddr
      );
      if (matchIdx >= 0 && order.buy_amounts_raw?.[matchIdx]) {
        const originalBuyAmountRaw = Number(order.buy_amounts_raw[matchIdx]);
        if (originalBuyAmountRaw > 0) {
          const ratio = Number(fill.buy_amount_raw) / originalBuyAmountRaw;
          sellAmountNum = (Number(order.sell_amount_raw) * ratio) / Math.pow(10, sellTokenInfo.decimals);
          fillPercentage = Math.round(ratio * 100);
        }
      }
    }

    const statusMap: Record<number, string> = { 0: 'active', 1: 'cancelled', 2: 'completed' };
    const orderStatus = order ? (statusMap[order.status] || 'unknown') : 'unknown';

    return {
      orderId: fill.order_id.toString(),
      buyer: fill.filler_address || '',
      sellToken: order?.sell_token_ticker || 'UNKNOWN',
      sellTokenAddress: sellTokenAddr,
      sellAmountNum,
      sellUsd: sellAmountNum * (tokenPrices[sellTokenAddr]?.price ?? 0),
      buyToken: fill.buy_token_ticker || 'UNKNOWN',
      buyTokenAddress: buyTokenAddr,
      buyAmountNum: fill.buy_amount_formatted || 0,
      buyUsd: (fill.buy_amount_formatted || 0) * (tokenPrices[buyTokenAddr]?.price ?? 0),
      timestamp: fill.filled_at ? Math.floor(new Date(fill.filled_at).getTime() / 1000) : 0,
      txHash: fill.tx_hash || '',
      fillPercentage,
      orderStatus,
    };
  }).sort((a, b) => b.timestamp - a.timestamp);
}

// ── Page Component ──────────────────────────────────────────────────────────

export default function Stats2Page() {
  const [showDisclaimer, setShowDisclaimer] = useState(false);
  const [pageVisible, setPageVisible] = useState(false);
  const { address: connectedAddress } = useAccount();

  // Use pre-fetched data from context (loaded on any page, polled every 60s)
  const { dbOrders, dbFills, isLoading, error, refetch: fetchData } = useStatsData();

  const [selectedTokenFilters, setSelectedTokenFilters] = useState<{ address: string; ticker: string }[]>([]);
  const [selectedTraderFilters, setSelectedTraderFilters] = useState<string[]>([]);
  const [orderStatusFilter, setOrderStatusFilter] = useState<'all' | 'active' | 'completed' | 'cancelled'>('all');
  const [addressSearch, setAddressSearch] = useState('');
  const [orderIdSearch, setOrderIdSearch] = useState('');
  const [selectedDateFilter, setSelectedDateFilter] = useState<string | null>(null);
  const [orderPage, setOrderPage] = useState(1);
  const [fillPage, setFillPage] = useState(1);
  const PAGE_SIZE = 20;

  // Sort state for orders table
  const [orderSortKey, setOrderSortKey] = useState<'id' | 'maker' | 'sellUsd' | 'buyUsd' | 'filled' | 'status' | 'createdAt'>('id');
  const [orderSortDir, setOrderSortDir] = useState<'asc' | 'desc'>('desc');

  // Sort state for fills table
  const [fillSortKey, setFillSortKey] = useState<'orderId' | 'buyer' | 'sellUsd' | 'buyUsd' | 'fillPercentage' | 'orderStatus' | 'timestamp'>('timestamp');
  const [fillSortDir, setFillSortDir] = useState<'asc' | 'desc'>('desc');

  function toggleOrderSort(key: typeof orderSortKey) {
    if (orderSortKey === key) {
      setOrderSortDir(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setOrderSortKey(key);
      setOrderSortDir('desc');
    }
    setOrderPage(1);
  }

  function toggleFillSort(key: typeof fillSortKey) {
    if (fillSortKey === key) {
      setFillSortDir(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setFillSortKey(key);
      setFillSortDir('desc');
    }
    setFillPage(1);
  }

  // Live active orders from contract for accurate TVL and orderbook
  const { activeOrders: liveActiveOrders, isLoading: liveOrdersLoading } = useOpenPositions();

  // Get whitelist for token index lookups
  const { activeTokens } = useContractWhitelistRead();
  const whitelist = useMemo(() =>
    activeTokens.map(t => t.tokenAddress.toLowerCase()),
    [activeTokens]
  );

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const accepted = localStorage.getItem('disclaimer-accepted');
      setShowDisclaimer(accepted !== 'true');
    }
  }, []);

  // ── Transform DB data to component shapes ───────────────────────────────

  const orders: OrderPlaced[] = useMemo(
    () => dbOrdersToOrderPlaced(dbOrders),
    [dbOrders]
  );

  const contractOrders: CompleteOrderDetails[] = useMemo(
    () => dbOrdersToCompleteOrderDetails(dbOrders, whitelist),
    [dbOrders, whitelist]
  );

  // Use live contract data for active orders (accurate TVL + orderbook)
  // Fall back to DB-derived active orders if contract hasn't loaded yet
  const activeOrders: CompleteOrderDetails[] = useMemo(
    () => !liveOrdersLoading && liveActiveOrders.length > 0
      ? liveActiveOrders
      : contractOrders.filter(o => o.orderDetailsWithID.status === 0),
    [liveActiveOrders, liveOrdersLoading, contractOrders]
  );

  const transactions: Transaction[] = useMemo(
    () => dbFillsToTransactions(dbFills, dbOrders),
    [dbFills, dbOrders]
  );

  // ── Token prices ────────────────────────────────────────────────────────

  const allTokenAddresses = useMemo(() => {
    const addresses = new Set<string>();
    dbOrders.forEach(o => {
      if (o.sell_token_address) addresses.add(o.sell_token_address.toLowerCase());
      (o.buy_tokens_addresses || []).forEach(addr => {
        if (addr) addresses.add(addr.toLowerCase());
      });
    });
    return Array.from(addresses);
  }, [dbOrders]);

  const { prices: tokenPrices, isLoading: pricesLoading } = useTokenPrices(allTokenAddresses);

  // Calculate TVL directly from DB data using remaining_sell_amount (accurate, no contract read needed)
  const dbTvl = useMemo(() => {
    return dbOrders
      .filter(o => o.status === 0) // active orders only
      .reduce((sum, o) => {
        const tokenInfo = getTokenInfo(o.sell_token_address);
        const remaining = Number(BigInt(o.remaining_sell_amount || '0')) / Math.pow(10, tokenInfo.decimals);
        const price = tokenPrices[o.sell_token_address?.toLowerCase()]?.price ?? 0;
        return sum + (remaining * price);
      }, 0);
  }, [dbOrders, tokenPrices]);

  // ── Filters ─────────────────────────────────────────────────────────────

  // Base filtered transactions (without date filter - used by chart)
  const baseFilteredTransactions = useMemo(() => {
    let result = transactions;
    if (selectedTokenFilters.length > 0) {
      const tokenAddrs = selectedTokenFilters.map(t => t.address.toLowerCase());
      result = result.filter(tx =>
        tokenAddrs.some(addr => tx.sellToken.toLowerCase() === addr ||
          Object.keys(tx.buyTokens).some(a => a.toLowerCase() === addr))
      );
    }
    if (selectedTraderFilters.length > 0) {
      const traderAddrs = selectedTraderFilters.map(a => a.toLowerCase());
      result = result.filter(tx => tx.buyer && traderAddrs.includes(tx.buyer.toLowerCase()));
    }
    if (addressSearch.trim()) {
      const query = addressSearch.toLowerCase().trim();
      result = result.filter(tx => tx.buyer?.toLowerCase().includes(query));
    }
    if (orderIdSearch.trim()) {
      const query = orderIdSearch.trim();
      result = result.filter(tx => tx.orderId === query);
    }
    return result;
  }, [transactions, selectedTokenFilters, selectedTraderFilters, addressSearch, orderIdSearch]);

  // Full filtered transactions (with date filter - used by everything except chart)
  const filteredTransactions = useMemo(() => {
    if (!selectedDateFilter) return baseFilteredTransactions;
    return baseFilteredTransactions.filter(tx => {
      if (!tx.timestamp) return false;
      return new Date(tx.timestamp * 1000).toISOString().split('T')[0] === selectedDateFilter;
    });
  }, [baseFilteredTransactions, selectedDateFilter]);

  const baseFilteredOrders = useMemo(() => {
    let result = orders;
    if (selectedTokenFilters.length > 0) {
      const tokenAddrs = selectedTokenFilters.map(t => t.address.toLowerCase());
      result = result.filter(order => tokenAddrs.includes(order.sellToken.toLowerCase()));
    }
    if (selectedTraderFilters.length > 0) {
      const traderAddrs = selectedTraderFilters.map(a => a.toLowerCase());
      result = result.filter(order => traderAddrs.includes(order.orderOwner.toLowerCase()));
    }
    if (addressSearch.trim()) {
      const query = addressSearch.toLowerCase().trim();
      result = result.filter(order => order.orderOwner.toLowerCase().includes(query));
    }
    if (orderIdSearch.trim()) {
      const query = orderIdSearch.trim();
      result = result.filter(order => order.orderId === query);
    }
    return result;
  }, [orders, selectedTokenFilters, selectedTraderFilters, addressSearch, orderIdSearch]);

  const filteredOrders = useMemo(() => {
    if (!selectedDateFilter) return baseFilteredOrders;
    return baseFilteredOrders.filter(order => {
      if (!order.timestamp) return false;
      return new Date(order.timestamp * 1000).toISOString().split('T')[0] === selectedDateFilter;
    });
  }, [baseFilteredOrders, selectedDateFilter]);

  const baseFilteredContractOrders = useMemo(() => {
    let result = contractOrders;
    if (selectedTokenFilters.length > 0) {
      const tokenAddrs = selectedTokenFilters.map(t => t.address.toLowerCase());
      result = result.filter(order =>
        tokenAddrs.includes(order.orderDetailsWithID.orderDetails.sellToken.toLowerCase()) ||
        order.orderDetailsWithID.orderDetails.buyTokensIndex.some((idx) => {
          const addr = whitelist[Number(idx)];
          return addr && tokenAddrs.includes(addr.toLowerCase());
        })
      );
    }
    if (selectedTraderFilters.length > 0) {
      const traderAddrs = selectedTraderFilters.map(a => a.toLowerCase());
      result = result.filter(order =>
        order.userDetails.orderOwner && traderAddrs.includes(order.userDetails.orderOwner.toLowerCase())
      );
    }
    if (addressSearch.trim()) {
      const query = addressSearch.toLowerCase().trim();
      result = result.filter(order =>
        order.userDetails.orderOwner?.toLowerCase().includes(query)
      );
    }
    if (orderIdSearch.trim()) {
      const query = orderIdSearch.trim();
      result = result.filter(order =>
        order.orderDetailsWithID.orderID.toString() === query
      );
    }
    return result;
  }, [contractOrders, selectedTokenFilters, selectedTraderFilters, whitelist, addressSearch, orderIdSearch]);

  const filteredContractOrders = useMemo(() => {
    if (!selectedDateFilter) return baseFilteredContractOrders;
    return baseFilteredContractOrders.filter(order => {
      const timestamp = Number(order.orderDetailsWithID.lastUpdateTime);
      if (!timestamp || timestamp <= 0) return false;
      return new Date(timestamp * 1000).toISOString().split('T')[0] === selectedDateFilter;
    });
  }, [baseFilteredContractOrders, selectedDateFilter]);

  const filteredActiveOrders = useMemo(() => {
    let result = activeOrders;
    if (selectedTokenFilters.length > 0) {
      const tokenAddrs = selectedTokenFilters.map(t => t.address.toLowerCase());
      result = result.filter(order =>
        tokenAddrs.includes(order.orderDetailsWithID.orderDetails.sellToken.toLowerCase()) ||
        order.orderDetailsWithID.orderDetails.buyTokensIndex.some((idx) => {
          const addr = whitelist[Number(idx)];
          return addr && tokenAddrs.includes(addr.toLowerCase());
        })
      );
    }
    if (selectedTraderFilters.length > 0) {
      const traderAddrs = selectedTraderFilters.map(a => a.toLowerCase());
      result = result.filter(order =>
        order.userDetails.orderOwner && traderAddrs.includes(order.userDetails.orderOwner.toLowerCase())
      );
    }
    if (addressSearch.trim()) {
      const query = addressSearch.toLowerCase().trim();
      result = result.filter(order =>
        order.userDetails.orderOwner?.toLowerCase().includes(query)
      );
    }
    if (orderIdSearch.trim()) {
      const query = orderIdSearch.trim();
      result = result.filter(order =>
        order.orderDetailsWithID.orderID.toString() === query
      );
    }
    if (selectedDateFilter) {
      result = result.filter(order => {
        const timestamp = Number(order.orderDetailsWithID.lastUpdateTime);
        if (!timestamp || timestamp <= 0) return false;
        return new Date(timestamp * 1000).toISOString().split('T')[0] === selectedDateFilter;
      });
    }
    return result;
  }, [activeOrders, selectedTokenFilters, selectedTraderFilters, whitelist, addressSearch, orderIdSearch, selectedDateFilter]);

  // ── Formatted data for tables ───────────────────────────────────────────

  const formattedOrders: FormattedOrder[] = useMemo(() => {
    return filteredContractOrders.map(order => {
      const orderDetails = order.orderDetailsWithID;
      const sellTokenInfo = getTokenInfo(orderDetails.orderDetails.sellToken);

      let buyTokenTicker = 'UNKNOWN';
      if (orderDetails.orderDetails.buyTokensIndex.length > 0) {
        const buyTokenInfo = getTokenInfoByIndex(Number(orderDetails.orderDetails.buyTokensIndex[0]));
        buyTokenTicker = buyTokenInfo.ticker;
      }

      const originalSellAmount = orderDetails.remainingSellAmount + orderDetails.redeemedSellAmount;
      const filledPercent = originalSellAmount > 0n
        ? Number((orderDetails.redeemedSellAmount * 100n) / originalSellAmount)
        : 0;

      let status: 'active' | 'completed' | 'cancelled' = 'active';
      if (orderDetails.status === 1) status = 'cancelled';
      if (orderDetails.status === 2) status = 'completed';

      const sellAmount = formatTokenAmount(
        orderDetails.remainingSellAmount + orderDetails.redeemedSellAmount,
        sellTokenInfo.decimals
      );

      let buyAmount = '0';
      let buyTokenAddress = '';
      let buyAmountNum = 0;
      if (orderDetails.orderDetails.buyAmounts.length > 0 && orderDetails.orderDetails.buyTokensIndex.length > 0) {
        const buyTokenInfo = getTokenInfoByIndex(Number(orderDetails.orderDetails.buyTokensIndex[0]));
        buyAmount = formatTokenAmount(orderDetails.orderDetails.buyAmounts[0], buyTokenInfo.decimals);
        buyTokenAddress = buyTokenInfo.address?.toLowerCase() || '';
        buyAmountNum = parseFloat(buyAmount);
      }

      const sellTokenAddress = orderDetails.orderDetails.sellToken.toLowerCase();
      const sellAmountNum = parseFloat(sellAmount);
      const sellUsd = sellAmountNum * (tokenPrices[sellTokenAddress]?.price ?? 0);
      const buyUsd = buyAmountNum * (tokenPrices[buyTokenAddress]?.price ?? 0);

      return {
        id: Number(orderDetails.orderID),
        maker: order.userDetails.orderOwner,
        sellToken: sellTokenInfo.ticker,
        sellTokenAddress,
        sellAmountNum,
        sellUsd,
        buyToken: buyTokenTicker,
        buyTokenAddress,
        buyAmountNum,
        buyUsd,
        sellAmount,
        buyAmount,
        status,
        filled: filledPercent,
        createdAt: formatTimestampDisplay(orderDetails.lastUpdateTime),
      };
    }).sort((a, b) => b.id - a.id);
  }, [filteredContractOrders, tokenPrices]);

  const formattedFills: FormattedFill[] = useMemo(
    () => dbFillsToFormattedFills(dbFills, dbOrders, tokenPrices),
    [dbFills, dbOrders, tokenPrices]
  );

  const filteredOrdersByStatus = useMemo(() => {
    let orders = formattedOrders;
    if (orderStatusFilter !== 'all') {
      orders = orders.filter(order => order.status === orderStatusFilter);
    }
    // Sort
    const dir = orderSortDir === 'asc' ? 1 : -1;
    orders = [...orders].sort((a, b) => {
      const av = a[orderSortKey];
      const bv = b[orderSortKey];
      if (typeof av === 'number' && typeof bv === 'number') return (av - bv) * dir;
      return String(av).localeCompare(String(bv)) * dir;
    });
    return orders;
  }, [formattedOrders, orderStatusFilter, orderSortKey, orderSortDir]);

  // Reset page when orders filter changes
  useEffect(() => { setOrderPage(1); }, [orderStatusFilter, addressSearch, orderIdSearch]);

  const filteredFills = useMemo(() => {
    let fills = formattedFills;

    if (selectedTokenFilters.length > 0) {
      const tokenAddrs = selectedTokenFilters.map(t => t.address.toLowerCase());
      fills = fills.filter(fill =>
        tokenAddrs.includes(fill.sellTokenAddress.toLowerCase()) || tokenAddrs.includes(fill.buyTokenAddress.toLowerCase())
      );
    }
    if (selectedTraderFilters.length > 0) {
      const traderAddrs = selectedTraderFilters.map(a => a.toLowerCase());
      fills = fills.filter(fill => traderAddrs.includes(fill.buyer.toLowerCase()));
    }
    if (addressSearch.trim()) {
      const query = addressSearch.toLowerCase().trim();
      fills = fills.filter(fill => fill.buyer.toLowerCase().includes(query));
    }
    if (orderIdSearch.trim()) {
      const query = orderIdSearch.trim();
      fills = fills.filter(fill => fill.orderId === query);
    }
    if (selectedDateFilter) {
      fills = fills.filter(fill => {
        if (!fill.timestamp) return false;
        return new Date(fill.timestamp * 1000).toISOString().split('T')[0] === selectedDateFilter;
      });
    }

    // Sort
    const dir = fillSortDir === 'asc' ? 1 : -1;
    fills = [...fills].sort((a, b) => {
      const av = a[fillSortKey];
      const bv = b[fillSortKey];
      if (typeof av === 'number' && typeof bv === 'number') return (av - bv) * dir;
      return String(av).localeCompare(String(bv)) * dir;
    });
    return fills;
  }, [formattedFills, selectedTokenFilters, selectedTraderFilters, addressSearch, orderIdSearch, selectedDateFilter, fillSortKey, fillSortDir]);

  // Reset page when fills filter changes
  useEffect(() => { setFillPage(1); }, [addressSearch, orderIdSearch]);

  const orderTotalPages = Math.max(1, Math.ceil(filteredOrdersByStatus.length / PAGE_SIZE));
  const paginatedOrders = filteredOrdersByStatus.slice((orderPage - 1) * PAGE_SIZE, orderPage * PAGE_SIZE);

  const fillTotalPages = Math.max(1, Math.ceil(filteredFills.length / PAGE_SIZE));
  const paginatedFills = filteredFills.slice((fillPage - 1) * PAGE_SIZE, fillPage * PAGE_SIZE);

  // ── Event handlers ──────────────────────────────────────────────────────

  const handleTokenFilterSelect = useCallback((address: string, ticker: string) => {
    setSelectedTokenFilters(prev => {
      const exists = prev.some(t => t.address.toLowerCase() === address.toLowerCase());
      if (exists) {
        return prev.filter(t => t.address.toLowerCase() !== address.toLowerCase());
      }
      return [...prev, { address, ticker }];
    });
  }, []);

  const handleTraderFilterSelect = useCallback((address: string) => {
    setSelectedTraderFilters(prev => {
      const exists = prev.some(a => a.toLowerCase() === address.toLowerCase());
      if (exists) {
        return prev.filter(a => a.toLowerCase() !== address.toLowerCase());
      }
      return [...prev, address];
    });
  }, []);

  // ── Ready state ─────────────────────────────────────────────────────────

  const hasPrices = Object.keys(tokenPrices).length > 0;
  const dataReady = !isLoading && (hasPrices || !pricesLoading);
  const hasData = dbOrders.length > 0 || dbFills.length > 0;

  // Trigger fade-in after data is ready (works even if data was preloaded)
  useEffect(() => {
    if (dataReady && hasData) {
      requestAnimationFrame(() => setPageVisible(true));
    }
  }, [dataReady, hasData]);

  return (
    <>
      <DisclaimerDialog open={showDisclaimer} onAccept={() => setShowDisclaimer(false)} />
      <LogoPreloader />
      <main className="flex min-h-screen flex-col items-center relative">
        {/* Animated background effect */}
        <div className="fixed inset-0 z-0">
          <PixelBlastBackground />
        </div>

        {/* Main Content */}
        <div className="w-full px-2 md:px-8 mt-2 pb-12 relative z-10">
          <div className="max-w-[1200px] mx-auto">
            {!dataReady ? (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="flex flex-col items-center justify-center py-20"
              >
                <PixelSpinner size={48} className="mb-6" />
                <p className="text-white text-lg mb-2">Loading Protocol Data</p>
                <p className="text-gray-400 text-sm">
                  {isLoading ? 'Fetching from database...' : pricesLoading ? 'Fetching token prices...' : 'Finalizing...'}
                </p>
              </motion.div>
            ) : error ? (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="text-center py-20"
              >
                <p className="text-red-400 text-lg">Failed to load data</p>
                <p className="text-gray-500 text-sm mt-2">{error}</p>
                <button
                  onClick={fetchData}
                  className="mt-4 px-4 py-2 bg-white/10 text-white rounded hover:bg-white/20 transition-colors"
                >
                  Retry
                </button>
              </motion.div>
            ) : !hasData ? (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="text-center py-20"
              >
                <p className="text-gray-400 text-lg">No trading data available yet</p>
                <p className="text-gray-500 text-sm mt-2">Stats will appear once orders are placed and filled</p>
              </motion.div>
            ) : (
              <div
                style={{ opacity: pageVisible ? 1 : 0, transition: 'opacity 0.6s ease-out' }}
                className="space-y-6"
              >
                {/* Filter Bar - sticky when any filter is active */}
                <div className={`${(selectedTokenFilters.length > 0 || selectedTraderFilters.length > 0 || addressSearch || orderIdSearch || selectedDateFilter) ? 'sticky top-[72px] z-30' : ''}`}>
                  <div className="flex flex-wrap items-center gap-3 p-3 bg-black/95 backdrop-blur-md border border-white/10 rounded-lg shadow-lg">
                    {/* Active filter pills */}
                    {(selectedTokenFilters.length > 0 || selectedTraderFilters.length > 0 || selectedDateFilter) && (
                      <>
                        <span className="text-gray-400 text-sm">Filtering by:</span>
                        {selectedTokenFilters.map(token => (
                          <div key={token.address} className="flex items-center gap-2 px-2 py-1 bg-white/10 rounded">
                            <CoinLogo symbol={token.ticker} size="sm" />
                            <span className="text-white font-medium">{formatTokenTicker(token.ticker)}</span>
                            <button
                              onClick={() => handleTokenFilterSelect(token.address, token.ticker)}
                              className="text-gray-400 hover:text-white transition-colors"
                            >
                              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                              </svg>
                            </button>
                          </div>
                        ))}
                        {selectedTraderFilters.map(trader => (
                          <div key={trader} className="flex items-center gap-2 px-2 py-1 bg-white/10 rounded">
                            <span className="text-white font-mono text-sm">
                              {trader.slice(0, 6)}...{trader.slice(-4)}
                            </span>
                            <button
                              onClick={() => handleTraderFilterSelect(trader)}
                              className="text-gray-400 hover:text-white transition-colors"
                            >
                              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                              </svg>
                            </button>
                          </div>
                        ))}
                        {selectedDateFilter && (
                          <div className="flex items-center gap-2 px-2 py-1 bg-white/10 rounded">
                            <svg className="w-3.5 h-3.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                            </svg>
                            <span className="text-white font-medium text-sm">
                              {new Date(selectedDateFilter + 'T00:00:00Z').toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' })}
                            </span>
                            <button
                              onClick={() => setSelectedDateFilter(null)}
                              className="text-gray-400 hover:text-white transition-colors"
                            >
                              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                              </svg>
                            </button>
                          </div>
                        )}
                      </>
                    )}

                    {/* Search inputs */}
                    <div className="flex items-center gap-2 ml-auto min-w-0">
                      <input
                        type="text"
                        placeholder="Address..."
                        value={addressSearch}
                        onChange={(e) => setAddressSearch(e.target.value)}
                        className="bg-white/5 border border-white/10 rounded px-3 py-1.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-white/30 font-mono w-[140px] md:w-[380px]"
                      />
                      <input
                        type="text"
                        placeholder="Order ID."
                        value={orderIdSearch}
                        onChange={(e) => setOrderIdSearch(e.target.value)}
                        className="bg-white/5 border border-white/10 rounded px-3 py-1.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-white/30 font-mono w-[80px] md:w-[110px] shrink-0"
                      />
                      {(selectedTokenFilters.length > 0 || selectedTraderFilters.length > 0 || addressSearch || orderIdSearch || selectedDateFilter) && (
                        <button
                          onClick={() => {
                            setSelectedTokenFilters([]);
                            setSelectedTraderFilters([]);
                            setAddressSearch('');
                            setOrderIdSearch('');
                            setSelectedDateFilter(null);
                          }}
                          className="flex items-center gap-1 px-3 py-1.5 text-sm text-gray-400 hover:text-white hover:bg-white/10 rounded transition-colors whitespace-nowrap"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                          Clear all
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                {/* Overview Stats Cards */}
                <StatsOverviewCards
                  transactions={filteredTransactions}
                  orders={filteredOrders}
                  tokenPrices={tokenPrices}
                  contractOrders={filteredContractOrders}
                  activeOrders={filteredActiveOrders}
                  dbTvl={(selectedTokenFilters.length > 0 || selectedTraderFilters.length > 0 || addressSearch || orderIdSearch) ? undefined : dbTvl}
                />

                {/* Protocol Activity Chart */}
                <ProtocolActivityChart
                  transactions={baseFilteredTransactions}
                  orders={baseFilteredOrders}
                  contractOrders={baseFilteredContractOrders}
                  tokenPrices={tokenPrices}
                  selectedDate={selectedDateFilter}
                  onDateSelect={setSelectedDateFilter}
                />

                {/* Top Tokens Chart */}
                <TopTokensChart
                  transactions={(addressSearch || orderIdSearch) ? filteredTransactions : transactions}
                  orders={(addressSearch || orderIdSearch) ? filteredOrders : orders}
                  tokenPrices={tokenPrices}
                  contractOrders={(addressSearch || orderIdSearch) ? filteredContractOrders : contractOrders}
                  onTokenSelect={handleTokenFilterSelect}
                  selectedTokens={selectedTokenFilters.map(t => t.address)}
                />

                {/* Leaderboard */}
                <TopTradersLeaderboard
                  transactions={(addressSearch || orderIdSearch) ? filteredTransactions : transactions}
                  orders={(addressSearch || orderIdSearch) ? filteredOrders : orders}
                  tokenPrices={tokenPrices}
                  contractOrders={(addressSearch || orderIdSearch) ? filteredContractOrders : contractOrders}
                  onTraderClick={handleTraderFilterSelect}
                  selectedTraders={selectedTraderFilters}
                  searchQuery={addressSearch || orderIdSearch}
                />

                {/* Hourly Activity Heatmap - hidden for now */}
                {/* <HourlyActivityChart
                  transactions={filteredTransactions}
                  orders={filteredOrders}
                  contractOrders={filteredContractOrders}
                /> */}

                {/* All Orders Table */}
                <div>
                  <h2 className="text-2xl font-bold text-white mb-4">Orders</h2>

                  {/* Order Filters */}
                  <div className="flex flex-wrap items-center gap-2 mb-4">
                    {(['all', 'active', 'completed', 'cancelled'] as const).map((filter) => (
                      <button
                        key={filter}
                        onClick={() => setOrderStatusFilter(filter)}
                        className={`px-4 py-2 rounded-lg font-medium transition-all capitalize ${
                          orderStatusFilter === filter
                            ? 'bg-white/10 text-white border border-white/20'
                            : 'bg-transparent text-gray-400 border border-transparent hover:bg-white/10 hover:text-white'
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
                    className="p-4 md:p-6 !overflow-x-auto"
                  >
                    <div className="overflow-x-auto -mx-4 md:-mx-6 px-4 md:px-6 pb-2 modern-scrollbar">
                      <table className="w-full min-w-[700px]">
                        <thead>
                          <tr className="border-b border-white/10">
                            {([
                              ['id', 'ID'],
                              ['maker', 'Seller'],
                              [null, 'Pair'],
                              ['sellUsd', 'Sell Amount'],
                              ['buyUsd', 'Buy Amount'],
                              ['filled', 'Filled'],
                              ['status', 'Status'],
                              ['createdAt', 'Creation Date'],
                              [null, ''],
                            ] as const).map(([key, label], i) => (
                              <th
                                key={i}
                                className={`text-center py-3 px-2 text-gray-400 font-medium text-sm whitespace-nowrap ${key ? 'cursor-pointer hover:text-white select-none' : ''}`}
                                onClick={() => key && toggleOrderSort(key as typeof orderSortKey)}
                              >
                                {label}
                                {key && orderSortKey === key && (
                                  <span className="ml-1 text-white/60">{orderSortDir === 'asc' ? '▲' : '▼'}</span>
                                )}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {paginatedOrders.length === 0 ? (
                            <tr>
                              <td colSpan={9} className="py-8 text-center text-gray-500">
                                No orders found with this filter.
                              </td>
                            </tr>
                          ) : (
                            paginatedOrders.map((order) => {
                              const isCurrentUser = connectedAddress?.toLowerCase() === order.maker.toLowerCase();
                              const statusColors = getStatusColor(order.status);
                              const sellUsd = order.sellUsd;
                              const buyUsd = order.buyUsd;

                              const href = isCurrentUser
                                ? `/my-orders?orderId=${order.id}`
                                : `/marketplace?order-id=${order.id}`;

                              return (
                                <tr
                                  key={order.id}
                                  className={`border-b border-white/5 transition-colors ${
                                    isCurrentUser ? 'bg-white/5 hover:bg-white/10' : 'hover:bg-white/5'
                                  }`}
                                >
                                  <td className="py-4 px-2 text-center">
                                    <span
                                      className={`text-sm px-2.5 py-1 rounded-full inline-block cursor-pointer hover:opacity-80 transition-opacity ${
                                        orderIdSearch === order.id.toString() ? 'bg-white text-black font-medium' : 'text-gray-400 bg-white/5 border border-white/10'
                                      }`}
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        const idStr = order.id.toString();
                                        const toggle = orderIdSearch === idStr ? '' : idStr;
                                        setOrderIdSearch(toggle);
                                      }}
                                    >
                                      #{order.id}
                                    </span>
                                  </td>
                                  <td className="py-4 px-2 text-center">
                                    {(() => {
                                      const color = getBuyerColor(order.maker);
                                      return (
                                        <div className="flex items-center gap-2">
                                          <span
                                            className="font-mono text-xs px-2.5 py-1 rounded-full inline-block cursor-pointer hover:opacity-80 transition-opacity"
                                            style={{ backgroundColor: color.bg, color: color.text, border: `1px solid ${color.border}` }}
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              const toggle = addressSearch.toLowerCase() === order.maker.toLowerCase() ? '' : order.maker;
                                              setAddressSearch(toggle);
                                            }}
                                          >
                                            {formatAddress(order.maker)}
                                          </span>
                                          {isCurrentUser && (
                                            <span className="text-xs bg-white/10 px-2 py-0.5 rounded text-gray-300">You</span>
                                          )}
                                        </div>
                                      );
                                    })()}
                                  </td>
                                  <td className="py-4 px-2 text-center">
                                    <div className="flex items-center justify-center gap-1.5">
                                      <div className="w-6 h-6 rounded-full bg-white/10 flex items-center justify-center overflow-hidden">
                                        <CoinLogo symbol={order.sellToken} size="sm" />
                                      </div>
                                      <span className="text-white/40 text-xs">→</span>
                                      <div className="w-6 h-6 rounded-full bg-white/10 flex items-center justify-center overflow-hidden">
                                        <CoinLogo symbol={order.buyToken} size="sm" />
                                      </div>
                                    </div>
                                  </td>
                                  <td className="py-4 px-2 text-center">
                                    <div className="flex flex-col items-center">
                                      <span className="text-white text-sm font-medium whitespace-nowrap">
                                        {sellUsd > 0 ? `$${formatDisplayAmount(sellUsd.toString())}` : '--'}
                                      </span>
                                      <span className="text-gray-500 text-xs whitespace-nowrap">
                                        {formatDisplayAmount(order.sellAmount)} {formatTokenTicker(order.sellToken)}
                                      </span>
                                    </div>
                                  </td>
                                  <td className="py-4 px-2 text-center">
                                    <div className="flex flex-col items-center">
                                      <span className="text-white text-sm font-medium whitespace-nowrap">
                                        {buyUsd > 0 ? `$${formatDisplayAmount(buyUsd.toString())}` : '--'}
                                      </span>
                                      <span className="text-gray-500 text-xs whitespace-nowrap">
                                        {formatDisplayAmount(order.buyAmount)} {formatTokenTicker(order.buyToken)}
                                      </span>
                                    </div>
                                  </td>
                                  <td className="py-4 px-2 text-center">
                                    <span className="text-gray-400 text-sm">{order.filled}%</span>
                                  </td>
                                  <td className="py-4 px-2 text-center">
                                    <span className={`text-xs px-2 py-1 rounded capitalize ${statusColors}`}>
                                      {order.status}
                                    </span>
                                  </td>
                                  <td className="py-4 px-2 text-center">
                                    <span className="text-gray-500 text-sm whitespace-nowrap">{order.createdAt}</span>
                                  </td>
                                  <td className="py-4 px-2 text-center">
                                    <a
                                      href={href}
                                      className="inline-flex items-center gap-1.5 px-3 py-1 bg-white/10 hover:bg-white/20 border border-white/20 rounded-full text-white text-xs font-medium transition-colors"
                                      onClick={(e) => e.stopPropagation()}
                                    >
                                      See Order
                                      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-3 h-3">
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                                      </svg>
                                    </a>
                                  </td>
                                </tr>
                              );
                            })
                          )}
                        </tbody>
                      </table>
                    </div>
                  </LiquidGlassCard>
                  {orderTotalPages > 1 && (
                    <div className="flex items-center justify-end mt-4">
                      <Pagination>
                        <PaginationContent>
                          <PaginationItem>
                            <PaginationPrevious
                              className={orderPage <= 1 ? 'pointer-events-none opacity-40' : 'cursor-pointer'}
                              onClick={() => setOrderPage(p => Math.max(1, p - 1))}
                            />
                          </PaginationItem>
                          {Array.from({ length: Math.min(5, orderTotalPages) }, (_, i) => {
                            let page: number;
                            if (orderTotalPages <= 5) {
                              page = i + 1;
                            } else if (orderPage <= 3) {
                              page = i + 1;
                            } else if (orderPage >= orderTotalPages - 2) {
                              page = orderTotalPages - 4 + i;
                            } else {
                              page = orderPage - 2 + i;
                            }
                            return (
                              <PaginationItem key={page}>
                                <PaginationLink
                                  isActive={page === orderPage}
                                  className="cursor-pointer"
                                  onClick={() => setOrderPage(page)}
                                >
                                  {page}
                                </PaginationLink>
                              </PaginationItem>
                            );
                          })}
                          <PaginationItem>
                            <PaginationNext
                              className={orderPage >= orderTotalPages ? 'pointer-events-none opacity-40' : 'cursor-pointer'}
                              onClick={() => setOrderPage(p => Math.min(orderTotalPages, p + 1))}
                            />
                          </PaginationItem>
                        </PaginationContent>
                      </Pagination>
                    </div>
                  )}
                </div>

                {/* All Fills Table */}
                <div>
                  <div className="flex flex-wrap items-center gap-2 mb-4">
                    <h2 className="text-2xl font-bold text-white">Fill Events</h2>
                  </div>
                  <LiquidGlassCard
                    shadowIntensity="sm"
                    glowIntensity="sm"
                    blurIntensity="xl"
                    className="p-4 md:p-6 !overflow-x-auto"
                  >
                    <div className="overflow-x-auto -mx-4 md:-mx-6 px-4 md:px-6 pb-2 modern-scrollbar">
                      <table className="w-full min-w-[800px]">
                        <thead>
                          <tr className="border-b border-white/10">
                            {([
                              ['orderId', 'Order'],
                              ['buyer', 'Buyer'],
                              [null, 'Pair'],
                              ['sellUsd', 'Sold'],
                              ['buyUsd', 'Bought'],
                              ['fillPercentage', 'Filled'],
                              ['orderStatus', 'Status'],
                              ['timestamp', 'Fill Date'],
                              [null, 'Tx'],
                            ] as const).map(([key, label], i) => (
                              <th
                                key={i}
                                className={`text-center py-3 px-2 text-gray-400 font-medium text-sm whitespace-nowrap ${key ? 'cursor-pointer hover:text-white select-none' : ''}`}
                                onClick={() => key && toggleFillSort(key as typeof fillSortKey)}
                              >
                                {label}
                                {key && fillSortKey === key && (
                                  <span className="ml-1 text-white/60">{fillSortDir === 'asc' ? '▲' : '▼'}</span>
                                )}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {paginatedFills.length === 0 ? (
                            <tr>
                              <td colSpan={9} className="py-8 text-center text-gray-500">
                                No fills found.
                              </td>
                            </tr>
                          ) : (
                            paginatedFills.map((fill, idx) => {
                              const sellUsd = fill.sellUsd;
                              const buyUsd = fill.buyUsd;
                              return (
                              <tr key={`${fill.txHash}-${idx}`} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                                <td className="py-4 px-2 text-center">
                                  <span
                                    className={`text-sm px-2.5 py-1 rounded-full inline-block cursor-pointer hover:opacity-80 transition-opacity ${
                                      orderIdSearch === fill.orderId.toString() ? 'bg-white text-black font-medium' : 'text-gray-400 bg-white/5 border border-white/10'
                                    }`}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      const idStr = fill.orderId.toString();
                                      const toggle = orderIdSearch === idStr ? '' : idStr;
                                      setOrderIdSearch(toggle);
                                    }}
                                  >
                                    #{fill.orderId}
                                  </span>
                                </td>
                                <td className="py-4 px-2 text-center">
                                  {(() => {
                                    const color = getBuyerColor(fill.buyer);
                                    return (
                                      <span
                                        className="font-mono text-xs px-2.5 py-1 rounded-full inline-block cursor-pointer hover:opacity-80 transition-opacity"
                                        style={{ backgroundColor: color.bg, color: color.text, border: `1px solid ${color.border}` }}
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          const toggle = addressSearch.toLowerCase() === fill.buyer.toLowerCase() ? '' : fill.buyer;
                                          setAddressSearch(toggle);
                                        }}
                                      >
                                        {formatAddress(fill.buyer)}
                                      </span>
                                    );
                                  })()}
                                </td>
                                <td className="py-4 px-2 text-center">
                                  <div className="flex items-center justify-center gap-1.5">
                                    <div className="w-6 h-6 rounded-full bg-white/10 flex items-center justify-center overflow-hidden">
                                      <CoinLogo symbol={fill.sellToken} size="sm" />
                                    </div>
                                    <span className="text-white/40 text-xs">→</span>
                                    <div className="w-6 h-6 rounded-full bg-white/10 flex items-center justify-center overflow-hidden">
                                      <CoinLogo symbol={fill.buyToken} size="sm" />
                                    </div>
                                  </div>
                                </td>
                                <td className="py-4 px-2 text-center">
                                  <div className="flex flex-col items-center">
                                    <span className="text-white text-sm font-medium whitespace-nowrap">
                                      {sellUsd > 0 ? `$${formatDisplayAmount(sellUsd.toString())}` : '--'}
                                    </span>
                                    <span className="text-gray-500 text-xs whitespace-nowrap">
                                      {formatDisplayAmount(fill.sellAmountNum.toString())} {formatTokenTicker(fill.sellToken)}
                                    </span>
                                  </div>
                                </td>
                                <td className="py-4 px-2 text-center">
                                  <div className="flex flex-col items-center">
                                    <span className="text-white text-sm font-medium whitespace-nowrap">
                                      {buyUsd > 0 ? `$${formatDisplayAmount(buyUsd.toString())}` : '--'}
                                    </span>
                                    <span className="text-gray-500 text-xs whitespace-nowrap">
                                      {formatDisplayAmount(fill.buyAmountNum.toString())} {formatTokenTicker(fill.buyToken)}
                                    </span>
                                  </div>
                                </td>
                                <td className="py-4 px-2 text-center">
                                  <span className={`text-sm ${fill.fillPercentage >= 100 ? 'text-green-400' : 'text-gray-400'}`}>
                                    {fill.fillPercentage}%
                                  </span>
                                </td>
                                <td className="py-4 px-2 text-center">
                                  <span className={`text-xs px-2 py-1 rounded capitalize ${getStatusColor(fill.orderStatus)}`}>
                                    {fill.orderStatus}
                                  </span>
                                </td>
                                <td className="py-4 px-2 text-center">
                                  <span className="text-gray-500 text-sm whitespace-nowrap">
                                    {fill.timestamp ? (() => {
                                      const d = new Date(fill.timestamp * 1000);
                                      const time = d.toLocaleString('en-US', { hour: '2-digit', minute: '2-digit', timeZone: 'UTC' });
                                      const date = d.toLocaleString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
                                      return `${time} UTC, ${date}`;
                                    })() : '-'}
                                  </span>
                                </td>
                                <td className="py-4 px-2 text-center">
                                  <a
                                    href={`https://otter.pulsechain.com/tx/${fill.txHash}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex items-center gap-1.5 px-3 py-1 bg-white/10 hover:bg-white/20 border border-white/20 rounded-full text-white text-xs font-medium transition-colors"
                                    onClick={(e) => e.stopPropagation()}
                                  >
                                    View Tx
                                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-3 h-3">
                                      <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                                    </svg>
                                  </a>
                                </td>
                              </tr>
                              );
                            })
                          )}
                        </tbody>
                      </table>
                    </div>
                  </LiquidGlassCard>
                  {fillTotalPages > 1 && (
                    <div className="flex items-center justify-end mt-4">
                      <Pagination>
                        <PaginationContent>
                          <PaginationItem>
                            <PaginationPrevious
                              className={fillPage <= 1 ? 'pointer-events-none opacity-40' : 'cursor-pointer'}
                              onClick={() => setFillPage(p => Math.max(1, p - 1))}
                            />
                          </PaginationItem>
                          {Array.from({ length: Math.min(5, fillTotalPages) }, (_, i) => {
                            let page: number;
                            if (fillTotalPages <= 5) {
                              page = i + 1;
                            } else if (fillPage <= 3) {
                              page = i + 1;
                            } else if (fillPage >= fillTotalPages - 2) {
                              page = fillTotalPages - 4 + i;
                            } else {
                              page = fillPage - 2 + i;
                            }
                            return (
                              <PaginationItem key={page}>
                                <PaginationLink
                                  isActive={page === fillPage}
                                  className="cursor-pointer"
                                  onClick={() => setFillPage(page)}
                                >
                                  {page}
                                </PaginationLink>
                              </PaginationItem>
                            );
                          })}
                          <PaginationItem>
                            <PaginationNext
                              className={fillPage >= fillTotalPages ? 'pointer-events-none opacity-40' : 'cursor-pointer'}
                              onClick={() => setFillPage(p => Math.min(fillTotalPages, p + 1))}
                            />
                          </PaginationItem>
                        </PaginationContent>
                      </Pagination>
                    </div>
                  )}
                </div>

                {/* Order Book */}
                {filteredActiveOrders.length > 0 && whitelist.length > 0 && (
                  <OrderbookChart
                    orders={filteredActiveOrders}
                    tokenPrices={tokenPrices}
                    whitelist={whitelist}
                  />
                )}

              </div>
            )}
          </div>
        </div>
      </main>
    </>
  );
}
