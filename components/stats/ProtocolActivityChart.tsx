'use client';

import { useMemo } from 'react';
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

export default function ProtocolActivityChart({ transactions, orders, contractOrders = [], tokenPrices }: ProtocolActivityChartProps) {
  // Calculate cumulative activity by day with volume data
  const chartData = useMemo(() => {
    // Track daily volumes
    const dailyData: Record<string, {
      orders: number;
      fills: number;
      uniqueUsers: Set<string>;
      listedVolume: number;
      filledVolume: number;
    }> = {};

    // Process orders for listed volume
    if (contractOrders.length > 0) {
      contractOrders.forEach(order => {
        const timestamp = Number(order.orderDetailsWithID.lastUpdateTime);
        if (!timestamp || timestamp <= 0) return;

        const date = new Date(timestamp * 1000);
        const dateStr = date.toISOString().split('T')[0];

        if (!dailyData[dateStr]) {
          dailyData[dateStr] = { orders: 0, fills: 0, uniqueUsers: new Set(), listedVolume: 0, filledVolume: 0 };
        }

        // Calculate order value in USD
        const sellTokenAddr = order.orderDetailsWithID.orderDetails.sellToken;
        const tokenInfo = getTokenInfo(sellTokenAddr);
        const sellAmount = Number(order.orderDetailsWithID.orderDetails.sellAmount) / Math.pow(10, tokenInfo.decimals);
        const tokenPrice = getTokenPrice(sellTokenAddr, tokenPrices);
        const orderValueUSD = sellAmount * tokenPrice;

        dailyData[dateStr].orders += 1;
        dailyData[dateStr].listedVolume += orderValueUSD;

        const owner = order.userDetails.orderOwner;
        if (owner) {
          dailyData[dateStr].uniqueUsers.add(owner.toLowerCase());
        }
      });
    } else {
      orders.forEach(order => {
        if (!order.timestamp) return;

        const date = new Date(order.timestamp * 1000);
        const dateStr = date.toISOString().split('T')[0];

        if (!dailyData[dateStr]) {
          dailyData[dateStr] = { orders: 0, fills: 0, uniqueUsers: new Set(), listedVolume: 0, filledVolume: 0 };
        }

        const tokenPrice = getTokenPrice(order.sellToken, tokenPrices);
        const orderValueUSD = order.sellAmount * tokenPrice;

        dailyData[dateStr].orders += 1;
        dailyData[dateStr].listedVolume += orderValueUSD;

        if (order.orderOwner) {
          dailyData[dateStr].uniqueUsers.add(order.orderOwner.toLowerCase());
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
      const sellPrice = getTokenPrice(tx.sellToken, tokenPrices);
      const sellVolumeUSD = tx.sellAmount * sellPrice;

      const buyVolumesUSD = Object.entries(tx.buyTokens).map(([addr, amount]) => {
        const price = getTokenPrice(addr, tokenPrices);
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
        displayDate: currentDate.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }),
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

  // Calculate totals for header
  const totalListedVolume = useMemo(() => {
    return chartData.length > 0 ? chartData[chartData.length - 1].cumulativeListedVolume : 0;
  }, [chartData]);

  const totalFilledVolume = useMemo(() => {
    return chartData.length > 0 ? chartData[chartData.length - 1].cumulativeFilledVolume : 0;
  }, [chartData]);

  const totalOrders = useMemo(() => {
    return chartData.length > 0 ? chartData[chartData.length - 1].cumulativeOrders : 0;
  }, [chartData]);

  const totalFills = useMemo(() => {
    return chartData.length > 0 ? chartData[chartData.length - 1].cumulativeFills : 0;
  }, [chartData]);

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
        <h3 className="text-2xl font-bold text-white mb-2">Protocol Volume</h3>
        <div className="flex flex-wrap gap-6">
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
          margin={{ top: 10, right: 30, left: 0, bottom: 0 }}
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
            dataKey="cumulativeFilledVolume"
            stroke="#4ADE80"
            strokeWidth={2}
            strokeOpacity={0.6}
            fill="url(#colorFilledVolume)"
            name="Filled"
          />
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
          {/* Daily volume bars */}
          <Bar
            yAxisId="left"
            dataKey="filledVolume"
            fill="#4ADE80"
            radius={[4, 4, 0, 0]}
            legendType="none"
          />
          <Bar
            yAxisId="left"
            dataKey="listedVolume"
            fill="#EC4899"
            radius={[4, 4, 0, 0]}
            legendType="none"
          />
        </ComposedChart>
      </ResponsiveContainer>
    </LiquidGlassCard>
  );
}
