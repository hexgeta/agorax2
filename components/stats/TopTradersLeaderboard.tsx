'use client';

import { useMemo } from 'react';
import Link from 'next/link';
import { LiquidGlassCard } from '@/components/ui/liquid-glass';
import { formatUSD, getTokenPrice } from '@/utils/format';
import { getTokenInfo } from '@/utils/tokenUtils';
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

interface TopTradersLeaderboardProps {
  transactions: Transaction[];
  orders: OrderPlaced[];
  tokenPrices: Record<string, { price: number }>;
  contractOrders?: CompleteOrderDetails[];
  onTraderSelect?: (address: string) => void;
  selectedTrader?: string;
}

interface TraderStats {
  address: string;
  buyVolume: number;
  sellVolume: number;
  totalVolume: number;
  buyCount: number;
  sellCount: number;
  totalCount: number;
}

function formatAddress(address: string): string {
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

export default function TopTradersLeaderboard({ transactions, orders, tokenPrices, contractOrders = [], onTraderSelect, selectedTrader }: TopTradersLeaderboardProps) {
  // Calculate trader stats
  const traderStats = useMemo(() => {
    const stats: Record<string, TraderStats> = {};

    // Process fills (buyers)
    transactions.forEach(tx => {
      if (!tx.buyer) return;
      const buyer = tx.buyer.toLowerCase();

      if (!stats[buyer]) {
        stats[buyer] = {
          address: buyer,
          buyVolume: 0,
          sellVolume: 0,
          totalVolume: 0,
          buyCount: 0,
          sellCount: 0,
          totalCount: 0
        };
      }

      const price = getTokenPrice(tx.sellToken, tokenPrices);
      const volume = tx.sellAmount * price;

      stats[buyer].buyVolume += volume;
      stats[buyer].totalVolume += volume;
      stats[buyer].buyCount += 1;
      stats[buyer].totalCount += 1;
    });

    // Process orders (sellers) - prefer contract orders if available
    if (contractOrders.length > 0) {
      contractOrders.forEach(order => {
        const seller = order.userDetails.orderOwner?.toLowerCase();
        if (!seller) return;

        if (!stats[seller]) {
          stats[seller] = {
            address: seller,
            buyVolume: 0,
            sellVolume: 0,
            totalVolume: 0,
            buyCount: 0,
            sellCount: 0,
            totalCount: 0
          };
        }

        const sellTokenAddr = order.orderDetailsWithID.orderDetails.sellToken;
        const tokenInfo = getTokenInfo(sellTokenAddr);
        const sellAmount = Number(order.orderDetailsWithID.orderDetails.sellAmount) / Math.pow(10, tokenInfo.decimals);
        const price = getTokenPrice(sellTokenAddr, tokenPrices);
        const volume = sellAmount * price;

        stats[seller].sellVolume += volume;
        stats[seller].totalVolume += volume;
        stats[seller].sellCount += 1;
        stats[seller].totalCount += 1;
      });
    } else {
      orders.forEach(order => {
        if (!order.orderOwner) return;
        const seller = order.orderOwner.toLowerCase();

        if (!stats[seller]) {
          stats[seller] = {
            address: seller,
            buyVolume: 0,
            sellVolume: 0,
            totalVolume: 0,
            buyCount: 0,
            sellCount: 0,
            totalCount: 0
          };
        }

        const price = getTokenPrice(order.sellToken, tokenPrices);
        const volume = order.sellAmount * price;

        stats[seller].sellVolume += volume;
        stats[seller].totalVolume += volume;
        stats[seller].sellCount += 1;
        stats[seller].totalCount += 1;
      });
    }

    // Sort by total volume
    return Object.values(stats)
      .sort((a, b) => b.totalVolume - a.totalVolume)
      .slice(0, 10);
  }, [transactions, orders, tokenPrices, contractOrders]);

  if (traderStats.length === 0) {
    return null;
  }

  // Get max volume for bar width calculation
  const maxVolume = traderStats[0]?.totalVolume || 1;

  return (
    <LiquidGlassCard
      className="p-6 bg-black/40"
      shadowIntensity="none"
      glowIntensity="none"
    >
      <h3 className="text-2xl font-bold text-white mb-6">Top Traders</h3>

      <div className="space-y-3">
        {/* Header */}
        <div className="grid grid-cols-12 gap-2 text-gray-400 text-xs font-medium pb-2 border-b border-white/10">
          <div className="col-span-1">#</div>
          <div className="col-span-2">Address</div>
          <div className="col-span-2 text-right">Buy Volume</div>
          <div className="col-span-3 text-right">Sell Volume</div>
          <div className="col-span-2 text-right">Total</div>
          <div className="col-span-2 text-right"></div>
        </div>

        {/* Rows */}
        {traderStats.map((trader, index) => {
          const barWidth = (trader.totalVolume / maxVolume) * 100;
          const isSelected = selectedTrader?.toLowerCase() === trader.address.toLowerCase();

          return (
            <div
              key={trader.address}
              className={`relative cursor-pointer transition-all ${isSelected ? 'ring-1 ring-white/50 rounded' : 'hover:bg-white/5 rounded'}`}
              onClick={() => onTraderSelect?.(trader.address)}
            >
              {/* Background bar */}
              <div
                className={`absolute inset-0 rounded ${isSelected ? 'bg-white/10' : 'bg-white/5'}`}
                style={{ width: `${barWidth}%` }}
              />

              {/* Content */}
              <div className="grid grid-cols-12 gap-2 items-center py-2.5 px-1 relative">
                <div className="col-span-1">
                  <span className={`text-sm font-bold ${index < 3 ? 'text-white' : 'text-gray-500'}`}>
                    {index + 1}
                  </span>
                </div>
                <div className="col-span-2">
                  <div className="flex items-center gap-2">
                    <span className="text-white font-mono text-sm">
                      {formatAddress(trader.address)}
                    </span>
                    {isSelected && (
                      <span className="text-[10px] px-1.5 py-0.5 bg-white/20 text-white rounded">FILTERED</span>
                    )}
                  </div>
                </div>
                <div className="col-span-2 text-right">
                  <span className="text-green-400 text-sm">{formatUSD(trader.buyVolume)}</span>
                  <span className="text-gray-500 text-xs ml-1">({trader.buyCount})</span>
                </div>
                <div className="col-span-3 text-right">
                  <span className="text-pink-400 text-sm">{formatUSD(trader.sellVolume)}</span>
                  <span className="text-gray-500 text-xs ml-1">({trader.sellCount})</span>
                </div>
                <div className="col-span-2 text-right">
                  <span className="text-white font-bold text-sm">{formatUSD(trader.totalVolume)}</span>
                </div>
                <div className="col-span-2 text-right">
                  <Link
                    href={`/marketplace?seller=${trader.address}`}
                    onClick={(e) => e.stopPropagation()}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white text-black text-xs font-medium rounded-full hover:bg-white/90 transition-colors"
                  >
                    Marketplace
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </Link>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <p className="text-gray-500 text-xs mt-4 text-center">
        Buy volume = value filled | Sell volume = value listed
      </p>
    </LiquidGlassCard>
  );
}
