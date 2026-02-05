'use client';

import { useMemo } from 'react';
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip, Cell } from 'recharts';
import { LiquidGlassCard } from '@/components/ui/liquid-glass';
import { formatUSD, getTokenPrice } from '@/utils/format';
import { getTokenInfo } from '@/utils/tokenUtils';
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
}

interface TokenStats {
  address: string;
  ticker: string;
  listedVolume: number;
  tradedVolume: number;
  orderCount: number;
  fillCount: number;
}

const COLORS = ['#FFFFFF', '#E5E5E5', '#CCCCCC', '#B3B3B3', '#999999', '#808080', '#666666', '#4D4D4D', '#333333', '#1A1A1A'];

export default function TopTokensChart({ transactions, orders, tokenPrices, contractOrders = [] }: TopTokensChartProps) {
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
        // Track sell token
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
      // Fallback to event-based orders
      orders.forEach(order => {
        const addr = order.sellToken.toLowerCase();
        const tokenInfo = getTokenInfo(addr);
        const price = getTokenPrice(addr, tokenPrices);
        const volume = order.sellAmount * price;

        ensureToken(addr);
        stats[addr].listedVolume += volume;
        stats[addr].orderCount += 1;
      });
    }

    // Process fills (traded volume) - count both sell and buy tokens
    transactions.forEach(tx => {
      // Track sell token (what was sold from the order)
      if (tx.sellToken) {
        const sellAddr = tx.sellToken.toLowerCase();
        const sellPrice = getTokenPrice(sellAddr, tokenPrices);
        const sellVolume = tx.sellAmount * sellPrice;

        ensureToken(sellAddr);
        stats[sellAddr].tradedVolume += sellVolume;
        stats[sellAddr].fillCount += 1;
      }

      // Track buy tokens (what was paid by the buyer)
      Object.entries(tx.buyTokens).forEach(([addr, amount]) => {
        const buyAddr = addr.toLowerCase();
        const buyPrice = getTokenPrice(buyAddr, tokenPrices);
        const buyVolume = amount * buyPrice;

        ensureToken(buyAddr);
        stats[buyAddr].tradedVolume += buyVolume;
        stats[buyAddr].fillCount += 1;
      });
    });

    // Sort by total volume and take top 10
    return Object.values(stats)
      .sort((a, b) => (b.listedVolume + b.tradedVolume) - (a.listedVolume + a.tradedVolume))
      .slice(0, 10);
  }, [transactions, orders, tokenPrices, contractOrders]);

  if (tokenStats.length === 0) {
    return null;
  }

  const chartData = tokenStats.map(token => ({
    ticker: token.ticker,
    address: token.address,
    listed: token.listedVolume,
    traded: token.tradedVolume,
    total: token.listedVolume + token.tradedVolume
  }));

  return (
    <LiquidGlassCard
      className="p-6 bg-black/40"
      shadowIntensity="none"
      glowIntensity="none"
    >
      <h3 className="text-2xl font-bold text-white mb-6">Most Traded Tokens</h3>

      {/* Token cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
        {tokenStats.slice(0, 5).map((token, index) => (
          <div
            key={token.address}
            className="bg-white/5 rounded-lg p-3 flex flex-col items-center"
          >
            <div className="flex items-center gap-2 mb-2">
              <span className="text-gray-500 text-sm">#{index + 1}</span>
              <CoinLogo symbol={token.ticker} size="md" />
            </div>
            <span className="text-white font-bold text-sm">{token.ticker}</span>
            <span className="text-gray-400 text-xs">{formatUSD(token.listedVolume)}</span>
            <span className="text-gray-500 text-xs">{token.orderCount} orders</span>
          </div>
        ))}
      </div>

      {/* Bar chart */}
      <ResponsiveContainer width="100%" height={300}>
        <BarChart
          data={chartData}
          layout="vertical"
          margin={{ top: 10, right: 30, left: 60, bottom: 0 }}
        >
          <XAxis
            type="number"
            stroke="#FFFFFF"
            tick={{ fill: '#FFFFFF', fontSize: 12 }}
            tickLine={{ stroke: '#FFFFFF' }}
            tickFormatter={(value) => formatUSD(value)}
          />
          <YAxis
            type="category"
            dataKey="ticker"
            stroke="#FFFFFF"
            tick={{ fill: '#FFFFFF', fontSize: 12 }}
            tickLine={{ stroke: '#FFFFFF' }}
            width={50}
          />
          <Tooltip
            content={({ active, payload }) => {
              if (!active || !payload || !payload[0]) return null;
              const data = payload[0].payload;

              return (
                <div style={{
                  backgroundColor: '#1a1a1a',
                  border: '2px solid #FFFFFF',
                  borderRadius: '8px',
                  padding: '12px',
                  color: '#fff',
                }}>
                  <p style={{ fontWeight: 'bold', marginBottom: '8px' }}>{data.ticker}</p>
                  <p style={{ margin: '4px 0', fontSize: '14px' }}>
                    <span style={{ color: '#FF0080' }}>Listed:</span>{' '}
                    <span style={{ fontWeight: 'bold' }}>{formatUSD(data.listed)}</span>
                  </p>
                  <p style={{ margin: '4px 0', fontSize: '14px' }}>
                    <span style={{ color: '#FFFFFF' }}>Traded:</span>{' '}
                    <span style={{ fontWeight: 'bold' }}>{formatUSD(data.traded)}</span>
                  </p>
                </div>
              );
            }}
          />
          <Bar dataKey="listed" stackId="a" fill="#FF0080" radius={[0, 0, 0, 0]} name="Listed">
            {chartData.map((_, index) => (
              <Cell key={`cell-listed-${index}`} fill="#FF0080" />
            ))}
          </Bar>
          <Bar dataKey="traded" stackId="a" fill="#FFFFFF" radius={[0, 4, 4, 0]} name="Traded">
            {chartData.map((_, index) => (
              <Cell key={`cell-traded-${index}`} fill="#FFFFFF" />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>

      <div className="flex justify-center gap-6 mt-4">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 bg-[#FF0080] rounded" />
          <span className="text-gray-400 text-sm">Listed Volume</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 bg-white rounded" />
          <span className="text-gray-400 text-sm">Traded Volume</span>
        </div>
      </div>
    </LiquidGlassCard>
  );
}
