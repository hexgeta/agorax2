'use client';

import { useMemo, useState } from 'react';
import { ComposedChart, Area, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip, CartesianGrid, Legend } from 'recharts';
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

interface ProtocolActivityChartProps {
  transactions: Transaction[];
  orders: OrderPlaced[];
  contractOrders?: CompleteOrderDetails[];
  tokenPrices: Record<string, { price: number }>;
}

type TimeRange = '1D' | '1W' | '1M' | '1Y' | 'ALL';

function getTimeRangeStart(range: TimeRange): Date | null {
  if (range === 'ALL') return null;
  const now = new Date();
  switch (range) {
    case '1D': now.setDate(now.getDate() - 1); break;
    case '1W': now.setDate(now.getDate() - 7); break;
    case '1M': now.setMonth(now.getMonth() - 1); break;
    case '1Y': now.setFullYear(now.getFullYear() - 1); break;
  }
  return now;
}

export default function ProtocolActivityChart({ transactions, orders, contractOrders = [], tokenPrices }: ProtocolActivityChartProps) {
  const [timeRange, setTimeRange] = useState<TimeRange>('1M');

  // Calculate cumulative activity by day with volume data
  const allChartData = useMemo(() => {
    const prices = tokenPrices;
    // Track daily volumes
    const dailyData: Record<string, {
      orders: number;
      fills: number;
      uniqueUsers: Set<string>;
      listedVolume: number;
      filledVolume: number;
    }> = {};

    // Process orders for listed volume
    // Prefer event-based orders (from OrderPlaced events) since they have
    // the real creation timestamp. But only use them if we got a complete set —
    // some RPC nodes return partial getLogs results, causing lower totals.
    // contractOrders use lastUpdateTime which can shift dates but are always complete.
    if (orders.length > 0 && orders.length >= contractOrders.length) {
      orders.forEach(order => {
        if (!order.timestamp) return;

        const date = new Date(order.timestamp * 1000);
        const dateStr = date.toISOString().split('T')[0];

        if (!dailyData[dateStr]) {
          dailyData[dateStr] = { orders: 0, fills: 0, uniqueUsers: new Set(), listedVolume: 0, filledVolume: 0 };
        }

        const tokenPrice = getTokenPrice(order.sellToken, prices);
        const orderValueUSD = order.sellAmount * tokenPrice;

        dailyData[dateStr].orders += 1;
        dailyData[dateStr].listedVolume += orderValueUSD;

        if (order.orderOwner) {
          dailyData[dateStr].uniqueUsers.add(order.orderOwner.toLowerCase());
        }
      });
    } else if (contractOrders.length > 0) {
      // Fallback: use contract orders if event data isn't available yet
      contractOrders.forEach(order => {
        const timestamp = Number(order.orderDetailsWithID.lastUpdateTime);
        if (!timestamp || timestamp <= 0) return;

        const date = new Date(timestamp * 1000);
        const dateStr = date.toISOString().split('T')[0];

        if (!dailyData[dateStr]) {
          dailyData[dateStr] = { orders: 0, fills: 0, uniqueUsers: new Set(), listedVolume: 0, filledVolume: 0 };
        }

        const sellTokenAddr = order.orderDetailsWithID.orderDetails.sellToken;
        const tokenInfo = getTokenInfo(sellTokenAddr);
        const sellAmount = Number(order.orderDetailsWithID.orderDetails.sellAmount) / Math.pow(10, tokenInfo.decimals);
        const tokenPrice = getTokenPrice(sellTokenAddr, prices);
        const orderValueUSD = sellAmount * tokenPrice;

        dailyData[dateStr].orders += 1;
        dailyData[dateStr].listedVolume += orderValueUSD;

        const owner = order.userDetails.orderOwner;
        if (owner) {
          dailyData[dateStr].uniqueUsers.add(owner.toLowerCase());
        }
      });
    }

    // Process transactions for filled volume
    transactions.forEach(tx => {
      if (!tx.timestamp) return;

      const date = new Date(tx.timestamp * 1000);
      const dateStr = date.toISOString().split('T')[0];

      if (!dailyData[dateStr]) {
        dailyData[dateStr] = { orders: 0, fills: 0, uniqueUsers: new Set(), listedVolume: 0, filledVolume: 0 };
      }

      // Calculate transaction volume in USD
      const sellPrice = getTokenPrice(tx.sellToken, prices);
      const sellVolumeUSD = tx.sellAmount * sellPrice;

      const buyVolumesUSD = Object.entries(tx.buyTokens).map(([addr, amount]) => {
        const price = getTokenPrice(addr, prices);
        return amount * price;
      });
      const buyVolumeUSD = buyVolumesUSD.length > 0 ? Math.max(...buyVolumesUSD) : 0;

      const txVolumeUSD = Math.max(sellVolumeUSD, buyVolumeUSD);

      dailyData[dateStr].fills += 1;
      dailyData[dateStr].filledVolume += txVolumeUSD;

      if (tx.buyer) {
        dailyData[dateStr].uniqueUsers.add(tx.buyer.toLowerCase());
      }
    });

    // Fill in all days up to today
    const dates = Object.keys(dailyData).sort();
    if (dates.length === 0) return [];

    const minDate = new Date(dates[0]);
    const maxDate = new Date(); // Use today's date

    const result: {
      date: string;
      displayDate: string;
      cumulativeOrders: number;
      cumulativeFills: number;
      cumulativeListedVolume: number;
      cumulativeFilledVolume: number;
      dailyOrders: number;
      dailyFills: number;
      dailyUsers: number;
      listedVolume: number;
      filledVolume: number;
    }[] = [];

    let cumulativeOrders = 0;
    let cumulativeFills = 0;
    let cumulativeListedVolume = 0;
    let cumulativeFilledVolume = 0;
    const currentDate = new Date(minDate);

    while (currentDate <= maxDate) {
      const dateStr = currentDate.toISOString().split('T')[0];
      const dayData = dailyData[dateStr];

      if (dayData) {
        cumulativeOrders += dayData.orders;
        cumulativeFills += dayData.fills;
        cumulativeListedVolume += dayData.listedVolume;
        cumulativeFilledVolume += dayData.filledVolume;
      }

      result.push({
        date: dateStr,
        displayDate: currentDate.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' }),
        cumulativeOrders,
        cumulativeFills,
        cumulativeListedVolume,
        cumulativeFilledVolume,
        dailyOrders: dayData?.orders || 0,
        dailyFills: dayData?.fills || 0,
        dailyUsers: dayData?.uniqueUsers?.size || 0,
        listedVolume: dayData?.listedVolume || 0,
        filledVolume: dayData?.filledVolume || 0
      });

      currentDate.setDate(currentDate.getDate() + 1);
    }

    return result;
  }, [transactions, orders, contractOrders, tokenPrices]);

  // Filter chart data by time range
  const chartData = useMemo(() => {
    const rangeStart = getTimeRangeStart(timeRange);
    if (!rangeStart || allChartData.length === 0) return allChartData;

    const startStr = rangeStart.toISOString().split('T')[0];
    return allChartData.filter(d => d.date >= startStr);
  }, [allChartData, timeRange]);

  // Calculate totals for the visible range
  const { totalListedVolume, totalFilledVolume, totalOrders, totalFills } = useMemo(() => {
    if (timeRange === 'ALL' && chartData.length > 0) {
      const last = chartData[chartData.length - 1];
      return {
        totalListedVolume: last.cumulativeListedVolume,
        totalFilledVolume: last.cumulativeFilledVolume,
        totalOrders: last.cumulativeOrders,
        totalFills: last.cumulativeFills,
      };
    }
    // For filtered ranges, sum the visible daily data
    return chartData.reduce((acc, d) => ({
      totalListedVolume: acc.totalListedVolume + d.listedVolume,
      totalFilledVolume: acc.totalFilledVolume + d.filledVolume,
      totalOrders: acc.totalOrders + d.dailyOrders,
      totalFills: acc.totalFills + d.dailyFills,
    }), { totalListedVolume: 0, totalFilledVolume: 0, totalOrders: 0, totalFills: 0 });
  }, [chartData, timeRange]);

  if (allChartData.length === 0) {
    return null;
  }

  const timeRanges: TimeRange[] = ['1D', '1W', '1M', '1Y', 'ALL'];

  return (
    <LiquidGlassCard
      className="p-2 md:p-6 bg-black/40"
      shadowIntensity="none"
      glowIntensity="none"
    >
      <div className="mb-4 md:mb-6">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-xl md:text-2xl font-bold text-white">Protocol Volume</h3>
          <div className="flex gap-1 bg-white/5 rounded-lg p-0.5">
            {timeRanges.map(range => (
              <button
                key={range}
                onClick={() => setTimeRange(range)}
                className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors ${
                  timeRange === range
                    ? 'bg-white/15 text-white'
                    : 'text-white/40 hover:text-white/70'
                }`}
              >
                {range}
              </button>
            ))}
          </div>
        </div>
        <div className="flex flex-wrap gap-3 md:gap-6">
          <div>
            <p className="text-gray-400 text-sm">Listed Volume</p>
            <p className="text-pink-400 text-xl font-bold">{formatUSD(totalListedVolume)}</p>
          </div>
          <div>
            <p className="text-gray-400 text-sm">Filled Volume</p>
            <p className="text-green-400 text-xl font-bold">{formatUSD(totalFilledVolume)}</p>
          </div>
          <div>
            <p className="text-gray-400 text-sm">Orders</p>
            <p className="text-white text-xl font-bold">{totalOrders}</p>
          </div>
          <div>
            <p className="text-gray-400 text-sm">Fills</p>
            <p className="text-white text-xl font-bold">{totalFills}</p>
          </div>
        </div>
      </div>

      <ResponsiveContainer width="100%" height={350}>
        <ComposedChart
          data={chartData}
          margin={{ top: 10, right: 5, left: -10, bottom: 0 }}
          barGap={0}
          barCategoryGap="20%"
        >
          <defs>
            <linearGradient id="colorListedVolume" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#EC4899" stopOpacity={0.3} />
              <stop offset="95%" stopColor="#EC4899" stopOpacity={0.05} />
            </linearGradient>
            <linearGradient id="colorFilledVolume" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#4ADE80" stopOpacity={0.3} />
              <stop offset="95%" stopColor="#4ADE80" stopOpacity={0.05} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#FFFFFF20" />
          <XAxis
            dataKey="displayDate"
            stroke="#FFFFFF40"
            tick={{ fill: '#9CA3AF', fontSize: 12 }}
            tickLine={{ stroke: '#FFFFFF20' }}
            axisLine={{ stroke: '#FFFFFF20' }}
          />
          <YAxis
            yAxisId="left"
            stroke="#FFFFFF20"
            tick={{ fill: '#9CA3AF', fontSize: 12 }}
            tickLine={{ stroke: '#FFFFFF20' }}
            axisLine={{ stroke: '#FFFFFF20' }}
            tickCount={5}
            tickFormatter={(value) => {
              if (value === 0) return '$0';
              if (value >= 1000000) return `$${Math.round(value / 1000000)}M`;
              if (value >= 1000) return `$${Math.round(value / 1000)}K`;
              return `$${Math.round(value)}`;
            }}
          />
          <YAxis
            yAxisId="right"
            orientation="right"
            stroke="#FFFFFF20"
            tick={{ fill: '#6B7280', fontSize: 12 }}
            tickLine={{ stroke: '#FFFFFF20' }}
            axisLine={{ stroke: '#FFFFFF20' }}
            tickCount={5}
            tickFormatter={(value) => {
              if (value === 0) return '$0';
              if (value >= 1000000) return `$${Math.round(value / 1000000)}M`;
              if (value >= 1000) return `$${Math.round(value / 1000)}K`;
              return `$${Math.round(value)}`;
            }}
          />
          <Tooltip
            content={({ active, payload }) => {
              if (!active || !payload || !payload[0]) return null;
              const data = payload[0].payload;

              return (
                <div style={{
                  backgroundColor: 'rgba(0, 0, 0, 0.85)',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  borderRadius: '8px',
                  padding: '12px',
                  color: '#fff',
                  backdropFilter: 'blur(8px)',
                }}>
                  <p style={{ fontWeight: 'bold', marginBottom: '8px' }}>{data.displayDate}</p>
                  <p style={{ margin: '4px 0', fontSize: '14px' }}>
                    <span style={{ color: '#EC4899' }}>Listed Today:</span>{' '}
                    <span style={{ fontWeight: 'bold' }}>{formatUSD(data.listedVolume)}</span>
                    <span style={{ color: '#888', marginLeft: '8px' }}>({data.dailyOrders} orders)</span>
                  </p>
                  <p style={{ margin: '4px 0', fontSize: '14px' }}>
                    <span style={{ color: '#4ADE80' }}>Filled Today:</span>{' '}
                    <span style={{ fontWeight: 'bold' }}>{formatUSD(data.filledVolume)}</span>
                    <span style={{ color: '#888', marginLeft: '8px' }}>({data.dailyFills} fills)</span>
                  </p>
                  <hr style={{ margin: '8px 0', borderColor: 'rgba(255, 255, 255, 0.1)' }} />
                  <p style={{ margin: '4px 0', fontSize: '14px' }}>
                    <span style={{ color: '#EC489980' }}>Cumulative Listed:</span>{' '}
                    <span style={{ fontWeight: 'bold' }}>{formatUSD(data.cumulativeListedVolume)}</span>
                  </p>
                  <p style={{ margin: '4px 0', fontSize: '14px' }}>
                    <span style={{ color: '#4ADE8080' }}>Cumulative Filled:</span>{' '}
                    <span style={{ fontWeight: 'bold' }}>{formatUSD(data.cumulativeFilledVolume)}</span>
                  </p>
                  <p style={{ margin: '4px 0', fontSize: '14px' }}>
                    <span style={{ color: '#888' }}>Active Users:</span>{' '}
                    <span style={{ fontWeight: 'bold' }}>{data.dailyUsers}</span>
                  </p>
                </div>
              );
            }}
          />
          <Legend
            wrapperStyle={{ color: '#FFFFFF' }}
            iconType="circle"
          />
          {/* Cumulative areas behind bars */}
          <Area
            yAxisId="right"
            type="monotone"
            dataKey="cumulativeListedVolume"
            stroke="#EC4899"
            strokeWidth={2}
            strokeOpacity={0.6}
            fill="url(#colorListedVolume)"
            name="Listed"
          />
          <Area
            yAxisId="right"
            type="monotone"
            dataKey="cumulativeFilledVolume"
            stroke="#4ADE80"
            strokeWidth={2}
            strokeOpacity={0.6}
            fill="url(#colorFilledVolume)"
            name="Filled"
          />
          {/* Daily volume bars */}
          <Bar
            yAxisId="left"
            dataKey="listedVolume"
            fill="#EC4899"
            radius={[4, 4, 0, 0]}
            legendType="none"
          />
          <Bar
            yAxisId="left"
            dataKey="filledVolume"
            fill="#4ADE80"
            radius={[4, 4, 0, 0]}
            legendType="none"
          />
        </ComposedChart>
      </ResponsiveContainer>
    </LiquidGlassCard>
  );
}
