'use client';

import { useMemo } from 'react';
import { ComposedChart, Bar, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { LiquidGlassCard } from '@/components/ui/liquid-glass';
import { getTokenPrice, formatUSD } from '@/utils/format';
import { getTokenInfo } from '@/utils/tokenUtils';
import { CompleteOrderDetails } from '@/hooks/contracts/useOpenPositions';

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
  contractOrders?: CompleteOrderDetails[];
}

export default function OrderVolumeChart({ orders, tokenPrices, contractOrders = [] }: OrderVolumeChartProps) {
  // Calculate daily order volume data
  const chartData = useMemo(() => {
    // Group orders by day
    const volumeByDay: Record<string, {
      date: string;
      volume: number;
      orderCount: number;
      uniqueCreators: Set<string>;
    }> = {};

    // Use contract orders if available, otherwise fall back to event orders
    if (contractOrders.length > 0) {
      contractOrders.forEach(order => {
        const timestamp = Number(order.orderDetailsWithID.lastUpdateTime);
        if (!timestamp || timestamp <= 0) return;

        // Get date string (YYYY-MM-DD)
        const date = new Date(timestamp * 1000);
        const dateStr = date.toISOString().split('T')[0];

        // Calculate order value in USD
        const sellTokenAddr = order.orderDetailsWithID.orderDetails.sellToken;
        const tokenInfo = getTokenInfo(sellTokenAddr);
        const sellAmount = Number(order.orderDetailsWithID.orderDetails.sellAmount) / Math.pow(10, tokenInfo.decimals);
        const tokenPrice = getTokenPrice(sellTokenAddr, tokenPrices);
        const orderValueUSD = sellAmount * tokenPrice;

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
        const owner = order.userDetails.orderOwner;
        if (owner) {
          volumeByDay[dateStr].uniqueCreators.add(owner.toLowerCase());
        }
      });
    } else {
      if (!orders || orders.length === 0) return [];

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
    }

    // Find min and max dates
    const dates = Object.keys(volumeByDay).sort();
    if (dates.length === 0) return [];

    const minDate = new Date(dates[0]);
    const maxDate = new Date(); // Use today's date

    // Fill in all days between min and max
    const allDays: {
      date: string;
      volume: number;
      orderCount: number;
      uniqueCreators: number;
      displayDate: string;
      cumulative: number;
    }[] = [];
    const currentDate = new Date(minDate);
    let cumulativeTotal = 0;

    while (currentDate <= maxDate) {
      const dateStr = currentDate.toISOString().split('T')[0];
      const dayData = volumeByDay[dateStr];
      const dayVolume = dayData?.volume || 0;
      cumulativeTotal += dayVolume;

      allDays.push({
        date: dateStr,
        volume: dayVolume,
        orderCount: dayData?.orderCount || 0,
        uniqueCreators: dayData?.uniqueCreators?.size || 0,
        displayDate: currentDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        cumulative: cumulativeTotal
      });

      // Move to next day
      currentDate.setDate(currentDate.getDate() + 1);
    }

    return allDays;
  }, [orders, tokenPrices, contractOrders]);

  const totalVolume = useMemo(() => {
    return chartData.reduce((sum, day) => sum + day.volume, 0);
  }, [chartData]);

  const totalOrders = useMemo(() => {
    return contractOrders.length > 0 ? contractOrders.length : orders.length;
  }, [orders.length, contractOrders.length]);

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
        <ComposedChart
          data={chartData}
          margin={{ top: 10, right: 30, left: 0, bottom: 0 }}
        >
          <defs>
            <linearGradient id="cumulativeGradientPink" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#FF0080" stopOpacity={0.3} />
              <stop offset="95%" stopColor="#FF0080" stopOpacity={0.05} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="10 10" stroke="#FFFFFF20" />
          <XAxis
            dataKey="displayDate"
            stroke="#FFFFFF"
            tick={{ fill: '#FFFFFF' }}
            tickLine={{ stroke: '#FFFFFF' }}
          />
          <YAxis
            yAxisId="left"
            stroke="#FFFFFF"
            tick={{ fill: '#FFFFFF' }}
            tickLine={{ stroke: '#FFFFFF' }}
            tickFormatter={(value) => formatUSD(value)}
          />
          <YAxis
            yAxisId="right"
            orientation="right"
            stroke="#FF008080"
            tick={{ fill: '#FF008080' }}
            tickLine={{ stroke: '#FF008080' }}
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
                    <span style={{ color: '#FF0080' }}>Cumulative:</span>{' '}
                    <span style={{ fontWeight: 'bold' }}>{formatUSD(data.cumulative)}</span>
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
          <Area
            yAxisId="right"
            type="monotone"
            dataKey="cumulative"
            fill="url(#cumulativeGradientPink)"
            stroke="#FF0080"
            strokeWidth={2}
            strokeOpacity={0.6}
            name="Cumulative (USD)"
          />
          <Bar
            yAxisId="left"
            dataKey="volume"
            fill="#FF0080"
            radius={[8, 8, 0, 0]}
            name="Listed Value (USD)"
          />
        </ComposedChart>
      </ResponsiveContainer>
    </LiquidGlassCard>
  );
}
