'use client';

import { useMemo } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { getTokenInfo } from '@/utils/tokenUtils';

interface Transaction {
  transactionHash: string;
  orderId: string;
  sellToken: string;
  sellAmount: number;
  buyTokens: Record<string, number>;
  blockNumber: bigint;
  timestamp?: number;
  buyer?: string; // Add buyer address
}

interface VolumeChartProps {
  transactions: Transaction[];
  tokenPrices: Record<string, { price: number }>;
}

// Helper to get token price
const getTokenPrice = (tokenAddress: string, tokenPrices: any): number => {
  // Hardcode weDAI to $1.00
  if (tokenAddress.toLowerCase() === '0xefd766ccb38eaf1dfd701853bfce31359239f305') {
    return 1.0;
  }

  // Use WPLS price for PLS (native token addresses)
  const plsAddresses = [
    '0x0000000000000000000000000000000000000000',
    '0x000000000000000000000000000000000000dead',
  ];
  if (plsAddresses.some(addr => tokenAddress.toLowerCase() === addr.toLowerCase())) {
    const wplsPrice = tokenPrices['0xa1077a294dde1b09bb078844df40758a5d0f9a27']?.price;
    return wplsPrice || 0.000034;
  }

  return tokenPrices[tokenAddress]?.price || 0;
};

// Format USD amount (always 2 decimal places)
const formatUSD = (amount: number) => {
  if (amount === 0) return '$0.00';
  if (amount < 1000) return `$${amount.toFixed(2)}`;
  if (amount < 1000000) return `$${(amount / 1000).toFixed(2)}K`;
  return `$${(amount / 1000000).toFixed(2)}M`;
};

import { LiquidGlassCard } from '@/components/ui/liquid-glass';

export default function VolumeChart({ transactions, tokenPrices }: VolumeChartProps) {
  // Calculate daily volume data
  const chartData = useMemo(() => {
    if (!transactions || transactions.length === 0) return [];

    // Group transactions by day
    const volumeByDay: Record<string, {
      date: string;
      volume: number;
      trades: number;
      uniqueAddresses: Set<string>;
    }> = {};

    transactions.forEach(tx => {
      if (!tx.timestamp) return;

      // Get date string (YYYY-MM-DD)
      const date = new Date(tx.timestamp * 1000);
      const dateStr = date.toISOString().split('T')[0];

      // Calculate transaction volume in USD
      const sellPrice = getTokenPrice(tx.sellToken, tokenPrices);
      const sellVolumeUSD = tx.sellAmount * sellPrice;

      // Calculate buy volume (use max of all buy tokens)
      const buyVolumesUSD = Object.entries(tx.buyTokens).map(([addr, amount]) => {
        const price = getTokenPrice(addr, tokenPrices);
        return amount * price;
      });
      const buyVolumeUSD = buyVolumesUSD.length > 0 ? Math.max(...buyVolumesUSD) : 0;

      // Use the higher of sell or buy volume (more conservative estimate)
      const txVolumeUSD = Math.max(sellVolumeUSD, buyVolumeUSD);

      // Add to daily total
      if (!volumeByDay[dateStr]) {
        volumeByDay[dateStr] = {
          date: dateStr,
          volume: 0,
          trades: 0,
          uniqueAddresses: new Set()
        };
      }
      volumeByDay[dateStr].volume += txVolumeUSD;
      volumeByDay[dateStr].trades += 1;

      // Track unique buyer address if available
      if (tx.buyer) {
        volumeByDay[dateStr].uniqueAddresses.add(tx.buyer.toLowerCase());
      }
    });

    // Find min and max dates
    const dates = Object.keys(volumeByDay).sort();
    if (dates.length === 0) return [];

    const minDate = new Date(dates[0]);
    const maxDate = new Date(dates[dates.length - 1]);

    // Fill in all days between min and max
    const allDays: {
      date: string;
      volume: number;
      trades: number;
      uniqueAddresses: number;
      displayDate: string;
    }[] = [];
    const currentDate = new Date(minDate);

    while (currentDate <= maxDate) {
      const dateStr = currentDate.toISOString().split('T')[0];
      const dayData = volumeByDay[dateStr];

      allDays.push({
        date: dateStr,
        volume: dayData?.volume || 0,
        trades: dayData?.trades || 0,
        uniqueAddresses: dayData?.uniqueAddresses?.size || 0,
        displayDate: currentDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
      });

      // Move to next day
      currentDate.setDate(currentDate.getDate() + 1);
    }

    return allDays;
  }, [transactions, tokenPrices]);

  const totalVolume = useMemo(() => {
    return chartData.reduce((sum, day) => sum + day.volume, 0);
  }, [chartData]);

  const totalTrades = useMemo(() => {
    return transactions.length;
  }, [transactions]);

  if (chartData.length === 0) {
    return null;
  }

  return (
    <LiquidGlassCard
      className="p-6 bg-black/40"
      shadowIntensity="md"
      glowIntensity="medium"
    >
      <div className="mb-6">
        <h3 className="text-2xl font-bold text-white mb-2">Trading Volume</h3>
        <div className="flex gap-6">
          <div>
            <p className="text-gray-400 text-sm">Total Volume</p>
            <p className="text-white text-xl font-bold">{formatUSD(totalVolume)}</p>
          </div>
          <div>
            <p className="text-gray-400 text-sm">Total Trades</p>
            <p className="text-white text-xl font-bold">{totalTrades}</p>
          </div>
          <div>
            <p className="text-gray-400 text-sm">Active Days</p>
            <p className="text-white text-xl font-bold">{chartData.length}</p>
          </div>
        </div>
      </div>

      <ResponsiveContainer width="100%" height={300}>
        <BarChart
          data={chartData}
          margin={{ top: 10, right: 30, left: 0, bottom: 0 }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="#FFFFFF20" />
          <XAxis
            dataKey="displayDate"
            stroke="#FFFFFF"
            tick={{ fill: '#FFFFFF' }}
            tickLine={{ stroke: '#FFFFFF' }}
          />
          <YAxis
            stroke="#FFFFFF"
            tick={{ fill: '#FFFFFF' }}
            tickLine={{ stroke: '#FFFFFF' }}
            tickFormatter={(value) => formatUSD(value)}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: '#000',
              border: '2px solid #FFFFFF',
              borderRadius: '8px',
              color: '#fff',
              padding: '12px',
            }}
            labelStyle={{ color: '#FFFFFF', fontWeight: 'bold', marginBottom: '8px' }}
            content={({ active, payload }) => {
              if (!active || !payload || !payload[0]) return null;

              const data = payload[0].payload;

              return (
                <div style={{
                  backgroundColor: '#000',
                  border: '2px solid #FFFFFF',
                  borderRadius: '8px',
                  padding: '12px',
                  color: '#fff',
                }}>
                  <p style={{ color: '#FFFFFF', fontWeight: 'bold', marginBottom: '8px' }}>
                    {data.displayDate}
                  </p>
                  <p style={{ margin: '4px 0', fontSize: '14px' }}>
                    <span style={{ color: '#FFFFFF' }}>Volume:</span>{' '}
                    <span style={{ fontWeight: 'bold' }}>{formatUSD(data.volume)}</span>
                  </p>
                  <p style={{ margin: '4px 0', fontSize: '14px' }}>
                    <span style={{ color: '#FFFFFF' }}>Trades:</span>{' '}
                    <span style={{ fontWeight: 'bold' }}>{data.trades}</span>
                  </p>
                  <p style={{ margin: '4px 0', fontSize: '14px' }}>
                    <span style={{ color: '#FFFFFF' }}>Unique Addresses:</span>{' '}
                    <span style={{ fontWeight: 'bold' }}>{data.uniqueAddresses}</span>
                  </p>
                </div>
              );
            }}
          />
          <Legend
            wrapperStyle={{ color: '#FFFFFF' }}
            iconType="square"
          />
          <Bar
            dataKey="volume"
            fill="#FFFFFF"
            radius={[8, 8, 0, 0]}
            name="Volume (USD)"
          />
        </BarChart>
      </ResponsiveContainer>
    </LiquidGlassCard >
  );
}
