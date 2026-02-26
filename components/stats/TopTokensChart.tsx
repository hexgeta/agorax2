'use client';

import { useMemo } from 'react';
import Link from 'next/link';
import { LiquidGlassCard } from '@/components/ui/liquid-glass';
import { formatUSD, getTokenPrice } from '@/utils/format';
import { getTokenInfo, formatTokenTicker } from '@/utils/tokenUtils';
import { CoinLogo } from '@/components/ui/CoinLogo';
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

interface TopTokensChartProps {
  transactions: Transaction[];
  orders: OrderPlaced[];
  tokenPrices: Record<string, { price: number }>;
  contractOrders?: CompleteOrderDetails[];
  onTokenSelect?: (address: string, ticker: string) => void;
  selectedToken?: string;
}

interface TokenStats {
  address: string;
  ticker: string;
  listedVolume: number;
  tradedVolume: number;
  orderCount: number;
  fillCount: number;
}

export default function TopTokensChart({ transactions, orders, tokenPrices, contractOrders = [], onTokenSelect, selectedToken }: TopTokensChartProps) {
  // Calculate token stats
  const tokenStats = useMemo(() => {
    const stats: Record<string, TokenStats> = {};

    const ensureToken = (addr: string) => {
      if (!stats[addr]) {
        const tokenInfo = getTokenInfo(addr);
        stats[addr] = {
          address: addr,
          ticker: tokenInfo.ticker,
          listedVolume: 0,
          tradedVolume: 0,
          orderCount: 0,
          fillCount: 0
        };
      }
    };

    // Process orders (listed volume) - prefer contract orders if available
    if (contractOrders.length > 0) {
      contractOrders.forEach(order => {
        const sellAddr = order.orderDetailsWithID.orderDetails.sellToken.toLowerCase();
        const sellTokenInfo = getTokenInfo(sellAddr);
        const sellAmount = Number(order.orderDetailsWithID.orderDetails.sellAmount) / Math.pow(10, sellTokenInfo.decimals);
        const sellPrice = getTokenPrice(sellAddr, tokenPrices);
        const sellVolume = sellAmount * sellPrice;

        ensureToken(sellAddr);
        stats[sellAddr].listedVolume += sellVolume;
        stats[sellAddr].orderCount += 1;
      });
    } else {
      orders.forEach(order => {
        const addr = order.sellToken.toLowerCase();
        const price = getTokenPrice(addr, tokenPrices);
        const volume = order.sellAmount * price;

        ensureToken(addr);
        stats[addr].listedVolume += volume;
        stats[addr].orderCount += 1;
      });
    }

    // Process fills (traded volume) - only count sell side for fills/orders ratio
    transactions.forEach(tx => {
      if (tx.sellToken) {
        const sellAddr = tx.sellToken.toLowerCase();
        const sellPrice = getTokenPrice(sellAddr, tokenPrices);
        const sellVolume = tx.sellAmount * sellPrice;

        ensureToken(sellAddr);
        stats[sellAddr].tradedVolume += sellVolume;
        stats[sellAddr].fillCount += 1;
      }

      // Add buy tokens volume but don't count as fills (they weren't listed as orders)
      Object.entries(tx.buyTokens).forEach(([addr, amount]) => {
        const buyAddr = addr.toLowerCase();
        const buyPrice = getTokenPrice(buyAddr, tokenPrices);
        const buyVolume = amount * buyPrice;

        ensureToken(buyAddr);
        stats[buyAddr].tradedVolume += buyVolume;
        // Don't increment fillCount for buy tokens - only sell tokens have orders
      });
    });

    return Object.values(stats)
      .sort((a, b) => (b.listedVolume + b.tradedVolume) - (a.listedVolume + a.tradedVolume))
      .slice(0, 10);
  }, [transactions, orders, tokenPrices, contractOrders]);

  if (tokenStats.length === 0) {
    return null;
  }

  const maxVolume = tokenStats[0] ? tokenStats[0].listedVolume + tokenStats[0].tradedVolume : 1;

  return (
    <LiquidGlassCard
      className="p-6 bg-black/40"
      shadowIntensity="none"
      glowIntensity="none"
    >
      <h3 className="text-2xl font-bold text-white mb-6">Top Tokens</h3>

      <div className="overflow-x-auto pb-2 modern-scrollbar">
        <div className="min-w-[700px] space-y-3">
        {/* Header */}
        <div className="grid grid-cols-12 gap-2 text-gray-400 text-xs font-medium pb-2 border-b border-white/10">
          <div className="col-span-1">#</div>
          <div className="col-span-2">Token</div>
          <div className="col-span-3 text-right">Listed</div>
          <div className="col-span-2 text-right">Filled</div>
          <div className="col-span-2 text-right">Total</div>
          <div className="col-span-2 text-right"></div>
        </div>

        {/* Rows */}
        {tokenStats.map((token, index) => {
          const totalVolume = token.listedVolume + token.tradedVolume;
          const barWidth = (totalVolume / maxVolume) * 100;
          const isSelected = selectedToken?.toLowerCase() === token.address.toLowerCase();

          return (
            <div
              key={token.address}
              className={`group/row relative cursor-pointer transition-all rounded ${isSelected ? 'ring-1 ring-white/50' : ''}`}
              onClick={() => onTokenSelect?.(token.address, token.ticker)}
            >
              {/* Background bar */}
              <div
                className={`absolute inset-0 rounded transition-colors ${isSelected ? 'bg-white/10' : 'bg-white/5 group-hover/row:bg-white/10 group-has-[a:hover]/row:bg-white/5'}`}
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
                    <CoinLogo symbol={token.ticker} size="sm" />
                    <span className="text-white font-medium text-sm">{formatTokenTicker(token.ticker)}</span>
                    {isSelected && (
                      <span className="text-[10px] px-1.5 py-0.5 bg-white/20 text-white rounded">FILTERED</span>
                    )}
                  </div>
                </div>
                <div className="col-span-3 text-right">
                  {token.listedVolume > 0 ? (
                    <>
                      <span className="text-pink-400 text-sm">{formatUSD(token.listedVolume)}</span>
                      <span className="text-gray-500 text-xs ml-1">({token.orderCount})</span>
                    </>
                  ) : (
                    <span className="text-gray-600 text-sm">-</span>
                  )}
                </div>
                <div className="col-span-2 text-right">
                  {token.tradedVolume > 0 ? (
                    <>
                      <span className="text-green-400 text-sm">{formatUSD(token.tradedVolume)}</span>
                      <span className="text-gray-500 text-xs ml-1">({token.fillCount})</span>
                    </>
                  ) : (
                    <span className="text-gray-600 text-sm">-</span>
                  )}
                </div>
                <div className="col-span-2 text-right">
                  <span className="text-white font-bold text-sm">{formatUSD(totalVolume)}</span>
                </div>
                <div className="col-span-2 text-right">
                  <Link
                    href={`/marketplace?token=${token.address}`}
                    onClick={(e) => e.stopPropagation()}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-black text-white border border-white text-xs font-medium rounded-full hover:bg-white/10 transition-colors"
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
      </div>

      <p className="text-gray-500 text-xs mt-4 text-center">
        Listed = sell token value in orders | Filled = value exchanged in fills
      </p>
    </LiquidGlassCard>
  );
}
