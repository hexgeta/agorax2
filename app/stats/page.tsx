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
import { getContractAddress } from '@/config/testing';
import { getTokenInfo, getTokenInfoByIndex, formatTokenAmount } from '@/utils/tokenUtils';
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

function formatTimestamp(timestamp: number | bigint): string {
  if (!timestamp) return '-';
  const ts = typeof timestamp === 'bigint' ? Number(timestamp) : timestamp;
  const date = new Date(ts * 1000);
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export default function StatsPage() {
  const [showDisclaimer, setShowDisclaimer] = useState(false);
  const { chainId, address: connectedAddress } = useAccount();
  const publicClient = usePublicClient();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [orders, setOrders] = useState<OrderPlaced[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadingProgress, setLoadingProgress] = useState<string>('Initializing...');
  const [selectedTokenFilter, setSelectedTokenFilter] = useState<{ address: string; ticker: string } | null>(null);
  const [selectedTraderFilter, setSelectedTraderFilter] = useState<string | null>(null);
  const [orderStatusFilter, setOrderStatusFilter] = useState<'all' | 'active' | 'completed' | 'cancelled'>('all');

  const OTC_CONTRACT_ADDRESS = getContractAddress(chainId);

  // Fetch all orders for stats and price levels chart
  const { activeOrders, allOrders: contractOrders, isLoading: ordersLoading } = useOpenPositions(undefined, true);

  // Get whitelist for token index lookups
  const { activeTokens } = useContractWhitelistRead();
  const whitelist = useMemo(() =>
    activeTokens.map(t => t.tokenAddress.toLowerCase()),
    [activeTokens]
  );

  // Get all token addresses from transactions and orders
  const transactionTokenAddresses = transactions ? [
    ...new Set([
      ...transactions.map(tx => tx.sellToken),
      ...transactions.flatMap(tx => Object.keys(tx.buyTokens))
    ])
  ] : [];

  const orderTokenAddresses = orders ? [
    ...new Set(orders.map(order => order.sellToken))
  ] : [];

  // Also include tokens from active orders for price chart
  const activeOrderTokenAddresses = useMemo(() => {
    const addresses = new Set<string>();
    activeOrders.forEach(order => {
      addresses.add(order.orderDetailsWithID.orderDetails.sellToken.toLowerCase());
      order.orderDetailsWithID.orderDetails.buyTokensIndex.forEach((idx) => {
        const addr = whitelist[Number(idx)];
        if (addr) addresses.add(addr);
      });
    });
    return Array.from(addresses);
  }, [activeOrders, whitelist]);

  const allTokenAddresses = [...new Set([...transactionTokenAddresses, ...orderTokenAddresses, ...activeOrderTokenAddresses])];

  const { prices: tokenPrices } = useTokenPrices(allTokenAddresses);

  // Fetch all orders placed
  const fetchAllOrders = useCallback(async () => {
    if (!publicClient) return;

    setLoadingProgress('Fetching order events...');

    try {
      // Query ALL OrderPlaced events
      const logs = await publicClient.getLogs({
        address: OTC_CONTRACT_ADDRESS as any,
        event: parseAbiItem('event OrderPlaced(address indexed user, uint256 indexed orderID, address indexed sellToken, uint256 sellAmount)') as any,
        fromBlock: 'earliest'
      });

      const placedOrders: OrderPlaced[] = [];
      const total = logs.length;

      for (let i = 0; i < logs.length; i++) {
        const log = logs[i];
        const orderId = log.args.orderID?.toString();
        const orderOwner = log.args.user as string;
        const sellToken = log.args.sellToken as string;
        const sellAmount = log.args.sellAmount as bigint;

        if (!orderId || !orderOwner || !sellToken) continue;

        try {
          const block = await publicClient.getBlock({
            blockNumber: log.blockNumber
          });

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
            timestamp: Number(block.timestamp),
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
      console.error('Error fetching orders:', error);
    }
  }, [publicClient, OTC_CONTRACT_ADDRESS]);

  // Fetch all transactions
  const fetchAllTransactions = useCallback(async () => {
    if (!publicClient) return;

    setIsLoading(true);
    setLoadingProgress('Fetching fill events...');

    try {
      // Query ALL OrderFilled events
      const logs = await publicClient.getLogs({
        address: OTC_CONTRACT_ADDRESS as any,
        event: parseAbiItem('event OrderFilled(address indexed buyer, uint256 indexed orderID, uint256 indexed buyTokenIndex, uint256 buyAmount)') as any,
        fromBlock: 'earliest'
      });

      const txs: Transaction[] = [];
      const total = logs.length;

      for (let i = 0; i < logs.length; i++) {
        const log = logs[i];
        const orderId = log.args.orderID?.toString();
        const buyer = log.args.buyer as string;
        if (!orderId) continue;

        try {
          const receipt = await publicClient.getTransactionReceipt({
            hash: log.transactionHash
          });

          const transferLogs = receipt.logs.filter(transferLog => {
            return transferLog.topics[0] === '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef';
          });

          let sellAmount = 0;
          let sellToken = '';
          const buyTokens: Record<string, number> = {};

          for (const transferLog of transferLogs) {
            const tokenAddress = transferLog.address.toLowerCase();
            const from = `0x${transferLog.topics[1]?.slice(26)}`.toLowerCase();
            const to = `0x${transferLog.topics[2]?.slice(26)}`.toLowerCase();
            const value = transferLog.data ? BigInt(transferLog.data) : BigInt(0);

            if (OTC_CONTRACT_ADDRESS && from === OTC_CONTRACT_ADDRESS.toLowerCase()) {
              const tokenInfo = getTokenInfo(tokenAddress);
              if (tokenInfo && tokenInfo.address !== '0x0000000000000000000000000000000000000000') {
                sellAmount = parseFloat(formatTokenAmount(value, tokenInfo.decimals));
                sellToken = tokenAddress;
              }
            }

            if (OTC_CONTRACT_ADDRESS && to === OTC_CONTRACT_ADDRESS.toLowerCase()) {
              const tokenInfo = getTokenInfo(tokenAddress);
              if (tokenInfo && tokenInfo.address !== '0x0000000000000000000000000000000000000000') {
                buyTokens[tokenAddress] = parseFloat(formatTokenAmount(value, tokenInfo.decimals));
              }
            }
          }

          if (sellAmount > 0 || Object.keys(buyTokens).length > 0) {
            const block = await publicClient.getBlock({
              blockNumber: log.blockNumber
            });

            txs.push({
              transactionHash: log.transactionHash,
              orderId,
              sellToken,
              sellAmount,
              buyTokens,
              blockNumber: log.blockNumber,
              timestamp: Number(block.timestamp),
              buyer
            });
          }

          if (i % 5 === 0) {
            setLoadingProgress(`Processing fills: ${i + 1}/${total}`);
          }
        } catch {
          // Skip failed transactions
        }
      }

      setTransactions(txs);
    } catch (error) {
      console.error('Error fetching transactions:', error);
    } finally {
      setIsLoading(false);
    }
  }, [publicClient, OTC_CONTRACT_ADDRESS]);

  useEffect(() => {
    const fetchData = async () => {
      await Promise.all([
        fetchAllTransactions(),
        fetchAllOrders()
      ]);
    };
    fetchData();
  }, [fetchAllTransactions, fetchAllOrders]);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const accepted = localStorage.getItem('disclaimer-accepted');
      setShowDisclaimer(accepted !== 'true');
    }
  }, []);

  const hasData = transactions.length > 0 || orders.length > 0 || contractOrders.length > 0;

  // Filter data based on selected token and/or trader
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

  const filteredOrdersByStatus = useMemo(() => {
    if (orderStatusFilter === 'all') return formattedOrders;
    return formattedOrders.filter(order => order.status === orderStatusFilter);
  }, [formattedOrders, orderStatusFilter]);

  // Handle token filter selection
  const handleTokenFilterSelect = useCallback((address: string, ticker: string) => {
    if (selectedTokenFilter?.address.toLowerCase() === address.toLowerCase()) {
      // Clicking the same token clears the filter
      setSelectedTokenFilter(null);
    } else {
      setSelectedTokenFilter({ address, ticker });
    }
  }, [selectedTokenFilter]);

  // Handle trader filter selection
  const handleTraderFilterSelect = useCallback((address: string) => {
    if (selectedTraderFilter?.toLowerCase() === address.toLowerCase()) {
      // Clicking the same trader clears the filter
      setSelectedTraderFilter(null);
    } else {
      setSelectedTraderFilter(address);
    }
  }, [selectedTraderFilter]);

  return (
    <>
      <DisclaimerDialog open={showDisclaimer} onAccept={() => setShowDisclaimer(false)} />
      <LogoPreloader />
      <main className="flex min-h-screen flex-col items-center relative">
        {/* Animated background effect */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: !isLoading ? 1 : 0 }}
          transition={{ duration: 1.2, delay: 0.3, ease: [0.23, 1, 0.32, 1] }}
          className="fixed inset-0 z-0"
        >
          <PixelBlastBackground />
        </motion.div>

        {/* Main Content */}
        <div className="w-full px-2 md:px-8 mt-2 pb-12 relative z-10">
          <div className="max-w-[1200px] mx-auto">
            {isLoading ? (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="flex flex-col items-center justify-center py-20"
              >
                <PixelSpinner size={48} className="mb-6" />
                <p className="text-white text-lg mb-2">Loading Protocol Data</p>
                <p className="text-gray-400 text-sm">{loadingProgress}</p>
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
                        <span className="text-white font-medium">{selectedTokenFilter.ticker}</span>
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

                {/* Protocol Activity Chart - Combined volume bars and cumulative lines */}
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
                            <th className="text-left py-3 px-2 text-gray-400 font-medium text-sm whitespace-nowrap">Maker</th>
                            <th className="text-left py-3 px-2 text-gray-400 font-medium text-sm whitespace-nowrap">Pair</th>
                            <th className="text-right py-3 px-2 text-gray-400 font-medium text-sm whitespace-nowrap">Sell Amount</th>
                            <th className="text-right py-3 px-2 text-gray-400 font-medium text-sm whitespace-nowrap">Buy Amount</th>
                            <th className="text-center py-3 px-2 text-gray-400 font-medium text-sm whitespace-nowrap">Filled</th>
                            <th className="text-center py-3 px-2 text-gray-400 font-medium text-sm whitespace-nowrap">Status</th>
                            <th className="text-right py-3 px-2 text-gray-400 font-medium text-sm whitespace-nowrap">Date</th>
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
                                    <span className="text-gray-300 text-sm whitespace-nowrap">
                                      {formatDisplayAmount(order.sellAmount)} {order.sellToken}
                                    </span>
                                  </td>
                                  <td className="py-4 px-2 text-right">
                                    <span className="text-gray-300 text-sm whitespace-nowrap">
                                      {formatDisplayAmount(order.buyAmount)} {order.buyToken}
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

                {/* Footer note */}
                <div className="text-center text-gray-500 text-sm pt-4">
                  <p>Data sourced directly from PulseChain. Updates on page refresh.</p>
                </div>
              </motion.div>
            )}
          </div>
        </div>
      </main>
    </>
  );
}
