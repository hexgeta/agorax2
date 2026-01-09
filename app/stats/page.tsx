'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAccount, usePublicClient } from 'wagmi';
import { parseAbiItem } from 'viem';
import { DisclaimerDialog } from '@/components/DisclaimerDialog';
import { PixelSpinner } from '@/components/ui/PixelSpinner';
import { LogoPreloader } from '@/components/LogoPreloader';
import VolumeChart from '@/components/VolumeChart';
import OrderVolumeChart from '@/components/OrderVolumeChart';
import { useTokenPrices } from '@/hooks/crypto/useTokenPrices';
import { getContractAddress } from '@/config/testing';
import { getTokenInfo, formatTokenAmount } from '@/utils/tokenUtils';
import { CONTRACT_ABI } from '@/config/abis';
import { CompleteOrderDetails } from '@/hooks/contracts/useOpenPositions';

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

  const OTC_CONTRACT_ADDRESS = getContractAddress(chainId);

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

  const allTokenAddresses = [...new Set([...transactionTokenAddresses, ...orderTokenAddresses])];

  const { prices: tokenPrices } = useTokenPrices(allTokenAddresses);

  // Fetch all orders placed
  const fetchAllOrders = useCallback(async () => {
    if (!publicClient) return;

    try {
      // Query ALL OrderPlaced events
      const logs = await publicClient.getLogs({
        address: OTC_CONTRACT_ADDRESS as any,
        event: parseAbiItem('event OrderPlaced(address indexed user, uint256 indexed orderID, address indexed sellToken, uint256 sellAmount)') as any,
        fromBlock: 'earliest'
      });

      const placedOrders: OrderPlaced[] = [];

      for (const log of logs) {
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
        } catch (err) {
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
    try {
      // Query ALL OrderFilled events
      const logs = await publicClient.getLogs({
        address: OTC_CONTRACT_ADDRESS as any,
        event: parseAbiItem('event OrderFilled(address indexed buyer, uint256 indexed orderID, uint256 indexed buyTokenIndex, uint256 buyAmount)') as any,
        fromBlock: 'earliest'
      });

      const txs: Transaction[] = [];

      for (const log of logs) {
        const orderId = log.args.orderID?.toString();
        const buyer = log.args.buyer as string; // Get buyer address from event
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
              buyer // Add buyer address to transaction
            });
          }
        } catch (txError) {
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

  return (
    <>
      <DisclaimerDialog open={showDisclaimer} onAccept={() => setShowDisclaimer(false)} />
      <LogoPreloader />
      <main className="flex min-h-screen flex-col items-center">

        {/* Main Content */}
        <div className="w-full px-2 md:px-8 mt-2">
          <div className="max-w-[1200px] mx-auto space-y-8">
            {isLoading ? (
              <div className="text-center py-12">
                <PixelSpinner size={48} className="mx-auto" />
                <p className="text-white mt-8">Loading</p>
              </div>
            ) : (
              <>
                <VolumeChart
                  transactions={transactions}
                  tokenPrices={tokenPrices}
                />

                <OrderVolumeChart
                  orders={orders}
                  tokenPrices={tokenPrices}
                />
              </>
            )}
          </div>
        </div>
      </main>
    </>
  );
}
