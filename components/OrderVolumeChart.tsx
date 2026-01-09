'use client';

import { useMemo } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { getTokenInfo } from '@/utils/tokenUtils';

interface OrderPlaced {
  transactionHash: string;
  orderId: string;
  sellToken: string;
  sellAmount: number;
  blockNumber: bigint;
  timestamp?: number;
  orderOwner: string;
}

interface OrderVolumeChartProps {
  orders: OrderPlaced[];
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

// Format USD amount
const formatUSD = (amount: number) => {
  if (amount === 0) return '$0.00';
  if (amount < 1000) return `$${amount.toFixed(2)}`;
  if (amount < 1000000) return `$${(amount / 1000).toFixed(2)}K`;
  return `$${(amount / 1000000).toFixed(2)}M`;
};

import { LiquidGlassCard } from '@/components/ui/liquid-glass';

export default function OrderVolumeChart({ orders, tokenPrices }: OrderVolumeChartProps) {
  // Calculate daily order volume data
  const chartData = useMemo(() => {
    if (!orders || orders.length === 0) return [];

    // Group orders by day
    const volumeByDay: Record<string, {
      date: string;
      volume: number;
      orderCount: number;
      uniqueCreators: Set<string>;
    }> = {};

    orders.forEach(order => {
      if (!order.timestamp) return;

      // Get date string (YYYY-MM-DD)
      const date = new Date(order.timestamp * 1000);
      const dateStr = date.toISOString().split('T')[0];

      // Calculate order value in USD
      const tokenPrice = getTokenPrice(order.sellToken, tokenPrices);
      const orderValueUSD = order.sellAmount * tokenPrice;

      // Add to daily total
      if (!volumeByDay[dateStr]) {
        volumeByDay[dateStr] = {
          date: dateStr,
          volume: 0,
          orderCount: 0,
          uniqueCreators: new Set()
        };
      }
      volumeByDay[dateStr].volume += orderValueUSD;
      volumeByDay[dateStr].orderCount += 1;

      // Track unique order creators
      if (order.orderOwner) {
        volumeByDay[dateStr].uniqueCreators.add(order.orderOwner.toLowerCase());
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
      orderCount: number;
      uniqueCreators: number;
      displayDate: string;
    }[] = [];
    const currentDate = new Date(minDate);

    while (currentDate <= maxDate) {
      const dateStr = currentDate.toISOString().split('T')[0];
      const dayData = volumeByDay[dateStr];

      allDays.push({
        date: dateStr,
        volume: dayData?.volume || 0,
        orderCount: dayData?.orderCount || 0,
        uniqueCreators: dayData?.uniqueCreators?.size || 0,
        displayDate: currentDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
      });

      // Move to next day
      currentDate.setDate(currentDate.getDate() + 1);
    }

    return allDays;
  }, [orders, tokenPrices]);

  const totalVolume = useMemo(() => {
    return chartData.reduce((sum, day) => sum + day.volume, 0);
  }, [chartData]);

  const totalOrders = useMemo(() => {
    return orders.length;
  }, [orders]);

  if (chartData.length === 0) {
    return null;
  }

  return (
    <LiquidGlassCard
      className="p-6 bg-black/40"
      shadowIntensity="none"
      glowIntensity="none"
    >
      <div className="mb-6">
        <h3 className="text-2xl font-bold text-white mb-2">Order Creation Volume</h3>
        <div className="flex gap-6">
          <div>
            <p className="text-gray-400 text-sm">Total Listed</p>
            <p className="text-white text-xl font-bold">{formatUSD(totalVolume)}</p>
          </div>
          <div>
            <p className="text-gray-400 text-sm">Total Orders</p>
            <p className="text-white text-xl font-bold">{totalOrders}</p>
          </div>
          <div>
            <p className="text-gray-400 text-sm">Active Days</p>
            <p className="text-white text-xl font-bold">{chartData.filter(d => d.orderCount > 0).length}</p>
          </div>
        </div>
      </div>

      <ResponsiveContainer width="100%" height={300}>
        <BarChart
          data={chartData}
          margin={{ top: 10, right: 30, left: 0, bottom: 0 }}
        >
          <CartesianGrid strokeDasharray="10 10" stroke="#FFFFFF20" />
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
                    <span style={{ color: '#FFFFFF' }}>Listed Value:</span>{' '}
                    <span style={{ fontWeight: 'bold' }}>{formatUSD(data.volume)}</span>
                  </p>
                  <p style={{ margin: '4px 0', fontSize: '14px' }}>
                    <span style={{ color: '#FFFFFF' }}>Orders Created:</span>{' '}
                    <span style={{ fontWeight: 'bold' }}>{data.orderCount}</span>
                  </p>
                  <p style={{ margin: '4px 0', fontSize: '14px' }}>
                    <span style={{ color: '#FFFFFF' }}>Unique Creators:</span>{' '}
                    <span style={{ fontWeight: 'bold' }}>{data.uniqueCreators}</span>
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
            fill="#FF0080"
            radius={[8, 8, 0, 0]}
            name="Listed Value (USD)"
          />
        </BarChart>
      </ResponsiveContainer>
    </LiquidGlassCard>
  );
}
