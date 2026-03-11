'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useAccount } from 'wagmi';
import { motion } from 'framer-motion';
import { DisclaimerDialog } from '@/components/DisclaimerDialog';
import { PixelSpinner } from '@/components/ui/PixelSpinner';
import { LogoPreloader } from '@/components/LogoPreloader';
import PixelBlastBackground from '@/components/ui/PixelBlastBackground';
import StatsOverviewCards from '@/components/stats/StatsOverviewCards';
import TopTokensChart from '@/components/stats/TopTokensChart';
import ProtocolActivityChart from '@/components/stats/ProtocolActivityChart';
import HourlyActivityChart from '@/components/stats/HourlyActivityChart';
import OrderbookChart from '@/components/stats/OrderbookChart';
import TopTradersLeaderboard from '@/components/stats/TopTradersLeaderboard';
import { useTokenPrices } from '@/hooks/crypto/useTokenPrices';
import { useContractWhitelistRead } from '@/hooks/contracts/useContractWhitelistRead';
import { getTokenInfo, getTokenInfoByIndex, formatTokenAmount, formatTokenTicker } from '@/utils/tokenUtils';
import { useOpenPositions, CompleteOrderDetails } from '@/hooks/contracts/useOpenPositions';
import { LiquidGlassCard } from '@/components/ui/liquid-glass';
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
  buyToken: string;
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
  buyToken: string;
  buyTokenAddress: string;
  buyAmountNum: number;
  timestamp: number;
  txHash: string;
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
  let hash = 0;
  for (let i = 0; i < address.length; i++) {
    hash = ((hash << 5) - hash + address.charCodeAt(i)) | 0;
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

function dbFillsToFormattedFills(dbFills: DbFill[], dbOrders: DbOrder[]): FormattedFill[] {
  const orderMap = new Map<number, DbOrder>();
  dbOrders.forEach(o => orderMap.set(o.order_id, o));

  return dbFills.map(fill => {
    const order = orderMap.get(fill.order_id);
    const sellTokenAddr = order?.sell_token_address?.toLowerCase() || '';
    const buyTokenAddr = fill.buy_token_address?.toLowerCase() || '';
    const sellTokenInfo = getTokenInfo(sellTokenAddr);

    let sellAmountNum = 0;
    if (order) {
      const matchIdx = (order.buy_tokens_addresses || []).findIndex(
        addr => addr?.toLowerCase() === buyTokenAddr
      );
      if (matchIdx >= 0 && order.buy_amounts_raw?.[matchIdx]) {
        const originalBuyAmountRaw = Number(order.buy_amounts_raw[matchIdx]);
        if (originalBuyAmountRaw > 0) {
          const ratio = Number(fill.buy_amount_raw) / originalBuyAmountRaw;
          sellAmountNum = (Number(order.sell_amount_raw) * ratio) / Math.pow(10, sellTokenInfo.decimals);
        }
      }
    }

    return {
      orderId: fill.order_id.toString(),
      buyer: fill.filler_address || '',
      sellToken: order?.sell_token_ticker || 'UNKNOWN',
      sellTokenAddress: sellTokenAddr,
      sellAmountNum,
      buyToken: fill.buy_token_ticker || 'UNKNOWN',
      buyTokenAddress: buyTokenAddr,
      buyAmountNum: fill.buy_amount_formatted || 0,
      timestamp: fill.filled_at ? Math.floor(new Date(fill.filled_at).getTime() / 1000) : 0,
      txHash: fill.tx_hash || '',
    };
  }).sort((a, b) => b.timestamp - a.timestamp);
}

// ── Page Component ──────────────────────────────────────────────────────────

export default function Stats2Page() {
  const [showDisclaimer, setShowDisclaimer] = useState(false);
  const { address: connectedAddress } = useAccount();

  const [dbOrders, setDbOrders] = useState<DbOrder[]>([]);
  const [dbFills, setDbFills] = useState<DbFill[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [hasLoadedOnce, setHasLoadedOnce] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [selectedTokenFilter, setSelectedTokenFilter] = useState<{ address: string; ticker: string } | null>(null);
  const [selectedTraderFilter, setSelectedTraderFilter] = useState<string | null>(null);
  const [orderStatusFilter, setOrderStatusFilter] = useState<'all' | 'active' | 'completed' | 'cancelled'>('all');

  // Live active orders from contract for accurate TVL and orderbook
  const { activeOrders: liveActiveOrders } = useOpenPositions();

  // Get whitelist for token index lookups
  const { activeTokens } = useContractWhitelistRead();
  const whitelist = useMemo(() =>
    activeTokens.map(t => t.tokenAddress.toLowerCase()),
    [activeTokens]
  );

  // ── Fetch data from Supabase API ────────────────────────────────────────

  const fetchData = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const res = await fetch('/api/v1/stats/protocol-data');
      if (!res.ok) throw new Error(`API error: ${res.status}`);
      const json = await res.json();
      if (!json.success) throw new Error(json.message || 'API returned error');
      setDbOrders(json.data.orders || []);
      setDbFills(json.data.fills || []);
      setHasLoadedOnce(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load data');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

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
    () => liveActiveOrders.length > 0
      ? liveActiveOrders
      : contractOrders.filter(o => o.orderDetailsWithID.status === 0),
    [liveActiveOrders, contractOrders]
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

  // ── Filters ─────────────────────────────────────────────────────────────

  const filteredTransactions = useMemo(() => {
    let result = transactions;
    if (selectedTokenFilter) {
      const tokenAddr = selectedTokenFilter.address.toLowerCase();
      result = result.filter(tx =>
        tx.sellToken.toLowerCase() === tokenAddr ||
        Object.keys(tx.buyTokens).some(addr => addr.toLowerCase() === tokenAddr)
      );
    }
    if (selectedTraderFilter) {
      const traderAddr = selectedTraderFilter.toLowerCase();
      result = result.filter(tx => tx.buyer?.toLowerCase() === traderAddr);
    }
    return result;
  }, [transactions, selectedTokenFilter, selectedTraderFilter]);

  const filteredOrders = useMemo(() => {
    let result = orders;
    if (selectedTokenFilter) {
      const tokenAddr = selectedTokenFilter.address.toLowerCase();
      result = result.filter(order => order.sellToken.toLowerCase() === tokenAddr);
    }
    if (selectedTraderFilter) {
      const traderAddr = selectedTraderFilter.toLowerCase();
      result = result.filter(order => order.orderOwner.toLowerCase() === traderAddr);
    }
    return result;
  }, [orders, selectedTokenFilter, selectedTraderFilter]);

  const filteredContractOrders = useMemo(() => {
    let result = contractOrders;
    if (selectedTokenFilter) {
      const tokenAddr = selectedTokenFilter.address.toLowerCase();
      result = result.filter(order =>
        order.orderDetailsWithID.orderDetails.sellToken.toLowerCase() === tokenAddr ||
        order.orderDetailsWithID.orderDetails.buyTokensIndex.some((idx) => {
          const addr = whitelist[Number(idx)];
          return addr && addr.toLowerCase() === tokenAddr;
        })
      );
    }
    if (selectedTraderFilter) {
      const traderAddr = selectedTraderFilter.toLowerCase();
      result = result.filter(order =>
        order.userDetails.orderOwner?.toLowerCase() === traderAddr
      );
    }
    return result;
  }, [contractOrders, selectedTokenFilter, selectedTraderFilter, whitelist]);

  const filteredActiveOrders = useMemo(() => {
    let result = activeOrders;
    if (selectedTokenFilter) {
      const tokenAddr = selectedTokenFilter.address.toLowerCase();
      result = result.filter(order =>
        order.orderDetailsWithID.orderDetails.sellToken.toLowerCase() === tokenAddr ||
        order.orderDetailsWithID.orderDetails.buyTokensIndex.some((idx) => {
          const addr = whitelist[Number(idx)];
          return addr && addr.toLowerCase() === tokenAddr;
        })
      );
    }
    if (selectedTraderFilter) {
      const traderAddr = selectedTraderFilter.toLowerCase();
      result = result.filter(order =>
        order.userDetails.orderOwner?.toLowerCase() === traderAddr
      );
    }
    return result;
  }, [activeOrders, selectedTokenFilter, selectedTraderFilter, whitelist]);

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
      if (orderDetails.orderDetails.buyAmounts.length > 0 && orderDetails.orderDetails.buyTokensIndex.length > 0) {
        const buyTokenInfo = getTokenInfoByIndex(Number(orderDetails.orderDetails.buyTokensIndex[0]));
        buyAmount = formatTokenAmount(orderDetails.orderDetails.buyAmounts[0], buyTokenInfo.decimals);
      }

      return {
        id: Number(orderDetails.orderID),
        maker: order.userDetails.orderOwner,
        sellToken: sellTokenInfo.ticker,
        buyToken: buyTokenTicker,
        sellAmount,
        buyAmount,
        status,
        filled: filledPercent,
        createdAt: formatTimestampDisplay(orderDetails.lastUpdateTime),
      };
    }).sort((a, b) => b.id - a.id);
  }, [filteredContractOrders]);

  const formattedFills: FormattedFill[] = useMemo(
    () => dbFillsToFormattedFills(dbFills, dbOrders),
    [dbFills, dbOrders]
  );

  const filteredOrdersByStatus = useMemo(() => {
    if (orderStatusFilter === 'all') return formattedOrders;
    return formattedOrders.filter(order => order.status === orderStatusFilter);
  }, [formattedOrders, orderStatusFilter]);

  // ── Event handlers ──────────────────────────────────────────────────────

  const handleTokenFilterSelect = useCallback((address: string, ticker: string) => {
    if (selectedTokenFilter?.address.toLowerCase() === address.toLowerCase()) {
      setSelectedTokenFilter(null);
    } else {
      setSelectedTokenFilter({ address, ticker });
    }
  }, [selectedTokenFilter]);

  // ── Ready state ─────────────────────────────────────────────────────────

  const dataReady = hasLoadedOnce || (!isLoading && !pricesLoading);
  const hasData = dbOrders.length > 0 || dbFills.length > 0;

  return (
    <>
      <DisclaimerDialog open={showDisclaimer} onAccept={() => setShowDisclaimer(false)} />
      <LogoPreloader />
      <main className="flex min-h-screen flex-col items-center relative">
        {/* Animated background effect */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: dataReady ? 1 : 0 }}
          transition={{ duration: 1.2, delay: 0.3, ease: [0.23, 1, 0.32, 1] }}
          className="fixed inset-0 z-0"
        >
          <PixelBlastBackground />
        </motion.div>

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
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.5, delay: 0.2 }}
                className="space-y-6"
              >
                {/* Filter Indicator */}
                {(selectedTokenFilter || selectedTraderFilter) && (
                  <div className="flex flex-wrap items-center gap-3 p-3 bg-white/5 border border-white/10 rounded-lg">
                    <span className="text-gray-400 text-sm">Filtering by:</span>
                    {selectedTokenFilter && (
                      <div className="flex items-center gap-2 px-2 py-1 bg-white/10 rounded">
                        <CoinLogo symbol={selectedTokenFilter.ticker} size="sm" />
                        <span className="text-white font-medium">{formatTokenTicker(selectedTokenFilter.ticker)}</span>
                        <button
                          onClick={() => setSelectedTokenFilter(null)}
                          className="text-gray-400 hover:text-white transition-colors"
                        >
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </div>
                    )}
                    {selectedTraderFilter && (
                      <div className="flex items-center gap-2 px-2 py-1 bg-white/10 rounded">
                        <span className="text-white font-mono text-sm">
                          {selectedTraderFilter.slice(0, 6)}...{selectedTraderFilter.slice(-4)}
                        </span>
                        <button
                          onClick={() => setSelectedTraderFilter(null)}
                          className="text-gray-400 hover:text-white transition-colors"
                        >
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </div>
                    )}
                    <button
                      onClick={() => {
                        setSelectedTokenFilter(null);
                        setSelectedTraderFilter(null);
                      }}
                      className="ml-auto flex items-center gap-1 px-3 py-1 text-sm text-gray-400 hover:text-white hover:bg-white/10 rounded transition-colors"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                      Clear all
                    </button>
                  </div>
                )}

                {/* Overview Stats Cards */}
                <StatsOverviewCards
                  transactions={filteredTransactions}
                  orders={filteredOrders}
                  tokenPrices={tokenPrices}
                  contractOrders={filteredContractOrders}
                  activeOrders={filteredActiveOrders}
                />

                {/* Protocol Activity Chart */}
                <ProtocolActivityChart
                  transactions={filteredTransactions}
                  orders={filteredOrders}
                  contractOrders={filteredContractOrders}
                  tokenPrices={tokenPrices}
                />

                {/* Top Tokens Chart */}
                <TopTokensChart
                  transactions={transactions}
                  orders={orders}
                  tokenPrices={tokenPrices}
                  contractOrders={contractOrders}
                  onTokenSelect={handleTokenFilterSelect}
                  selectedToken={selectedTokenFilter?.address}
                />

                {/* Leaderboard */}
                <TopTradersLeaderboard
                  transactions={transactions}
                  orders={orders}
                  tokenPrices={tokenPrices}
                  contractOrders={contractOrders}
                />

                {/* Order Book */}
                {filteredActiveOrders.length > 0 && whitelist.length > 0 && (
                  <OrderbookChart
                    orders={filteredActiveOrders}
                    tokenPrices={tokenPrices}
                    whitelist={whitelist}
                  />
                )}

                {/* Hourly Activity Heatmap */}
                <HourlyActivityChart
                  transactions={filteredTransactions}
                  orders={filteredOrders}
                  contractOrders={filteredContractOrders}
                />

                {/* All Orders Table */}
                <div>
                  <h2 className="text-2xl font-bold text-white mb-4">All Orders</h2>

                  {/* Order Status Filters */}
                  <div className="flex flex-wrap gap-2 mb-4">
                    {(['all', 'active', 'completed', 'cancelled'] as const).map((filter) => (
                      <button
                        key={filter}
                        onClick={() => setOrderStatusFilter(filter)}
                        className={`px-4 py-2 rounded-lg font-medium transition-all capitalize ${
                          orderStatusFilter === filter
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
                    className="p-4 md:p-6 !overflow-x-auto"
                  >
                    <div className="overflow-x-auto -mx-4 md:-mx-6 px-4 md:px-6 pb-2 modern-scrollbar">
                      <table className="w-full min-w-[700px]">
                        <thead>
                          <tr className="border-b border-white/10">
                            <th className="text-left py-3 px-2 text-gray-400 font-medium text-sm whitespace-nowrap">ID</th>
                            <th className="text-left py-3 px-2 text-gray-400 font-medium text-sm whitespace-nowrap">Seller</th>
                            <th className="text-left py-3 px-2 text-gray-400 font-medium text-sm whitespace-nowrap">Pair</th>
                            <th className="text-right py-3 px-2 text-gray-400 font-medium text-sm whitespace-nowrap">Sell Amount</th>
                            <th className="text-right py-3 px-2 text-gray-400 font-medium text-sm whitespace-nowrap">Buy Amount</th>
                            <th className="text-center py-3 px-2 text-gray-400 font-medium text-sm whitespace-nowrap">Filled</th>
                            <th className="text-center py-3 px-2 text-gray-400 font-medium text-sm whitespace-nowrap">Status</th>
                            <th className="text-right py-3 px-2 text-gray-400 font-medium text-sm whitespace-nowrap">Created Date</th>
                          </tr>
                        </thead>
                        <tbody>
                          {filteredOrdersByStatus.length === 0 ? (
                            <tr>
                              <td colSpan={8} className="py-8 text-center text-gray-500">
                                No orders found with this filter.
                              </td>
                            </tr>
                          ) : (
                            filteredOrdersByStatus.map((order) => {
                              const isCurrentUser = connectedAddress?.toLowerCase() === order.maker.toLowerCase();
                              const statusColors = getStatusColor(order.status);

                              const href = isCurrentUser
                                ? `/my-orders?orderId=${order.id}`
                                : `/marketplace?order-id=${order.id}`;

                              return (
                                <tr
                                  key={order.id}
                                  className={`border-b border-white/5 transition-colors cursor-pointer ${
                                    isCurrentUser ? 'bg-white/5 hover:bg-white/10' : 'hover:bg-white/5'
                                  }`}
                                  onClick={() => window.location.href = href}
                                >
                                  <td className="py-4 px-2">
                                    <span className="text-gray-500 text-sm">#{order.id}</span>
                                  </td>
                                  <td className="py-4 px-2">
                                    {(() => {
                                      const color = getBuyerColor(order.maker);
                                      return (
                                        <div className="flex items-center gap-2">
                                          <span
                                            className="font-mono text-xs px-2.5 py-1 rounded-full inline-block"
                                            style={{ backgroundColor: color.bg, color: color.text, border: `1px solid ${color.border}` }}
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
                                  <td className="py-4 px-2">
                                    <span className="text-white text-sm">
                                      {formatTokenTicker(order.sellToken)}/{formatTokenTicker(order.buyToken)}
                                    </span>
                                  </td>
                                  <td className="py-4 px-2 text-right">
                                    <span className="text-gray-300 text-sm whitespace-nowrap">
                                      {formatDisplayAmount(order.sellAmount)} {formatTokenTicker(order.sellToken)}
                                    </span>
                                  </td>
                                  <td className="py-4 px-2 text-right">
                                    <span className="text-gray-300 text-sm whitespace-nowrap">
                                      {formatDisplayAmount(order.buyAmount)} {formatTokenTicker(order.buyToken)}
                                    </span>
                                  </td>
                                  <td className="py-4 px-2 text-center">
                                    <span className="text-gray-400 text-sm">{order.filled}%</span>
                                  </td>
                                  <td className="py-4 px-2 text-center">
                                    <span className={`text-xs px-2 py-1 rounded capitalize ${statusColors}`}>
                                      {order.status}
                                    </span>
                                  </td>
                                  <td className="py-4 px-2 text-right">
                                    <span className="text-gray-500 text-sm whitespace-nowrap">{order.createdAt}</span>
                                  </td>
                                </tr>
                              );
                            })
                          )}
                        </tbody>
                      </table>
                    </div>
                  </LiquidGlassCard>
                </div>

                {/* All Fills Table */}
                <div>
                  <h2 className="text-2xl font-bold text-white mb-4">All Fills</h2>
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
                            <th className="text-left py-3 px-2 text-gray-400 font-medium text-sm whitespace-nowrap">Order</th>
                            <th className="text-left py-3 px-2 text-gray-400 font-medium text-sm whitespace-nowrap">Buyer</th>
                            <th className="text-right py-3 px-2 text-gray-400 font-medium text-sm whitespace-nowrap">Sold</th>
                            <th className="text-right py-3 px-2 text-gray-400 font-medium text-sm whitespace-nowrap">Bought</th>
                            <th className="text-right py-3 px-2 text-gray-400 font-medium text-sm whitespace-nowrap">Date</th>
                            <th className="text-right py-3 px-2 text-gray-400 font-medium text-sm whitespace-nowrap">Tx</th>
                          </tr>
                        </thead>
                        <tbody>
                          {formattedFills.length === 0 ? (
                            <tr>
                              <td colSpan={6} className="py-8 text-center text-gray-500">
                                No fills found.
                              </td>
                            </tr>
                          ) : (
                            formattedFills.map((fill, idx) => {
                              const sellPrice = tokenPrices[fill.sellTokenAddress]?.price ?? 0;
                              const buyPrice = tokenPrices[fill.buyTokenAddress]?.price ?? 0;
                              const sellUsd = fill.sellAmountNum * sellPrice;
                              const buyUsd = fill.buyAmountNum * buyPrice;
                              return (
                              <tr key={`${fill.txHash}-${idx}`} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                                <td className="py-4 px-2">
                                  <span className="text-gray-500 text-sm">#{fill.orderId}</span>
                                </td>
                                <td className="py-4 px-2">
                                  {(() => {
                                    const color = getBuyerColor(fill.buyer);
                                    return (
                                      <span
                                        className="font-mono text-xs px-2.5 py-1 rounded-full inline-block"
                                        style={{ backgroundColor: color.bg, color: color.text, border: `1px solid ${color.border}` }}
                                      >
                                        {formatAddress(fill.buyer)}
                                      </span>
                                    );
                                  })()}
                                </td>
                                <td className="py-4 px-2 text-right">
                                  <div className="flex flex-col items-end">
                                    <span className="text-white text-sm font-medium whitespace-nowrap">
                                      {sellUsd > 0 ? `$${formatDisplayAmount(sellUsd.toString())}` : '--'}
                                    </span>
                                    <span className="text-gray-500 text-xs whitespace-nowrap">
                                      {formatDisplayAmount(fill.sellAmountNum.toString())} {formatTokenTicker(fill.sellToken)}
                                    </span>
                                  </div>
                                </td>
                                <td className="py-4 px-2 text-right">
                                  <div className="flex flex-col items-end">
                                    <span className="text-white text-sm font-medium whitespace-nowrap">
                                      {buyUsd > 0 ? `$${formatDisplayAmount(buyUsd.toString())}` : '--'}
                                    </span>
                                    <span className="text-gray-500 text-xs whitespace-nowrap">
                                      {formatDisplayAmount(fill.buyAmountNum.toString())} {formatTokenTicker(fill.buyToken)}
                                    </span>
                                  </div>
                                </td>
                                <td className="py-4 px-2 text-right">
                                  <span className="text-gray-500 text-sm whitespace-nowrap">
                                    {fill.timestamp ? (() => {
                                      const d = new Date(fill.timestamp * 1000);
                                      const time = d.toLocaleString('en-US', { hour: '2-digit', minute: '2-digit', timeZone: 'UTC' });
                                      const date = d.toLocaleString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
                                      return `${time} UTC, ${date}`;
                                    })() : '-'}
                                  </span>
                                </td>
                                <td className="py-4 px-2 text-right">
                                  <a
                                    href={`https://otter.pulsechain.com/tx/${fill.txHash}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-blue-400 hover:text-blue-300 text-sm font-mono"
                                    onClick={(e) => e.stopPropagation()}
                                  >
                                    {fill.txHash.slice(0, 8)}...
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
                </div>

                {/* Footer note */}
                <div className="text-center text-gray-500 text-sm pt-4">
                  <p>Data sourced from protocol database. Synced every minute from PulseChain.</p>
                </div>
              </motion.div>
            )}
          </div>
        </div>
      </main>
    </>
  );
}
