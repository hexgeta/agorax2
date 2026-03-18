'use client';

import { useMemo, useState } from 'react';
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
  selectedTokens?: string[];
}

interface TokenStats {
  address: string;
  ticker: string;
  listedVolume: number;
  tradedVolume: number;
  orderCount: number;
  fillCount: number;
}

export default function TopTokensChart({ transactions, orders, tokenPrices, contractOrders = [], onTokenSelect, selectedToken, selectedTokens }: TopTokensChartProps) {
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

  type SortKey = 'total' | 'ticker' | 'listedVolume' | 'tradedVolume';
  const [sortKey, setSortKey] = useState<SortKey>('total');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [tokenPage, setTokenPage] = useState(1);
  const TOKEN_PAGE_SIZE = 10;

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      setSortDir('desc');
    }
    setTokenPage(1);
  }

  const sortedTokenStats = useMemo(() => {
    const dir = sortDir === 'asc' ? 1 : -1;
    return [...tokenStats].sort((a, b) => {
      if (sortKey === 'total') {
        return ((a.listedVolume + a.tradedVolume) - (b.listedVolume + b.tradedVolume)) * dir;
      }
      if (sortKey === 'ticker') {
        return a.ticker.localeCompare(b.ticker) * dir;
      }
      return (a[sortKey] - b[sortKey]) * dir;
    });
  }, [tokenStats, sortKey, sortDir]);

  if (tokenStats.length === 0) {
    return null;
  }

  const tokenTotalPages = Math.max(1, Math.ceil(sortedTokenStats.length / TOKEN_PAGE_SIZE));
  const paginatedTokenStats = sortedTokenStats.slice((tokenPage - 1) * TOKEN_PAGE_SIZE, tokenPage * TOKEN_PAGE_SIZE);
  const maxVolume = sortedTokenStats[0] ? sortedTokenStats[0].listedVolume + sortedTokenStats[0].tradedVolume : 1;

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
        <div className="grid grid-cols-12 gap-2 text-gray-400 text-xs font-medium pb-2 px-3 border-b border-white/10">
          <div className="col-span-1">#</div>
          <div className="col-span-2 cursor-pointer hover:text-white select-none" onClick={() => toggleSort('ticker')}>
            Token{sortKey === 'ticker' && <span className="ml-1 text-white/60">{sortDir === 'asc' ? '▲' : '▼'}</span>}
          </div>
          <div className="col-span-3 text-right cursor-pointer hover:text-white select-none" onClick={() => toggleSort('listedVolume')}>
            Listed{sortKey === 'listedVolume' && <span className="ml-1 text-white/60">{sortDir === 'asc' ? '▲' : '▼'}</span>}
          </div>
          <div className="col-span-2 text-right cursor-pointer hover:text-white select-none" onClick={() => toggleSort('tradedVolume')}>
            Filled{sortKey === 'tradedVolume' && <span className="ml-1 text-white/60">{sortDir === 'asc' ? '▲' : '▼'}</span>}
          </div>
          <div className="col-span-2 text-right cursor-pointer hover:text-white select-none" onClick={() => toggleSort('total')}>
            Total{sortKey === 'total' && <span className="ml-1 text-white/60">{sortDir === 'asc' ? '▲' : '▼'}</span>}
          </div>
          <div className="col-span-2 text-right"></div>
        </div>

        {/* Rows */}
        {paginatedTokenStats.map((token, index) => {
          const globalIndex = (tokenPage - 1) * TOKEN_PAGE_SIZE + index;
          const totalVolume = token.listedVolume + token.tradedVolume;
          const barWidth = (totalVolume / maxVolume) * 100;
          const isSelected = selectedTokens
            ? selectedTokens.some(t => t.toLowerCase() === token.address.toLowerCase())
            : selectedToken?.toLowerCase() === token.address.toLowerCase();

          return (
            <div
              key={token.address}
              className={`group/row relative cursor-pointer transition-all rounded-lg ${isSelected ? 'border border-white/50 bg-white/10' : 'border border-transparent'}`}
              onClick={() => onTokenSelect?.(token.address, token.ticker)}
            >
              {/* Background bar */}
              <div
                className={`absolute inset-0 rounded transition-colors ${isSelected ? 'bg-white/10' : 'bg-white/5 group-hover/row:bg-white/10 group-has-[a:hover]/row:bg-white/5'}`}
                style={{ width: `${barWidth}%` }}
              />

              {/* Content */}
              <div className="grid grid-cols-12 gap-2 items-center py-2.5 px-3 relative">
                <div className="col-span-1">
                  <span className={`text-sm font-bold ${globalIndex < 3 ? 'text-white' : 'text-gray-500'}`}>
                    {globalIndex + 1}
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
                    href={`/marketplace?ticker=${formatTokenTicker(token.ticker)}`}
                    onClick={(e) => e.stopPropagation()}
                    className="inline-flex items-center gap-1.5 px-3 py-1 bg-white/10 hover:bg-white/20 border border-white/20 rounded-full text-white text-xs font-medium transition-colors"
                  >
                    Marketplace
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                    </svg>
                  </Link>
                </div>
              </div>
            </div>
          );
        })}
      </div>
      </div>

      {tokenTotalPages > 1 && (
        <div className="flex items-center justify-center gap-3 mt-4">
          <button
            onClick={() => setTokenPage(p => Math.max(1, p - 1))}
            disabled={tokenPage === 1}
            className="px-3 py-1 text-sm rounded bg-white/5 border border-white/10 text-gray-400 hover:text-white hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          >
            Prev
          </button>
          <span className="text-gray-500 text-sm">
            {tokenPage} / {tokenTotalPages}
          </span>
          <button
            onClick={() => setTokenPage(p => Math.min(tokenTotalPages, p + 1))}
            disabled={tokenPage === tokenTotalPages}
            className="px-3 py-1 text-sm rounded bg-white/5 border border-white/10 text-gray-400 hover:text-white hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          >
            Next
          </button>
        </div>
      )}

      <p className="text-gray-500 text-xs mt-4 text-center">
        Listed = sell token value in orders | Filled = value exchanged in fills
      </p>
    </LiquidGlassCard>
  );
}
