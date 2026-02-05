'use client';

import { useMemo } from 'react';
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

interface HourlyActivityChartProps {
  transactions: Transaction[];
  orders: OrderPlaced[];
  contractOrders?: CompleteOrderDetails[];
}

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const HOURS = Array.from({ length: 24 }, (_, i) => i);

export default function HourlyActivityChart({ transactions, orders, contractOrders = [] }: HourlyActivityChartProps) {
  // Calculate activity heatmap data
  const heatmapData = useMemo(() => {
    // Initialize grid: days x hours
    const grid: number[][] = Array(7).fill(null).map(() => Array(24).fill(0));

    // Count activity per day/hour - use contract orders if available
    const orderTimestamps: number[] = [];
    if (contractOrders.length > 0) {
      contractOrders.forEach(order => {
        const timestamp = Number(order.orderDetailsWithID.lastUpdateTime);
        if (timestamp && timestamp > 0) {
          orderTimestamps.push(timestamp);
        }
      });
    } else {
      orders.forEach(o => {
        if (o.timestamp) orderTimestamps.push(o.timestamp);
      });
    }

    const allTimestamps = [
      ...orderTimestamps,
      ...transactions.filter(tx => tx.timestamp).map(tx => tx.timestamp!)
    ];

    allTimestamps.forEach(timestamp => {
      const date = new Date(timestamp * 1000);
      const day = date.getUTCDay();
      const hour = date.getUTCHours();
      grid[day][hour] += 1;
    });

    return grid;
  }, [transactions, orders, contractOrders]);

  // Find max for color scaling
  const maxActivity = useMemo(() => {
    return Math.max(...heatmapData.flat(), 1);
  }, [heatmapData]);

  // Get color intensity based on value
  const getColor = (value: number) => {
    if (value === 0) return 'bg-white/5';
    const intensity = value / maxActivity;
    if (intensity > 0.8) return 'bg-white';
    if (intensity > 0.6) return 'bg-white/80';
    if (intensity > 0.4) return 'bg-white/60';
    if (intensity > 0.2) return 'bg-white/40';
    return 'bg-white/20';
  };

  // Calculate totals
  const totalActivity = heatmapData.flat().reduce((a, b) => a + b, 0);
  const peakDay = DAYS[heatmapData.map(row => row.reduce((a, b) => a + b, 0)).indexOf(Math.max(...heatmapData.map(row => row.reduce((a, b) => a + b, 0))))];
  const hourlyTotals = HOURS.map(h => heatmapData.reduce((sum, dayRow) => sum + dayRow[h], 0));
  const peakHour = hourlyTotals.indexOf(Math.max(...hourlyTotals));

  if (totalActivity === 0) {
    return null;
  }

  return (
    <LiquidGlassCard
      className="p-6 bg-black/40"
      shadowIntensity="none"
      glowIntensity="none"
    >
      <div className="mb-6">
        <h3 className="text-2xl font-bold text-white mb-2">Activity Heatmap</h3>
        <p className="text-gray-400 text-sm">Trading activity by day and hour (UTC)</p>
      </div>

      {/* Stats row */}
      <div className="flex gap-6 mb-6 text-sm">
        <div>
          <span className="text-gray-400">Peak Day: </span>
          <span className="text-white font-bold">{peakDay}</span>
        </div>
        <div>
          <span className="text-gray-400">Peak Hour: </span>
          <span className="text-white font-bold">{peakHour}:00 UTC</span>
        </div>
        <div>
          <span className="text-gray-400">Total Events: </span>
          <span className="text-white font-bold">{totalActivity}</span>
        </div>
      </div>

      {/* Heatmap grid */}
      <div className="overflow-x-auto">
        <div className="min-w-[600px]">
          {/* Hour labels */}
          <div className="flex mb-1">
            <div className="w-10" /> {/* Spacer for day labels */}
            {HOURS.filter((_, i) => i % 3 === 0).map(hour => (
              <div
                key={hour}
                className="text-gray-500 text-xs"
                style={{ width: `${(100 / 24) * 3}%` }}
              >
                {hour.toString().padStart(2, '0')}
              </div>
            ))}
          </div>

          {/* Grid rows */}
          {DAYS.map((day, dayIndex) => (
            <div key={day} className="flex items-center mb-1">
              <div className="w-10 text-gray-400 text-xs">{day}</div>
              <div className="flex-1 flex gap-[2px]">
                {HOURS.map(hour => {
                  const value = heatmapData[dayIndex][hour];
                  return (
                    <div
                      key={hour}
                      className={`flex-1 h-6 rounded-sm ${getColor(value)} transition-colors cursor-default`}
                      title={`${day} ${hour}:00 UTC - ${value} events`}
                    />
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Legend */}
      <div className="flex justify-center items-center gap-2 mt-6">
        <span className="text-gray-500 text-xs">Less</span>
        <div className="flex gap-1">
          <div className="w-4 h-4 bg-white/5 rounded-sm" />
          <div className="w-4 h-4 bg-white/20 rounded-sm" />
          <div className="w-4 h-4 bg-white/40 rounded-sm" />
          <div className="w-4 h-4 bg-white/60 rounded-sm" />
          <div className="w-4 h-4 bg-white/80 rounded-sm" />
          <div className="w-4 h-4 bg-white rounded-sm" />
        </div>
        <span className="text-gray-500 text-xs">More</span>
      </div>
    </LiquidGlassCard>
  );
}
