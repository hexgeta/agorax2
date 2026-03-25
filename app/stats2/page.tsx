'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useAccount, usePublicClient } from 'wagmi';
import { parseAbiItem } from 'viem';
import { motion } from 'framer-motion';
import { DisclaimerDialog } from '@/components/DisclaimerDialog';
import { PixelSpinner } from '@/components/ui/PixelSpinner';
import { LogoPreloader } from '@/components/LogoPreloader';
import PixelBlastBackground from '@/components/ui/PixelBlastBackground';
import StatsOverviewCards from '@/components/stats/StatsOverviewCards';
import TopTradersLeaderboard from '@/components/stats/TopTradersLeaderboard';
import TopTokensChart from '@/components/stats/TopTokensChart';
import ProtocolActivityChart from '@/components/stats/ProtocolActivityChart';
import HourlyActivityChart from '@/components/stats/HourlyActivityChart';
import OrderbookChart from '@/components/stats/OrderbookChart';
import { useTokenPrices } from '@/hooks/crypto/useTokenPrices';
import { useOpenPositions, CompleteOrderDetails } from '@/hooks/contracts/useOpenPositions';
import { useContractWhitelistRead } from '@/hooks/contracts/useContractWhitelistRead';
import { getContractAddress, PULSECHAIN_CHAIN_ID } from '@/config/testing';
import { getTokenInfo, getTokenInfoByIndex, formatTokenAmount, formatTokenTicker } from '@/utils/tokenUtils';
import Link from 'next/link';
import { LiquidGlassCard } from '@/components/ui/liquid-glass';
import { CoinLogo } from '@/components/ui/CoinLogo';

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

// All Orders table types and helpers
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

// Deterministic color from address for buyer pills
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

function formatTimestamp(timestamp: number | bigint): string {
  if (!timestamp) return '-';
  const ts = typeof timestamp === 'bigint' ? Number(timestamp) : timestamp;
  const date = new Date(ts * 1000);
  const time = date.toLocaleString('en-US', { hour: '2-digit', minute: '2-digit', timeZone: 'UTC' });
  const day = date.toLocaleString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
  return `${time} UTC, ${day}`;
}

export default function StatsPage() {
  const [showDisclaimer, setShowDisclaimer] = useState(false);
  const { chainId: walletChainId, address: connectedAddress } = useAccount();
  // Default to PulseChain mainnet when wallet not connected (stats should work without wallet)
  const chainId = walletChainId ?? PULSECHAIN_CHAIN_ID;
  const publicClient = usePublicClient({ chainId });
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [orders, setOrders] = useState<OrderPlaced[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadingProgress, setLoadingProgress] = useState<string>('Initializing...');

  // Raw fill event data from blockchain (processed into transactions via useMemo)
  interface FillEvent {
    transactionHash: string;
    orderId: string;
    buyer: string;
    buyTokenIndex: number;
    buyAmount: bigint;
    blockNumber: bigint;
    timestamp: number;
  }
  const [fillEvents, setFillEvents] = useState<FillEvent[]>([]);
  const [selectedTokenFilters, setSelectedTokenFilters] = useState<{ address: string; ticker: string }[]>([]);
  const [selectedTraderFilters, setSelectedTraderFilters] = useState<string[]>([]);
  const [orderStatusFilter, setOrderStatusFilter] = useState<'all' | 'active' | 'completed' | 'cancelled'>('all');
  const [addressSearch, setAddressSearch] = useState('');
  const [orderIdSearch, setOrderIdSearch] = useState('');
  const [selectedDateFilter, setSelectedDateFilter] = useState<string | null>(null);

  const isLocalhost = typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');

  const OTC_CONTRACT_ADDRESS = getContractAddress(chainId);

  // Fetch all orders for stats and price levels chart
  const { activeOrders, allOrders: contractOrders, isLoading: ordersLoading } = useOpenPositions(undefined, true);

  // Get whitelist for token index lookups
  const { activeTokens } = useContractWhitelistRead();
  const whitelist = useMemo(() =>
    activeTokens.map(t => t.tokenAddress.toLowerCase()),
    [activeTokens]
  );

  // Get all token addresses from transactions, orders, and active orders (memoized to prevent re-renders)
  const allTokenAddresses = useMemo(() => {
    const addresses = new Set<string>();
    transactions.forEach(tx => {
      addresses.add(tx.sellToken);
      Object.keys(tx.buyTokens).forEach(addr => addresses.add(addr));
    });
    orders.forEach(order => addresses.add(order.sellToken));
    activeOrders.forEach(order => {
      addresses.add(order.orderDetailsWithID.orderDetails.sellToken.toLowerCase());
      order.orderDetailsWithID.orderDetails.buyTokensIndex.forEach((idx) => {
        const addr = whitelist[Number(idx)];
        if (addr) addresses.add(addr);
      });
    });
    return Array.from(addresses);
  }, [transactions, orders, activeOrders, whitelist]);

  const { prices: tokenPrices, isLoading: pricesLoading } = useTokenPrices(allTokenAddresses);

  // Fetch all orders placed
  const fetchAllOrders = useCallback(async () => {
    if (!publicClient || !OTC_CONTRACT_ADDRESS) return;

    setLoadingProgress('Fetching order events...');

    try {
      // Query ALL OrderPlaced events
      const logs = await publicClient.getLogs({
        address: OTC_CONTRACT_ADDRESS as any,
        event: parseAbiItem('event OrderPlaced(address indexed user, uint256 indexed orderID, address indexed sellToken, uint256 sellAmount)') as any,
        fromBlock: 'earliest'
      });

      const placedOrders: OrderPlaced[] = [];
      const blockCache: Record<string, number> = {};
      const total = logs.length;

      for (let i = 0; i < logs.length; i++) {
        const log = logs[i];
        const orderId = log.args.orderID?.toString();
        const orderOwner = log.args.user as string;
        const sellToken = log.args.sellToken as string;
        const sellAmount = log.args.sellAmount as bigint;

        if (!orderId || !orderOwner || !sellToken) continue;

        try {
          // Cache block timestamps to avoid duplicate RPC calls
          const blockKey = log.blockNumber.toString();
          if (!blockCache[blockKey]) {
            const block = await publicClient.getBlock({ blockNumber: log.blockNumber });
            blockCache[blockKey] = Number(block.timestamp);
          }

          const tokenInfo = getTokenInfo(sellToken);
          const sellAmountFormatted = tokenInfo
            ? parseFloat(formatTokenAmount(sellAmount, tokenInfo.decimals))
            : 0;

          placedOrders.push({
            transactionHash: log.transactionHash,
            orderId,
            sellToken: sellToken.toLowerCase(),
            sellAmount: sellAmountFormatted,
            blockNumber: log.blockNumber,
            timestamp: blockCache[blockKey],
            orderOwner
          });

          if (i % 10 === 0) {
            setLoadingProgress(`Processing orders: ${i + 1}/${total}`);
          }
        } catch {
          // Skip failed orders
        }
      }

      setOrders(placedOrders);
    } catch (error) {
    }
  }, [publicClient, OTC_CONTRACT_ADDRESS]);

  // Fetch raw fill events from blockchain (lightweight - no receipt parsing)
  const fetchFillEvents = useCallback(async () => {
    if (!publicClient || !OTC_CONTRACT_ADDRESS) return;

    setIsLoading(true);
    setLoadingProgress('Fetching fill events...');

    try {
      const logs = await publicClient.getLogs({
        address: OTC_CONTRACT_ADDRESS as any,
        event: parseAbiItem('event OrderFilled(address indexed buyer, uint256 indexed orderID, uint256 indexed buyTokenIndex, uint256 buyAmount)') as any,
        fromBlock: 'earliest'
      });

      const events: FillEvent[] = [];
      const blockCache: Record<string, number> = {};
      const total = logs.length;

      for (let i = 0; i < logs.length; i++) {
        const log = logs[i];
        const orderId = log.args.orderID?.toString();
        const buyer = log.args.buyer as string;
        if (!orderId) continue;

        try {
          // Cache block timestamps to avoid duplicate RPC calls
          const blockKey = log.blockNumber.toString();
          if (!blockCache[blockKey]) {
            const block = await publicClient.getBlock({ blockNumber: log.blockNumber });
            blockCache[blockKey] = Number(block.timestamp);
          }

          events.push({
            transactionHash: log.transactionHash,
            orderId,
            buyer,
            buyTokenIndex: Number(log.args.buyTokenIndex),
            buyAmount: log.args.buyAmount as bigint,
            blockNumber: log.blockNumber,
            timestamp: blockCache[blockKey],
          });

          if (i % 5 === 0) {
            setLoadingProgress(`Processing fills: ${i + 1}/${total}`);
          }
        } catch (error) {
          console.warn(`Failed to process fill event for order ${orderId}:`, error);
        }
      }

      setFillEvents(events);
    } catch (error) {
      console.warn('Failed to fetch OrderFilled events:', error);
    } finally {
      setIsLoading(false);
    }
  }, [publicClient, OTC_CONTRACT_ADDRESS]);

  // Process fill events into transaction data by joining with contract orders + whitelist
  // This runs automatically when fill events, contract orders, or whitelist update
  useEffect(() => {
    if (fillEvents.length === 0) {
      // Use functional updater to avoid creating a new [] reference on every render
      setTransactions(prev => prev.length === 0 ? prev : []);
      return;
    }
    if (contractOrders.length === 0 || whitelist.length === 0) return;

    const orderMap = new Map<string, CompleteOrderDetails>();
    contractOrders.forEach(order => {
      orderMap.set(order.orderDetailsWithID.orderID.toString(), order);
    });

    const txs: Transaction[] = [];

    for (const event of fillEvents) {
      const order = orderMap.get(event.orderId);
      if (!order) continue;

      const sellTokenAddr = order.orderDetailsWithID.orderDetails.sellToken.toLowerCase();
      const sellTokenInfo = getTokenInfo(sellTokenAddr);
      const buyTokenAddr = whitelist[event.buyTokenIndex]?.toLowerCase();
      if (!buyTokenAddr) continue;
      const buyTokenInfo = getTokenInfoByIndex(event.buyTokenIndex);

      // Calculate proportional sell amount from order's price ratio
      const originalSellAmount = order.orderDetailsWithID.orderDetails.sellAmount;
      const buyTokensIndex = order.orderDetailsWithID.orderDetails.buyTokensIndex;
      const buyAmounts = order.orderDetailsWithID.orderDetails.buyAmounts;
      const matchIdx = buyTokensIndex.findIndex(idx => Number(idx) === event.buyTokenIndex);

      let sellAmount = 0;
      if (matchIdx >= 0 && buyAmounts[matchIdx] && Number(buyAmounts[matchIdx]) > 0) {
        const ratio = Number(event.buyAmount) / Number(buyAmounts[matchIdx]);
        sellAmount = (Number(originalSellAmount) * ratio) / Math.pow(10, sellTokenInfo.decimals);
      }

      const buyAmount = Number(event.buyAmount) / Math.pow(10, buyTokenInfo.decimals);

      txs.push({
        transactionHash: event.transactionHash,
        orderId: event.orderId,
        sellToken: sellTokenAddr,
        sellAmount,
        buyTokens: { [buyTokenAddr]: buyAmount },
        blockNumber: event.blockNumber,
        timestamp: event.timestamp,
        buyer: event.buyer,
      });
    }

    setTransactions(txs);
  }, [fillEvents, contractOrders, whitelist]);

  useEffect(() => {
    const fetchData = async () => {
      await Promise.all([
        fetchFillEvents(),
        fetchAllOrders()
      ]);
    };
    fetchData();
  }, [fetchFillEvents, fetchAllOrders]);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const accepted = localStorage.getItem('disclaimer-accepted');
      setShowDisclaimer(accepted !== 'true');
    }
  }, []);

  // All data sources must be loaded before showing content
  const dataReady = !isLoading && !ordersLoading && !pricesLoading;
  const hasData = transactions.length > 0 || orders.length > 0 || contractOrders.length > 0;

  const [pageVisible, setPageVisible] = useState(false);
  useEffect(() => {
    if (dataReady && hasData) {
      requestAnimationFrame(() => setPageVisible(true));
    }
  }, [dataReady, hasData]);

  // Filter data based on selected token and/or trader
  const filteredTransactions = useMemo(() => {
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

  const filteredOrders = useMemo(() => {
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

  const filteredContractOrders = useMemo(() => {
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

    return result;
  }, [activeOrders, selectedTokenFilters, selectedTraderFilters, whitelist, addressSearch, orderIdSearch]);

  // Build formatted orders for All Orders table (respects token/trader filters)
  const formattedOrders = useMemo(() => {
    const formatted: FormattedOrder[] = [];

    filteredContractOrders.forEach((order: CompleteOrderDetails) => {
      const maker = order.userDetails.orderOwner;
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
    });

    return formatted.sort((a, b) => b.id - a.id);
  }, [filteredContractOrders]);

  // Build formatted fills for All Fills table
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
  const formattedFills = useMemo(() => {
    if (fillEvents.length === 0 || contractOrders.length === 0 || whitelist.length === 0) return [];
    const orderMap = new Map<string, CompleteOrderDetails>();
    contractOrders.forEach(o => orderMap.set(o.orderDetailsWithID.orderID.toString(), o));

    const fills: FormattedFill[] = [];
    for (const event of fillEvents) {
      const order = orderMap.get(event.orderId);
      if (!order) continue;
      const sellTokenAddr = order.orderDetailsWithID.orderDetails.sellToken.toLowerCase();
      const sellTokenInfo = getTokenInfo(sellTokenAddr);
      const buyTokenAddr = whitelist[event.buyTokenIndex]?.toLowerCase();
      if (!buyTokenAddr) continue;
      const buyTokenInfo = getTokenInfoByIndex(event.buyTokenIndex);

      const originalSellAmount = order.orderDetailsWithID.orderDetails.sellAmount;
      const buyTokensIndex = order.orderDetailsWithID.orderDetails.buyTokensIndex;
      const buyAmounts = order.orderDetailsWithID.orderDetails.buyAmounts;
      const matchIdx = buyTokensIndex.findIndex(idx => Number(idx) === event.buyTokenIndex);

      let sellAmountNum = 0;
      if (matchIdx >= 0 && buyAmounts[matchIdx] && Number(buyAmounts[matchIdx]) > 0) {
        const ratio = Number(event.buyAmount) / Number(buyAmounts[matchIdx]);
        sellAmountNum = (Number(originalSellAmount) * ratio) / Math.pow(10, sellTokenInfo.decimals);
      }
      const buyAmountNum = Number(event.buyAmount) / Math.pow(10, buyTokenInfo.decimals);

      fills.push({
        orderId: event.orderId,
        buyer: event.buyer,
        sellToken: sellTokenInfo.ticker,
        sellTokenAddress: sellTokenAddr,
        sellAmountNum,
        buyToken: buyTokenInfo.ticker,
        buyTokenAddress: buyTokenAddr,
        buyAmountNum,
        timestamp: event.timestamp,
        txHash: event.transactionHash,
      });
    }
    return fills.sort((a, b) => b.timestamp - a.timestamp);
  }, [fillEvents, contractOrders, whitelist]);

  const filteredFills = useMemo(() => {
    let result = formattedFills;

    if (selectedTokenFilters.length > 0) {
      const tokenAddrs = selectedTokenFilters.map(t => t.address.toLowerCase());
      result = result.filter(fill =>
        tokenAddrs.includes(fill.sellTokenAddress.toLowerCase()) || tokenAddrs.includes(fill.buyTokenAddress.toLowerCase())
      );
    }

    if (selectedTraderFilters.length > 0) {
      const traderAddrs = selectedTraderFilters.map(a => a.toLowerCase());
      result = result.filter(fill => traderAddrs.includes(fill.buyer.toLowerCase()));
    }

    if (addressSearch.trim()) {
      const query = addressSearch.toLowerCase().trim();
      result = result.filter(fill => fill.buyer.toLowerCase().includes(query));
    }

    if (orderIdSearch.trim()) {
      const query = orderIdSearch.trim();
      result = result.filter(fill => fill.orderId === query);
    }

    return result;
  }, [formattedFills, selectedTokenFilters, selectedTraderFilters, addressSearch, orderIdSearch]);

  const filteredOrdersByStatus = useMemo(() => {
    if (orderStatusFilter === 'all') return formattedOrders;
    return formattedOrders.filter(order => order.status === orderStatusFilter);
  }, [formattedOrders, orderStatusFilter]);

  // Handle token filter selection
  const handleTokenFilterSelect = useCallback((address: string, ticker: string) => {
    setSelectedTokenFilters(prev => {
      const exists = prev.some(t => t.address.toLowerCase() === address.toLowerCase());
      if (exists) {
        return prev.filter(t => t.address.toLowerCase() !== address.toLowerCase());
      }
      return [...prev, { address, ticker }];
    });
  }, []);

  // Handle trader filter selection (multi-select toggle)
  const handleTraderFilterSelect = useCallback((address: string) => {
    setSelectedTraderFilters(prev => {
      const exists = prev.some(a => a.toLowerCase() === address.toLowerCase());
      if (exists) {
        return prev.filter(a => a.toLowerCase() !== address.toLowerCase());
      }
      return [...prev, address];
    });
  }, []);

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
                  {isLoading ? loadingProgress : ordersLoading ? 'Loading orders...' : pricesLoading ? 'Fetching token prices...' : 'Finalizing...'}
                </p>
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
                <div className={`${(selectedTokenFilters.length > 0 || selectedTraderFilters.length > 0 || addressSearch || orderIdSearch) ? 'sticky top-[72px] z-30' : ''}`}>
                  <div className="flex flex-wrap items-center gap-3 p-3 bg-black/95 backdrop-blur-md border border-white/10 rounded-lg shadow-lg">
                    {/* Active filter pills */}
                    {(selectedTokenFilters.length > 0 || selectedTraderFilters.length > 0) && (
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
                      {(selectedTokenFilters.length > 0 || selectedTraderFilters.length > 0 || addressSearch || orderIdSearch) && (
                        <button
                          onClick={() => {
                            setSelectedTokenFilters([]);
                            setSelectedTraderFilters([]);
                            setAddressSearch('');
                            setOrderIdSearch('');
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
                />

                {/* Protocol Activity Chart - Combined volume bars and cumulative lines */}
                <ProtocolActivityChart
                  transactions={filteredTransactions}
                  orders={filteredOrders}
                  contractOrders={filteredContractOrders}
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
                    {ordersLoading ? (
                      <div className="flex items-center justify-center py-12">
                        <PixelSpinner size={32} />
                        <span className="ml-3 text-gray-400">Loading orders...</span>
                      </div>
                    ) : (
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

                              const href = `/order/${order.id}`;

                              return (
                                <tr
                                  key={order.id}
                                  className={`border-b border-white/5 transition-colors ${
                                    isCurrentUser ? 'bg-white/5 hover:bg-white/10' : 'hover:bg-white/5'
                                  }`}
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
                    )}
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
                    {isLoading ? (
                      <div className="flex items-center justify-center py-12">
                        <PixelSpinner size={32} />
                        <span className="ml-3 text-gray-400">Loading fills...</span>
                      </div>
                    ) : (
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
                          {filteredFills.length === 0 ? (
                            <tr>
                              <td colSpan={6} className="py-8 text-center text-gray-500">
                                No fills found.
                              </td>
                            </tr>
                          ) : (
                            filteredFills.map((fill, idx) => {
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
                                    href={`/tx/${fill.txHash}`}
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
                    )}
                  </LiquidGlassCard>
                </div>

                {/* Footer note */}
                <div className="text-center text-gray-500 text-sm pt-4">
                  <p>Data sourced directly from PulseChain. Updates on page refresh.</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </main>
    </>
  );
}
