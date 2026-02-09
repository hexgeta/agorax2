'use client';

import { useState, useEffect } from 'react';
import { useAccount } from 'wagmi';
import { LiquidGlassCard } from '@/components/ui/liquid-glass';
import { PixelSpinner } from '@/components/ui/PixelSpinner';
import { formatDistanceToNow } from 'date-fns';
import { ExternalLink, ArrowUpRight, ArrowDownRight, X, Gift, Clock, RefreshCw } from 'lucide-react';

interface OrderEvent {
  id: string;
  event_type: string;
  event_data: {
    order_id?: number;
    sell_token?: string;
    buy_token?: string;
    sell_amount?: string;
    buy_amount?: string;
    fill_amount?: string;
    buy_token_used?: string;
    volume_usd?: number;
    is_maker?: boolean;
    filler_wallet?: string;
    tx_hash?: string;
    time_since_creation_seconds?: number;
    fill_percentage?: number;
  };
  xp_awarded: number;
  created_at: string;
}

interface UserResponse {
  success: boolean;
  data?: {
    stats: Record<string, unknown>;
    activity: OrderEvent[];
  };
  error?: string;
}

// Event type display config
const EVENT_CONFIG: Record<string, { label: string; icon: React.ReactNode; color: string; bgColor: string }> = {
  order_created: {
    label: 'Created',
    icon: <ArrowUpRight className="w-4 h-4" />,
    color: 'text-green-400',
    bgColor: 'bg-green-500/20',
  },
  order_filled: {
    label: 'You Filled',
    icon: <ArrowDownRight className="w-4 h-4" />,
    color: 'text-blue-400',
    bgColor: 'bg-blue-500/20',
  },
  order_cancelled: {
    label: 'Cancelled',
    icon: <X className="w-4 h-4" />,
    color: 'text-red-400',
    bgColor: 'bg-red-500/20',
  },
  order_expired: {
    label: 'Expired',
    icon: <Clock className="w-4 h-4" />,
    color: 'text-orange-400',
    bgColor: 'bg-orange-500/20',
  },
  proceeds_claimed: {
    label: 'Claimed',
    icon: <Gift className="w-4 h-4" />,
    color: 'text-purple-400',
    bgColor: 'bg-purple-500/20',
  },
  trade_completed: {
    label: 'Trade',
    icon: <RefreshCw className="w-4 h-4" />,
    color: 'text-cyan-400',
    bgColor: 'bg-cyan-500/20',
  },
};

function formatTxHash(hash: string): string {
  if (!hash) return '';
  return `${hash.slice(0, 6)}...${hash.slice(-4)}`;
}

function formatWallet(address: string): string {
  if (!address) return '';
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

export function OrderHistoryLog() {
  const { address, isConnected } = useAccount();
  const [events, setEvents] = useState<OrderEvent[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchActivity() {
      if (!address || !isConnected) {
        setEvents([]);
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      setError(null);

      try {
        const response = await fetch(`/api/user?wallet=${address}`);
        const data: UserResponse = await response.json();

        if (data.success && data.data) {
          setEvents(data.data.activity || []);
        } else {
          setError(data.error || 'Failed to load activity');
        }
      } catch (err) {
        setError('Failed to fetch activity');
        console.error('Activity fetch error:', err);
      } finally {
        setIsLoading(false);
      }
    }

    fetchActivity();
  }, [address, isConnected]);

  const getEventDescription = (event: OrderEvent): string => {
    const data = event.event_data;

    switch (event.event_type) {
      case 'order_created':
        return `You created order #${data.order_id} to sell ${data.sell_amount || '?'} ${data.sell_token || 'tokens'}`;

      case 'order_filled':
        return `You filled someone's order #${data.order_id} with ${data.fill_amount || '?'} ${data.buy_token_used || 'tokens'}`;

      case 'order_cancelled':
        return `You cancelled your order #${data.order_id}`;

      case 'order_expired':
        return `Your order #${data.order_id} expired${data.fill_percentage ? ` (${data.fill_percentage}% was filled)` : ' (unfilled)'}`;

      case 'proceeds_claimed':
        return `You claimed proceeds from your order #${data.order_id}`;

      case 'trade_completed':
        if (data.is_maker) {
          return `Your order #${data.order_id} was filled by ${formatWallet(data.filler_wallet || '')} → you received ${data.buy_amount || '?'} ${data.buy_token || 'tokens'}`;
        } else {
          return `You filled order #${data.order_id} → you received ${data.sell_amount || '?'} ${data.sell_token || 'tokens'}`;
        }

      default:
        return `Order event #${data.order_id || 'unknown'}`;
    }
  };

  if (!isConnected) {
    return null;
  }

  return (
    <LiquidGlassCard className="mt-8 p-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-semibold text-white">My Activity</h2>
        <span className="text-sm text-white/50">{events.length} events</span>
      </div>

      {isLoading && events.length === 0 ? (
        <div className="flex items-center justify-center py-12">
          <PixelSpinner size={32} />
        </div>
      ) : error ? (
        <div className="text-center py-12 text-red-400">
          {error}
        </div>
      ) : events.length === 0 ? (
        <div className="text-center py-12 text-white/50">
          No order history yet. Create your first order to get started!
        </div>
      ) : (
        <>
          {/* Table Header */}
          <div className="hidden md:grid md:grid-cols-12 gap-4 px-4 py-2 text-xs text-white/50 uppercase tracking-wide border-b border-white/10">
            <div className="col-span-2">Type</div>
            <div className="col-span-5">Description</div>
            <div className="col-span-2 text-right">XP</div>
            <div className="col-span-2 text-right">Time</div>
            <div className="col-span-1 text-right">Tx</div>
          </div>

          {/* Events List */}
          <div className="divide-y divide-white/5">
            {events.map((event) => {
              const config = EVENT_CONFIG[event.event_type] || {
                label: event.event_type,
                icon: <RefreshCw className="w-4 h-4" />,
                color: 'text-white/70',
                bgColor: 'bg-white/10',
              };

              return (
                <div
                  key={event.id}
                  className="grid grid-cols-1 md:grid-cols-12 gap-2 md:gap-4 px-4 py-4 hover:bg-white/5 transition-colors"
                >
                  {/* Event Type */}
                  <div className="md:col-span-2 flex items-center gap-2">
                    <span className={`p-1.5 rounded-lg ${config.bgColor}`}>
                      <span className={config.color}>{config.icon}</span>
                    </span>
                    <span className={`text-sm font-medium ${config.color} hidden md:inline`}>
                      {config.label}
                    </span>
                    <span className={`text-sm font-medium ${config.color} md:hidden`}>
                      {config.label}
                    </span>
                  </div>

                  {/* Description */}
                  <div className="md:col-span-5 text-sm text-white/80">
                    {getEventDescription(event)}
                  </div>

                  {/* XP */}
                  <div className="md:col-span-2 text-right">
                    {event.xp_awarded > 0 ? (
                      <span className="text-sm text-yellow-400">+{event.xp_awarded} XP</span>
                    ) : (
                      <span className="text-sm text-white/30">-</span>
                    )}
                  </div>

                  {/* Time */}
                  <div className="md:col-span-2 text-right text-sm text-white/50">
                    {formatDistanceToNow(new Date(event.created_at), { addSuffix: true })}
                  </div>

                  {/* Tx Link */}
                  <div className="md:col-span-1 text-right">
                    {event.event_data.tx_hash ? (
                      <a
                        href={`https://scan.pulsechain.com/tx/${event.event_data.tx_hash}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300 transition-colors"
                      >
                        <span className="hidden md:inline">{formatTxHash(event.event_data.tx_hash)}</span>
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    ) : (
                      <span className="text-white/20">-</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}
    </LiquidGlassCard>
  );
}
