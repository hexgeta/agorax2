'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useAccount, usePublicClient } from 'wagmi';
import { parseAbiItem } from 'viem';
import { motion } from 'framer-motion';
import { DisclaimerDialog } from '@/components/DisclaimerDialog';
import { PixelSpinner } from '@/components/ui/PixelSpinner';
import { LogoPreloader } from '@/components/LogoPreloader';
import PixelBlastBackground from '@/components/ui/PixelBlastBackground';
import VolumeChart from '@/components/VolumeChart';
import OrderVolumeChart from '@/components/OrderVolumeChart';
import StatsOverviewCards from '@/components/stats/StatsOverviewCards';
import TopTradersLeaderboard from '@/components/stats/TopTradersLeaderboard';
import TopTokensChart from '@/components/stats/TopTokensChart';
import ProtocolActivityChart from '@/components/stats/ProtocolActivityChart';
import HourlyActivityChart from '@/components/stats/HourlyActivityChart';
import TokenOrderPricesChart from '@/components/stats/TokenOrderPricesChart';
import { useTokenPrices } from '@/hooks/crypto/useTokenPrices';
import { useOpenPositions } from '@/hooks/contracts/useOpenPositions';
import { useContractWhitelistRead } from '@/hooks/contracts/useContractWhitelistRead';
import { getContractAddress } from '@/config/testing';
import { getTokenInfo, formatTokenAmount } from '@/utils/tokenUtils';

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

export default function StatsPage() {
  const [showDisclaimer, setShowDisclaimer] = useState(false);
  const { chainId } = useAccount();
  const publicClient = usePublicClient();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [orders, setOrders] = useState<OrderPlaced[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadingProgress, setLoadingProgress] = useState<string>('Initializing...');

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
            {/* Header */}
            <motion.div
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
              className="mb-8"
            >
              <h1 className="text-3xl md:text-4xl font-bold text-white mb-2">Protocol Stats</h1>
              <p className="text-gray-400">Real-time analytics from on-chain data</p>
            </motion.div>

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
                {/* Overview Stats Cards */}
                <StatsOverviewCards
                  transactions={transactions}
                  orders={orders}
                  tokenPrices={tokenPrices}
                  contractOrders={contractOrders}
                  activeOrders={activeOrders}
                />

                {/* Charts Grid - 2 columns on desktop */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* Order Creation Volume Chart */}
                  <OrderVolumeChart
                    orders={orders}
                    tokenPrices={tokenPrices}
                    contractOrders={contractOrders}
                  />

                  {/* Order Fill Volume Chart */}
                  <VolumeChart
                    transactions={transactions}
                    tokenPrices={tokenPrices}
                  />
                </div>

                {/* Protocol Growth Chart */}
                <ProtocolActivityChart
                  transactions={transactions}
                  orders={orders}
                  contractOrders={contractOrders}
                />

                {/* Top Tokens Chart */}
                <TopTokensChart
                  transactions={transactions}
                  orders={orders}
                  tokenPrices={tokenPrices}
                  contractOrders={contractOrders}
                />

                {/* Limit Order Price Levels Chart */}
                {activeOrders.length > 0 && whitelist.length > 0 && (
                  <TokenOrderPricesChart
                    orders={activeOrders}
                    tokenPrices={tokenPrices}
                    whitelist={whitelist}
                  />
                )}

                {/* Two column layout for leaderboard and heatmap */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* Top Traders Leaderboard */}
                  <TopTradersLeaderboard
                    transactions={transactions}
                    orders={orders}
                    tokenPrices={tokenPrices}
                    contractOrders={contractOrders}
                  />

                  {/* Hourly Activity Heatmap */}
                  <HourlyActivityChart
                    transactions={transactions}
                    orders={orders}
                    contractOrders={contractOrders}
                  />
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
