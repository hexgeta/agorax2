'use client';

import { useMemo } from 'react';
import { AreaChart, Area, XAxis, YAxis, ResponsiveContainer, Tooltip, CartesianGrid } from 'recharts';
import { LiquidGlassCard } from '@/components/ui/liquid-glass';
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
}

export default function ProtocolActivityChart({ transactions, orders, contractOrders = [] }: ProtocolActivityChartProps) {
  // Calculate cumulative activity by day
  const chartData = useMemo(() => {
    // Combine all events with their types
    const allEvents: { timestamp: number; type: 'order' | 'fill'; user?: string }[] = [];

    // Use contract orders if event orders are empty (more reliable)
    if (contractOrders.length > 0) {
      contractOrders.forEach(order => {
        const timestamp = Number(order.orderDetailsWithID.lastUpdateTime);
        if (timestamp && timestamp > 0) {
          allEvents.push({
            timestamp,
            type: 'order',
            user: order.userDetails.orderOwner?.toLowerCase()
          });
        }
      });
    } else {
      orders.forEach(order => {
        if (order.timestamp) {
          allEvents.push({
            timestamp: order.timestamp,
            type: 'order',
            user: order.orderOwner?.toLowerCase()
          });
        }
      });
    }

    transactions.forEach(tx => {
      if (tx.timestamp) {
        allEvents.push({
          timestamp: tx.timestamp,
          type: 'fill',
          user: tx.buyer?.toLowerCase()
        });
      }
    });

    if (allEvents.length === 0) return [];

    // Sort by timestamp
    allEvents.sort((a, b) => a.timestamp - b.timestamp);

    // Group by day and calculate cumulative counts
    const dailyData: Record<string, { orders: number; fills: number; uniqueUsers: Set<string> }> = {};

    allEvents.forEach(event => {
      const date = new Date(event.timestamp * 1000);
      const dateStr = date.toISOString().split('T')[0];

      if (!dailyData[dateStr]) {
        dailyData[dateStr] = { orders: 0, fills: 0, uniqueUsers: new Set() };
      }

      if (event.type === 'order') {
        dailyData[dateStr].orders += 1;
      } else {
        dailyData[dateStr].fills += 1;
      }

      // Track unique users inline
      if (event.user) {
        dailyData[dateStr].uniqueUsers.add(event.user);
      }
    });

    // Fill in all days and calculate cumulative totals
    const dates = Object.keys(dailyData).sort();
    if (dates.length === 0) return [];

    const minDate = new Date(dates[0]);
    const maxDate = new Date(dates[dates.length - 1]);
    const result: {
      date: string;
      displayDate: string;
      cumulativeOrders: number;
      cumulativeFills: number;
      dailyOrders: number;
      dailyFills: number;
      dailyUsers: number;
    }[] = [];

    let cumulativeOrders = 0;
    let cumulativeFills = 0;
    const currentDate = new Date(minDate);

    while (currentDate <= maxDate) {
      const dateStr = currentDate.toISOString().split('T')[0];
      const dayData = dailyData[dateStr];

      if (dayData) {
        cumulativeOrders += dayData.orders;
        cumulativeFills += dayData.fills;
      }

      result.push({
        date: dateStr,
        displayDate: currentDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        cumulativeOrders,
        cumulativeFills,
        dailyOrders: dayData?.orders || 0,
        dailyFills: dayData?.fills || 0,
        dailyUsers: dayData?.uniqueUsers?.size || 0
      });

      currentDate.setDate(currentDate.getDate() + 1);
    }

    return result;
  }, [transactions, orders, contractOrders]);

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
        <h3 className="text-2xl font-bold text-white mb-2">Protocol Growth</h3>
        <p className="text-gray-400 text-sm">Cumulative orders and fills over time</p>
      </div>

      <ResponsiveContainer width="100%" height={300}>
        <AreaChart
          data={chartData}
          margin={{ top: 10, right: 30, left: 0, bottom: 0 }}
        >
          <defs>
            <linearGradient id="colorOrders" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#FF0080" stopOpacity={0.3} />
              <stop offset="95%" stopColor="#FF0080" stopOpacity={0} />
            </linearGradient>
            <linearGradient id="colorFills" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#FFFFFF" stopOpacity={0.3} />
              <stop offset="95%" stopColor="#FFFFFF" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#FFFFFF20" />
          <XAxis
            dataKey="displayDate"
            stroke="#FFFFFF"
            tick={{ fill: '#FFFFFF', fontSize: 12 }}
            tickLine={{ stroke: '#FFFFFF' }}
          />
          <YAxis
            stroke="#FFFFFF"
            tick={{ fill: '#FFFFFF', fontSize: 12 }}
            tickLine={{ stroke: '#FFFFFF' }}
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
                  <p style={{ fontWeight: 'bold', marginBottom: '8px' }}>{data.displayDate}</p>
                  <p style={{ margin: '4px 0', fontSize: '14px' }}>
                    <span style={{ color: '#FF0080' }}>Total Orders:</span>{' '}
                    <span style={{ fontWeight: 'bold' }}>{data.cumulativeOrders}</span>
                    <span style={{ color: '#888', marginLeft: '8px' }}>(+{data.dailyOrders})</span>
                  </p>
                  <p style={{ margin: '4px 0', fontSize: '14px' }}>
                    <span style={{ color: '#FFFFFF' }}>Total Fills:</span>{' '}
                    <span style={{ fontWeight: 'bold' }}>{data.cumulativeFills}</span>
                    <span style={{ color: '#888', marginLeft: '8px' }}>(+{data.dailyFills})</span>
                  </p>
                  <p style={{ margin: '4px 0', fontSize: '14px' }}>
                    <span style={{ color: '#888' }}>Active Users Today:</span>{' '}
                    <span style={{ fontWeight: 'bold' }}>{data.dailyUsers}</span>
                  </p>
                </div>
              );
            }}
          />
          <Area
            type="monotone"
            dataKey="cumulativeOrders"
            stroke="#FF0080"
            strokeWidth={2}
            fill="url(#colorOrders)"
            name="Total Orders"
          />
          <Area
            type="monotone"
            dataKey="cumulativeFills"
            stroke="#FFFFFF"
            strokeWidth={2}
            fill="url(#colorFills)"
            name="Total Fills"
          />
        </AreaChart>
      </ResponsiveContainer>

      <div className="flex justify-center gap-6 mt-4">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 bg-[#FF0080] rounded" />
          <span className="text-gray-400 text-sm">Cumulative Orders</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 bg-white rounded" />
          <span className="text-gray-400 text-sm">Cumulative Fills</span>
        </div>
      </div>
    </LiquidGlassCard>
  );
}
