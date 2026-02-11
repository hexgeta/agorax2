'use client';

import { useState, useEffect, useMemo } from 'react';
import { motion } from 'framer-motion';
import useSWR from 'swr';
import {
  ComposedChart,
  Area,
  Bar,
  XAxis,
  YAxis,
  ResponsiveContainer,
  Tooltip,
  CartesianGrid,
  Legend,
  PieChart,
  Pie,
  Cell,
} from 'recharts';
import { DisclaimerDialog } from '@/components/DisclaimerDialog';
import { PixelSpinner } from '@/components/ui/PixelSpinner';
import { LogoPreloader } from '@/components/LogoPreloader';
import PixelBlastBackground from '@/components/ui/PixelBlastBackground';
import { LiquidGlassCard } from '@/components/ui/liquid-glass';
import { CoinLogo } from '@/components/ui/CoinLogo';
import { formatUSD } from '@/utils/format';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

interface ProtocolStats {
  protocol: {
    total_users: number;
    total_xp_issued: number;
    total_trades: number;
    total_volume_usd: number;
    total_orders_created: number;
    total_orders_filled: number;
    total_orders_cancelled: number;
    total_fill_volume_usd: number;
    fill_rate_percent: number;
  };
  orders: {
    total: number;
    by_status: {
      active: number;
      cancelled: number;
      completed: number;
    };
  };
  fills: {
    total: number;
  };
  achievements: {
    total_challenges_completed: number;
    total_xp_from_challenges: number;
  };
  events: {
    total_recorded: number;
  };
}

interface LeaderboardUser {
  rank: number;
  wallet_address: string;
  total_xp: number;
  prestige_level: number;
  prestige_name: string;
  total_orders_created: number;
  total_orders_filled: number;
  total_orders_cancelled: number;
  total_trades: number;
  total_volume_usd: number;
  unique_tokens_traded: number;
  current_active_orders: number;
  longest_streak_days: number;
  current_streak_days: number;
  last_trade_date: string | null;
  total_proceeds_claimed: number;
  fill_rate_percent: number;
  member_since: string;
}

interface Order {
  order_id: number;
  maker_address: string;
  sell_token_ticker: string;
  sell_token_address: string;
  sell_amount_formatted: number;
  buy_tokens_tickers: string[];
  buy_tokens_addresses: string[];
  buy_amounts_formatted: number[];
  status: number;
  status_label: string;
  fill_percentage: number;
  remaining_sell_amount: string;
  redeemed_sell_amount: string;
  is_all_or_nothing: boolean;
  expiration: number;
  total_fills: number;
  unique_fillers: number;
  created_at: string;
  updated_at: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Fetcher
// ─────────────────────────────────────────────────────────────────────────────

const fetcher = async (url: string) => {
  const res = await fetch(url);
  if (!res.ok) throw new Error('Failed to fetch');
  const json = await res.json();
  return json.data;
};

// ─────────────────────────────────────────────────────────────────────────────
// Helper Components
// ─────────────────────────────────────────────────────────────────────────────

interface StatCardProps {
  label: string;
  value: string;
  subValue?: string;
  dotColor?: 'green' | 'yellow' | 'red' | 'blue';
}

function StatCard({ label, value, subValue, dotColor }: StatCardProps) {
  const dotColorClasses: Record<string, string> = {
    green: 'bg-green-500',
    yellow: 'bg-yellow-500',
    red: 'bg-red-500',
    blue: 'bg-blue-500',
  };
  const dotColorClass = dotColor ? dotColorClasses[dotColor] : '';

  return (
    <LiquidGlassCard
      className="p-5 bg-black/40 flex flex-col justify-between min-h-[120px]"
      shadowIntensity="none"
      glowIntensity="none"
    >
      <div className="flex items-center gap-2">
        {dotColor && <div className={`w-2.5 h-2.5 rounded-full ${dotColorClass}`} />}
        <p className="text-gray-400 text-sm font-medium">{label}</p>
      </div>
      <div>
        <p className="text-white text-2xl md:text-3xl font-bold">{value}</p>
        {subValue && (
          <p className="text-gray-500 text-xs mt-1">{subValue}</p>
        )}
      </div>
    </LiquidGlassCard>
  );
}

function formatAddress(address: string): string {
  if (address.length > 10) return `${address.slice(0, 6)}...${address.slice(-4)}`;
  return address;
}

function formatDisplayAmount(amount: number): string {
  if (isNaN(amount)) return '0';
  if (amount >= 1000000000) return `${(amount / 1000000000).toFixed(2)}B`;
  if (amount >= 1000000) return `${(amount / 1000000).toFixed(2)}M`;
  if (amount >= 1000) return `${(amount / 1000).toFixed(1)}K`;
  return amount.toLocaleString(undefined, { maximumFractionDigits: 2 });
}

function getStatusColor(status: string) {
  switch (status) {
    case 'active': return 'text-green-400 bg-green-500/20';
    case 'completed': return 'text-blue-400 bg-blue-500/20';
    case 'cancelled': return 'text-red-400 bg-red-500/20';
    default: return 'text-gray-400 bg-gray-500/20';
  }
}

const PRESTIGE_COLORS: Record<string, string> = {
  Alpha: 'text-rose-400',
  Beta: 'text-orange-400',
  Gamma: 'text-lime-400',
  Delta: 'text-emerald-400',
  Epsilon: 'text-cyan-400',
  Zeta: 'text-blue-400',
  Eta: 'text-violet-400',
  Theta: 'text-fuchsia-400',
  Omega: 'text-yellow-400',
};

// ─────────────────────────────────────────────────────────────────────────────
// Main Component
// ─────────────────────────────────────────────────────────────────────────────

export default function Stats2Page() {
  const [showDisclaimer, setShowDisclaimer] = useState(false);
  const [orderStatusFilter, setOrderStatusFilter] = useState<'all' | 'active' | 'completed' | 'cancelled'>('all');
  const [leaderboardSort, setLeaderboardSort] = useState<'total_xp' | 'total_volume_usd' | 'total_trades'>('total_xp');

  // Fetch protocol stats
  const { data: stats, isLoading: statsLoading } = useSWR<ProtocolStats>(
    '/api/v1/stats',
    fetcher,
    { refreshInterval: 30000 }
  );

  // Fetch leaderboard
  const { data: leaderboardData, isLoading: leaderboardLoading } = useSWR<{
    leaderboard: LeaderboardUser[];
    pagination: { total: number; limit: number; offset: number; has_more: boolean };
  }>(
    `/api/v1/leaderboard?sort=${leaderboardSort}&limit=50`,
    fetcher,
    { refreshInterval: 60000 }
  );

  // Fetch orders
  const orderStatusParam = orderStatusFilter === 'all' ? '' : `&status=${orderStatusFilter}`;
  const { data: ordersData, isLoading: ordersLoading } = useSWR<{
    orders: Order[];
    pagination: { total: number; limit: number; offset: number; has_more: boolean };
  }>(
    `/api/v1/orders?limit=100${orderStatusParam}`,
    fetcher,
    { refreshInterval: 30000 }
  );

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const accepted = localStorage.getItem('disclaimer-accepted');
      setShowDisclaimer(accepted !== 'true');
    }
  }, []);

  const isLoading = statsLoading;
  const hasData = stats !== undefined;

  // Calculate derived stats
  const avgOrderSize = useMemo(() => {
    if (!stats || stats.protocol.total_orders_created === 0) return 0;
    return stats.protocol.total_volume_usd / stats.protocol.total_orders_created;
  }, [stats]);

  const avgTradeSize = useMemo(() => {
    if (!stats || stats.protocol.total_trades === 0) return 0;
    return stats.protocol.total_volume_usd / stats.protocol.total_trades;
  }, [stats]);

  const cancelRate = useMemo(() => {
    if (!stats || stats.protocol.total_orders_created === 0) return 0;
    return (stats.protocol.total_orders_cancelled / stats.protocol.total_orders_created) * 100;
  }, [stats]);

  // Compute daily activity chart data from orders
  const activityChartData = useMemo(() => {
    if (!ordersData?.orders) return [];

    const dailyData: Record<string, { orders: number; fills: number }> = {};

    ordersData.orders.forEach((order) => {
      if (!order.created_at) return;
      const dateStr = order.created_at.split('T')[0];
      if (!dailyData[dateStr]) {
        dailyData[dateStr] = { orders: 0, fills: 0 };
      }
      dailyData[dateStr].orders += 1;
      dailyData[dateStr].fills += order.total_fills;
    });

    const dates = Object.keys(dailyData).sort();
    if (dates.length === 0) return [];

    let cumulativeOrders = 0;
    let cumulativeFills = 0;

    return dates.map((dateStr) => {
      const dayData = dailyData[dateStr];
      cumulativeOrders += dayData.orders;
      cumulativeFills += dayData.fills;
      const displayDate = new Date(dateStr).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
      return {
        date: dateStr,
        displayDate,
        dailyOrders: dayData.orders,
        dailyFills: dayData.fills,
        cumulativeOrders,
        cumulativeFills,
      };
    });
  }, [ordersData]);

  // Compute top tokens from orders
  const topTokensData = useMemo(() => {
    if (!ordersData?.orders) return [];

    const tokenStats: Record<string, { ticker: string; orderCount: number; fillCount: number }> = {};

    ordersData.orders.forEach((order) => {
      const ticker = order.sell_token_ticker;
      if (!tokenStats[ticker]) {
        tokenStats[ticker] = { ticker, orderCount: 0, fillCount: 0 };
      }
      tokenStats[ticker].orderCount += 1;
      tokenStats[ticker].fillCount += order.total_fills;
    });

    return Object.values(tokenStats)
      .sort((a, b) => b.orderCount - a.orderCount)
      .slice(0, 10);
  }, [ordersData]);

  // Order status breakdown for pie chart
  const orderStatusData = useMemo(() => {
    if (!stats) return [];
    return [
      { name: 'Active', value: stats.orders.by_status.active, color: '#4ADE80' },
      { name: 'Completed', value: stats.orders.by_status.completed, color: '#60A5FA' },
      { name: 'Cancelled', value: stats.orders.by_status.cancelled, color: '#F87171' },
    ].filter((d) => d.value > 0);
  }, [stats]);

  return (
    <>
      <DisclaimerDialog open={showDisclaimer} onAccept={() => setShowDisclaimer(false)} />
      <LogoPreloader />
      <main className="flex min-h-screen flex-col items-center relative">
        {/* Animated background effect */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: !isLoading ? 1 : 0 }}
          transition={{ duration: 1.2, delay: 0.3, ease: [0.23, 1, 0.32, 1] }}
          className="fixed inset-0 z-0"
        >
          <PixelBlastBackground />
        </motion.div>

        {/* Main Content */}
        <div className="w-full px-2 md:px-8 mt-2 pb-12 relative z-10">
          <div className="max-w-[1200px] mx-auto">
            {isLoading ? (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="flex flex-col items-center justify-center py-20"
              >
                <PixelSpinner size={48} className="mb-6" />
                <p className="text-white text-lg mb-2">Loading Protocol Data</p>
                <p className="text-gray-400 text-sm">Fetching from API...</p>
              </motion.div>
            ) : !hasData ? (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="text-center py-20"
              >
                <p className="text-gray-400 text-lg">No data available</p>
                <p className="text-gray-500 text-sm mt-2">Stats will appear once data is recorded</p>
              </motion.div>
            ) : (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.5, delay: 0.2 }}
                className="space-y-6"
              >
                {/* Page Header */}
                <div className="flex items-center justify-between mb-2">
                  <h1 className="text-2xl md:text-3xl font-bold text-white">Protocol Stats (API)</h1>
                  <span className="text-xs text-gray-500 bg-white/5 px-3 py-1 rounded-full">
                    Auto-refreshes every 30s
                  </span>
                </div>

                {/* Stats Cards - Row 1: Volume & Overview */}
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
                  <StatCard
                    label="Total Listed Volume"
                    value={formatUSD(stats.protocol.total_volume_usd)}
                    subValue="All orders all time"
                  />
                  <StatCard
                    label="Total Filled Volume"
                    value={formatUSD(stats.protocol.total_fill_volume_usd)}
                    subValue={`${stats.fills.total.toLocaleString()} fills`}
                  />
                  <StatCard
                    label="Unique Traders"
                    value={stats.protocol.total_users.toLocaleString()}
                    subValue="Buyers & sellers"
                  />
                </div>

                {/* Stats Cards - Row 2: Averages & Rates */}
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
                  <StatCard
                    label="Avg Placement Size"
                    value={formatUSD(avgOrderSize)}
                    subValue="Per order created"
                  />
                  <StatCard
                    label="Avg Fill Size"
                    value={formatUSD(avgTradeSize)}
                    subValue="Per fill"
                  />
                  <StatCard
                    label="Cancel Rate"
                    value={`${cancelRate.toFixed(1)}%`}
                    subValue="Orders cancelled"
                    dotColor={cancelRate > 50 ? 'red' : cancelRate > 25 ? 'yellow' : 'green'}
                  />
                </div>

                {/* Stats Cards - Row 3: Order Status */}
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
                  <StatCard
                    label="Total Orders"
                    value={stats.orders.total.toLocaleString()}
                    subValue="All time"
                  />
                  <StatCard
                    label="Active Orders"
                    value={stats.orders.by_status.active.toLocaleString()}
                    subValue="Currently open"
                    dotColor="green"
                  />
                  <StatCard
                    label="Completed Orders"
                    value={stats.orders.by_status.completed.toLocaleString()}
                    subValue="Fully filled"
                    dotColor="blue"
                  />
                  <StatCard
                    label="Cancelled Orders"
                    value={stats.orders.by_status.cancelled.toLocaleString()}
                    subValue="By owner"
                    dotColor="red"
                  />
                </div>

                {/* Stats Cards - Row 4: Per-User Averages */}
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
                  <StatCard
                    label="Avg Orders/Trader"
                    value={stats.protocol.total_users > 0 ? (stats.orders.total / stats.protocol.total_users).toFixed(1) : '0'}
                    subValue="Orders per address"
                  />
                  <StatCard
                    label="Avg Volume/Trader"
                    value={formatUSD(stats.protocol.total_users > 0 ? stats.protocol.total_volume_usd / stats.protocol.total_users : 0)}
                    subValue="Listed per address"
                  />
                  <StatCard
                    label="Avg Fills/Trader"
                    value={stats.protocol.total_users > 0 ? (stats.fills.total / stats.protocol.total_users).toFixed(1) : '0'}
                    subValue="Fills per address"
                  />
                  <StatCard
                    label="Maker/Taker Ratio"
                    value={stats.fills.total > 0 && stats.orders.total > 0
                      ? `${(stats.orders.total / stats.fills.total).toFixed(1)}x`
                      : '-'}
                    subValue="Orders to fills"
                  />
                  <StatCard
                    label="Fill Rate"
                    value={`${stats.protocol.fill_rate_percent.toFixed(1)}%`}
                    subValue="Orders filled"
                  />
                </div>

                {/* Protocol Activity Chart */}
                {activityChartData.length > 0 && (
                  <LiquidGlassCard
                    className="p-6 bg-black/40"
                    shadowIntensity="none"
                    glowIntensity="none"
                  >
                    <div className="mb-6">
                      <h3 className="text-2xl font-bold text-white mb-2">Protocol Activity</h3>
                      <div className="flex flex-wrap gap-6">
                        <div>
                          <p className="text-gray-400 text-sm">Total Orders</p>
                          <p className="text-pink-400 text-xl font-bold">{stats.orders.total.toLocaleString()}</p>
                        </div>
                        <div>
                          <p className="text-gray-400 text-sm">Total Fills</p>
                          <p className="text-green-400 text-xl font-bold">{stats.fills.total.toLocaleString()}</p>
                        </div>
                      </div>
                    </div>

                    <ResponsiveContainer width="100%" height={300}>
                      <ComposedChart
                        data={activityChartData}
                        margin={{ top: 10, right: 30, left: 0, bottom: 0 }}
                        barGap={0}
                        barCategoryGap="20%"
                      >
                        <defs>
                          <linearGradient id="colorCumulativeOrders" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#EC4899" stopOpacity={0.3} />
                            <stop offset="95%" stopColor="#EC4899" stopOpacity={0.05} />
                          </linearGradient>
                          <linearGradient id="colorCumulativeFills" x1="0" y1="0" x2="0" y2="1">
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
                        />
                        <YAxis
                          yAxisId="right"
                          orientation="right"
                          stroke="#FFFFFF20"
                          tick={{ fill: '#6B7280', fontSize: 12 }}
                          tickLine={{ stroke: '#FFFFFF20' }}
                          axisLine={{ stroke: '#FFFFFF20' }}
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
                                  <span style={{ color: '#EC4899' }}>Orders:</span>{' '}
                                  <span style={{ fontWeight: 'bold' }}>{data.dailyOrders}</span>
                                </p>
                                <p style={{ margin: '4px 0', fontSize: '14px' }}>
                                  <span style={{ color: '#4ADE80' }}>Fills:</span>{' '}
                                  <span style={{ fontWeight: 'bold' }}>{data.dailyFills}</span>
                                </p>
                                <hr style={{ margin: '8px 0', borderColor: 'rgba(255, 255, 255, 0.1)' }} />
                                <p style={{ margin: '4px 0', fontSize: '14px' }}>
                                  <span style={{ color: '#EC489980' }}>Cumulative Orders:</span>{' '}
                                  <span style={{ fontWeight: 'bold' }}>{data.cumulativeOrders}</span>
                                </p>
                                <p style={{ margin: '4px 0', fontSize: '14px' }}>
                                  <span style={{ color: '#4ADE8080' }}>Cumulative Fills:</span>{' '}
                                  <span style={{ fontWeight: 'bold' }}>{data.cumulativeFills}</span>
                                </p>
                              </div>
                            );
                          }}
                        />
                        <Legend wrapperStyle={{ color: '#FFFFFF' }} iconType="circle" />
                        <Area
                          yAxisId="right"
                          type="monotone"
                          dataKey="cumulativeFills"
                          stroke="#4ADE80"
                          strokeWidth={2}
                          strokeOpacity={0.6}
                          fill="url(#colorCumulativeFills)"
                          name="Cumulative Fills"
                        />
                        <Area
                          yAxisId="right"
                          type="monotone"
                          dataKey="cumulativeOrders"
                          stroke="#EC4899"
                          strokeWidth={2}
                          strokeOpacity={0.6}
                          fill="url(#colorCumulativeOrders)"
                          name="Cumulative Orders"
                        />
                        <Bar
                          yAxisId="left"
                          dataKey="dailyFills"
                          fill="#4ADE80"
                          radius={[4, 4, 0, 0]}
                          legendType="none"
                        />
                        <Bar
                          yAxisId="left"
                          dataKey="dailyOrders"
                          fill="#EC4899"
                          radius={[4, 4, 0, 0]}
                          legendType="none"
                        />
                      </ComposedChart>
                    </ResponsiveContainer>
                  </LiquidGlassCard>
                )}

                {/* Top Tokens & Order Status Charts */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* Top Tokens */}
                  {topTokensData.length > 0 && (
                    <LiquidGlassCard
                      className="p-6 bg-black/40"
                      shadowIntensity="none"
                      glowIntensity="none"
                    >
                      <h3 className="text-2xl font-bold text-white mb-6">Top Tokens</h3>
                      <div className="space-y-3">
                        {topTokensData.map((token, index) => {
                          const maxOrders = topTokensData[0]?.orderCount || 1;
                          const barWidth = (token.orderCount / maxOrders) * 100;
                          return (
                            <div key={token.ticker} className="relative">
                              <div
                                className="absolute inset-0 rounded bg-white/5"
                                style={{ width: `${barWidth}%` }}
                              />
                              <div className="relative flex items-center justify-between py-2.5 px-3">
                                <div className="flex items-center gap-3">
                                  <span className={`text-sm font-bold w-5 ${index < 3 ? 'text-white' : 'text-gray-500'}`}>
                                    {index + 1}
                                  </span>
                                  <CoinLogo symbol={token.ticker} size="sm" />
                                  <span className="text-white font-medium">{token.ticker}</span>
                                </div>
                                <div className="flex items-center gap-4 text-sm">
                                  <span className="text-pink-400">{token.orderCount} orders</span>
                                  <span className="text-green-400">{token.fillCount} fills</span>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </LiquidGlassCard>
                  )}

                  {/* Order Status Breakdown */}
                  {orderStatusData.length > 0 && (
                    <LiquidGlassCard
                      className="p-6 bg-black/40"
                      shadowIntensity="none"
                      glowIntensity="none"
                    >
                      <h3 className="text-2xl font-bold text-white mb-6">Order Status Breakdown</h3>
                      <div className="flex items-center justify-center">
                        <ResponsiveContainer width="100%" height={250}>
                          <PieChart>
                            <Pie
                              data={orderStatusData}
                              cx="50%"
                              cy="50%"
                              innerRadius={60}
                              outerRadius={100}
                              paddingAngle={2}
                              dataKey="value"
                              label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                              labelLine={{ stroke: '#FFFFFF40' }}
                            >
                              {orderStatusData.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={entry.color} />
                              ))}
                            </Pie>
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
                                    <p style={{ fontWeight: 'bold', color: data.color }}>{data.name}</p>
                                    <p style={{ fontSize: '14px' }}>{data.value.toLocaleString()} orders</p>
                                  </div>
                                );
                              }}
                            />
                          </PieChart>
                        </ResponsiveContainer>
                      </div>
                      <div className="flex justify-center gap-6 mt-4">
                        {orderStatusData.map((entry) => (
                          <div key={entry.name} className="flex items-center gap-2">
                            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: entry.color }} />
                            <span className="text-gray-400 text-sm">{entry.name}: {entry.value.toLocaleString()}</span>
                          </div>
                        ))}
                      </div>
                    </LiquidGlassCard>
                  )}
                </div>

                {/* Leaderboard */}
                <div>
                  <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
                    <h2 className="text-2xl font-bold text-white">Leaderboard</h2>
                    <div className="flex gap-2">
                      {(['total_xp', 'total_volume_usd', 'total_trades'] as const).map((sort) => (
                        <button
                          key={sort}
                          onClick={() => setLeaderboardSort(sort)}
                          className={`px-4 py-2 rounded-lg font-medium transition-all text-sm ${
                            leaderboardSort === sort
                              ? 'bg-white/10 text-white border border-white/20'
                              : 'bg-white/5 text-gray-400 border border-transparent hover:bg-white/10 hover:text-white'
                          }`}
                        >
                          {sort === 'total_xp' ? 'XP' : sort === 'total_volume_usd' ? 'Volume' : 'Trades'}
                        </button>
                      ))}
                    </div>
                  </div>

                  <LiquidGlassCard
                    shadowIntensity="sm"
                    glowIntensity="sm"
                    blurIntensity="xl"
                    className="p-4 md:p-6 !overflow-x-auto"
                  >
                    {leaderboardLoading ? (
                      <div className="flex items-center justify-center py-12">
                        <PixelSpinner size={32} />
                        <span className="ml-3 text-gray-400">Loading leaderboard...</span>
                      </div>
                    ) : (
                      <div className="overflow-x-auto -mx-4 md:-mx-6 px-4 md:px-6 pb-2 modern-scrollbar">
                        <table className="w-full min-w-[800px]">
                          <thead>
                            <tr className="border-b border-white/10">
                              <th className="text-left py-3 px-2 text-gray-400 font-medium text-sm">Rank</th>
                              <th className="text-left py-3 px-2 text-gray-400 font-medium text-sm">Wallet</th>
                              <th className="text-left py-3 px-2 text-gray-400 font-medium text-sm">Legion</th>
                              <th className="text-right py-3 px-2 text-gray-400 font-medium text-sm">XP</th>
                              <th className="text-right py-3 px-2 text-gray-400 font-medium text-sm">Volume</th>
                              <th className="text-right py-3 px-2 text-gray-400 font-medium text-sm">Trades</th>
                              <th className="text-right py-3 px-2 text-gray-400 font-medium text-sm">Orders</th>
                              <th className="text-right py-3 px-2 text-gray-400 font-medium text-sm">Tokens</th>
                              <th className="text-right py-3 px-2 text-gray-400 font-medium text-sm">Streak</th>
                            </tr>
                          </thead>
                          <tbody>
                            {(leaderboardData?.leaderboard || []).length === 0 ? (
                              <tr>
                                <td colSpan={9} className="py-8 text-center text-gray-500">
                                  No users on leaderboard yet.
                                </td>
                              </tr>
                            ) : (
                              (leaderboardData?.leaderboard || []).map((user) => (
                                <tr
                                  key={user.wallet_address}
                                  className="border-b border-white/5 hover:bg-white/5 transition-colors"
                                >
                                  <td className="py-4 px-2">
                                    <span className={`font-bold ${
                                      user.rank === 1 ? 'text-yellow-400' :
                                      user.rank === 2 ? 'text-gray-300' :
                                      user.rank === 3 ? 'text-orange-400' :
                                      'text-gray-500'
                                    }`}>
                                      #{user.rank}
                                    </span>
                                  </td>
                                  <td className="py-4 px-2">
                                    <span className="font-mono text-sm text-gray-300">
                                      {formatAddress(user.wallet_address)}
                                    </span>
                                  </td>
                                  <td className="py-4 px-2">
                                    <span className={`font-semibold ${PRESTIGE_COLORS[user.prestige_name] || 'text-gray-400'}`}>
                                      {user.prestige_name}
                                    </span>
                                  </td>
                                  <td className="py-4 px-2 text-right">
                                    <span className="text-white font-medium">
                                      {user.total_xp.toLocaleString()}
                                    </span>
                                  </td>
                                  <td className="py-4 px-2 text-right">
                                    <span className="text-gray-300">
                                      {formatUSD(user.total_volume_usd)}
                                    </span>
                                  </td>
                                  <td className="py-4 px-2 text-right">
                                    <span className="text-gray-300">
                                      {user.total_trades.toLocaleString()}
                                    </span>
                                  </td>
                                  <td className="py-4 px-2 text-right">
                                    <span className="text-gray-400">
                                      {user.total_orders_created}
                                    </span>
                                  </td>
                                  <td className="py-4 px-2 text-right">
                                    <span className="text-gray-400">
                                      {user.unique_tokens_traded}
                                    </span>
                                  </td>
                                  <td className="py-4 px-2 text-right">
                                    <span className={`${user.current_streak_days > 0 ? 'text-green-400' : 'text-gray-500'}`}>
                                      {user.current_streak_days}d
                                    </span>
                                  </td>
                                </tr>
                              ))
                            )}
                          </tbody>
                        </table>
                        {leaderboardData?.pagination && (
                          <div className="mt-4 text-center text-gray-500 text-sm">
                            Showing {leaderboardData.leaderboard.length} of {leaderboardData.pagination.total} traders
                          </div>
                        )}
                      </div>
                    )}
                  </LiquidGlassCard>
                </div>

                {/* All Orders Table */}
                <div>
                  <h2 className="text-2xl font-bold text-white mb-4">Recent Orders</h2>

                  {/* Order Status Filters */}
                  <div className="flex flex-wrap gap-2 mb-4">
                    {(['all', 'active', 'completed', 'cancelled'] as const).map((filter) => (
                      <button
                        key={filter}
                        onClick={() => setOrderStatusFilter(filter)}
                        className={`px-4 py-2 rounded-lg font-medium transition-all capitalize ${
                          orderStatusFilter === filter
                            ? 'bg-white/10 text-white border border-white/20'
                            : 'bg-white/5 text-gray-400 border border-transparent hover:bg-white/10 hover:text-white'
                        }`}
                      >
                        {filter}
                      </button>
                    ))}
                  </div>

                  <LiquidGlassCard
                    shadowIntensity="sm"
                    glowIntensity="sm"
                    blurIntensity="xl"
                    className="p-4 md:p-6 !overflow-x-auto"
                  >
                    {ordersLoading ? (
                      <div className="flex items-center justify-center py-12">
                        <PixelSpinner size={32} />
                        <span className="ml-3 text-gray-400">Loading orders...</span>
                      </div>
                    ) : (
                      <div className="overflow-x-auto -mx-4 md:-mx-6 px-4 md:px-6 pb-2 modern-scrollbar">
                        <table className="w-full min-w-[700px]">
                          <thead>
                            <tr className="border-b border-white/10">
                              <th className="text-left py-3 px-2 text-gray-400 font-medium text-sm whitespace-nowrap">ID</th>
                              <th className="text-left py-3 px-2 text-gray-400 font-medium text-sm whitespace-nowrap">Maker</th>
                              <th className="text-left py-3 px-2 text-gray-400 font-medium text-sm whitespace-nowrap">Pair</th>
                              <th className="text-right py-3 px-2 text-gray-400 font-medium text-sm whitespace-nowrap">Sell Amount</th>
                              <th className="text-right py-3 px-2 text-gray-400 font-medium text-sm whitespace-nowrap">Buy Amount</th>
                              <th className="text-center py-3 px-2 text-gray-400 font-medium text-sm whitespace-nowrap">Filled</th>
                              <th className="text-center py-3 px-2 text-gray-400 font-medium text-sm whitespace-nowrap">Status</th>
                              <th className="text-center py-3 px-2 text-gray-400 font-medium text-sm whitespace-nowrap">Fills</th>
                            </tr>
                          </thead>
                          <tbody>
                            {(ordersData?.orders || []).length === 0 ? (
                              <tr>
                                <td colSpan={8} className="py-8 text-center text-gray-500">
                                  No orders found with this filter.
                                </td>
                              </tr>
                            ) : (
                              (ordersData?.orders || []).map((order) => {
                                const statusColors = getStatusColor(order.status_label);
                                const buyTokenDisplay = order.buy_tokens_tickers.length > 0
                                  ? order.buy_tokens_tickers[0]
                                  : 'UNKNOWN';
                                const buyAmountDisplay = order.buy_amounts_formatted.length > 0
                                  ? order.buy_amounts_formatted[0]
                                  : 0;

                                return (
                                  <tr
                                    key={order.order_id}
                                    className="border-b border-white/5 hover:bg-white/5 transition-colors"
                                  >
                                    <td className="py-4 px-2">
                                      <span className="text-gray-500 text-sm">#{order.order_id}</span>
                                    </td>
                                    <td className="py-4 px-2">
                                      <span className="font-mono text-sm text-gray-300">
                                        {formatAddress(order.maker_address)}
                                      </span>
                                    </td>
                                    <td className="py-4 px-2">
                                      <span className="text-white text-sm">
                                        {order.sell_token_ticker}/{buyTokenDisplay}
                                      </span>
                                    </td>
                                    <td className="py-4 px-2 text-right">
                                      <span className="text-gray-300 text-sm whitespace-nowrap">
                                        {formatDisplayAmount(order.sell_amount_formatted)} {order.sell_token_ticker}
                                      </span>
                                    </td>
                                    <td className="py-4 px-2 text-right">
                                      <span className="text-gray-300 text-sm whitespace-nowrap">
                                        {formatDisplayAmount(buyAmountDisplay)} {buyTokenDisplay}
                                      </span>
                                    </td>
                                    <td className="py-4 px-2 text-center">
                                      <span className="text-gray-400 text-sm">{order.fill_percentage}%</span>
                                    </td>
                                    <td className="py-4 px-2 text-center">
                                      <span className={`text-xs px-2 py-1 rounded capitalize ${statusColors}`}>
                                        {order.status_label}
                                      </span>
                                    </td>
                                    <td className="py-4 px-2 text-center">
                                      <span className="text-gray-400 text-sm">{order.total_fills}</span>
                                    </td>
                                  </tr>
                                );
                              })
                            )}
                          </tbody>
                        </table>
                        {ordersData?.pagination && (
                          <div className="mt-4 text-center text-gray-500 text-sm">
                            Showing {ordersData.orders.length} of {ordersData.pagination.total} orders
                          </div>
                        )}
                      </div>
                    )}
                  </LiquidGlassCard>
                </div>

                {/* Footer note */}
                <div className="text-center text-gray-500 text-sm pt-4">
                  <p>Data sourced from AgoráX API. Auto-refreshes periodically.</p>
                </div>
              </motion.div>
            )}
          </div>
        </div>
      </main>
    </>
  );
}
