'use client';

import { useState, useEffect, useMemo } from 'react';
import { useAccount } from 'wagmi';
import { LiquidGlassCard } from '@/components/ui/liquid-glass';
import { PixelSpinner } from '@/components/ui/PixelSpinner';
import { formatDistanceToNow } from 'date-fns';
import { ArrowUpRight, ArrowDownRight, X, Gift, Clock, RefreshCw, Search, ChevronUp, ChevronDown } from 'lucide-react';

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

// Available event types for filtering
const EVENT_TYPE_OPTIONS = [
  { value: 'all', label: 'All Types' },
  { value: 'order_created', label: 'Created' },
  { value: 'order_filled', label: 'You Filled' },
  { value: 'trade_completed', label: 'Trade' },
  { value: 'order_cancelled', label: 'Cancelled' },
  { value: 'proceeds_claimed', label: 'Claimed' },
  { value: 'order_expired', label: 'Expired' },
];

type SortField = 'type' | 'description' | 'xp' | 'time';
type SortDirection = 'asc' | 'desc';

function formatWallet(address: string): string {
  if (!address) return '';
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

export function OrderHistoryLog() {
  const { address, isConnected } = useAccount();
  const [events, setEvents] = useState<OrderEvent[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filter & sort state
  const [showFilters, setShowFilters] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [sortField, setSortField] = useState<SortField>('time');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');

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
        const orderIdStr = data.order_id ? `#${data.order_id}` : 'a new order';
        return `You created ${orderIdStr} to sell ${data.sell_amount || '?'} ${data.sell_token || 'tokens'}`;

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
          // User is the order maker - they received the buy token
          const receivedAmount = data.buy_amount && data.buy_amount !== '0' ? data.buy_amount : null;
          const fillerInfo = data.filler_wallet ? ` by ${formatWallet(data.filler_wallet)}` : '';
          return receivedAmount
            ? `Your order #${data.order_id} was filled${fillerInfo} → you received ${receivedAmount} ${data.buy_token || 'tokens'}`
            : `Your order #${data.order_id} was filled${fillerInfo}`;
        } else {
          // User filled someone else's order - they received the sell token
          const receivedAmount = data.sell_amount && data.sell_amount !== '0' ? data.sell_amount : null;
          return receivedAmount
            ? `You filled order #${data.order_id} → you received ${receivedAmount} ${data.sell_token || 'tokens'}`
            : `You filled order #${data.order_id}`;
        }

      default:
        return `Order event #${data.order_id || 'unknown'}`;
    }
  };

  // Filter and sort events
  const filteredAndSortedEvents = useMemo(() => {
    let result = [...events];

    // Apply type filter
    if (typeFilter !== 'all') {
      result = result.filter(e => e.event_type === typeFilter);
    }

    // Apply search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      result = result.filter(e => {
        const description = getEventDescription(e).toLowerCase();
        const orderId = e.event_data.order_id?.toString() || '';
        const sellToken = e.event_data.sell_token?.toLowerCase() || '';
        const buyToken = e.event_data.buy_token?.toLowerCase() || '';
        const buyTokenUsed = e.event_data.buy_token_used?.toLowerCase() || '';
        const txHash = e.event_data.tx_hash?.toLowerCase() || '';
        const typeLabel = EVENT_CONFIG[e.event_type]?.label.toLowerCase() || e.event_type;

        return description.includes(query) ||
          orderId.includes(query) ||
          sellToken.includes(query) ||
          buyToken.includes(query) ||
          buyTokenUsed.includes(query) ||
          txHash.includes(query) ||
          typeLabel.includes(query);
      });
    }

    // Apply sorting
    result.sort((a, b) => {
      let comparison = 0;

      switch (sortField) {
        case 'type':
          const labelA = EVENT_CONFIG[a.event_type]?.label || a.event_type;
          const labelB = EVENT_CONFIG[b.event_type]?.label || b.event_type;
          comparison = labelA.localeCompare(labelB);
          break;
        case 'description':
          comparison = getEventDescription(a).localeCompare(getEventDescription(b));
          break;
        case 'xp':
          comparison = a.xp_awarded - b.xp_awarded;
          break;
        case 'time':
          comparison = new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
          break;
      }

      return sortDirection === 'asc' ? comparison : -comparison;
    });

    return result;
  }, [events, typeFilter, searchQuery, sortField, sortDirection]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection(field === 'time' ? 'desc' : 'asc');
    }
  };

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) {
      return <ChevronDown className="w-3 h-3 text-white/30" />;
    }
    return sortDirection === 'asc'
      ? <ChevronUp className="w-3 h-3 text-white" />
      : <ChevronDown className="w-3 h-3 text-white" />;
  };

  // Count active filters
  const activeFilterCount = (typeFilter !== 'all' ? 1 : 0) + (searchQuery.trim() ? 1 : 0);

  if (!isConnected) {
    return null;
  }

  return (
    <div className="mt-8 mb-12">
      <LiquidGlassCard className="p-6">
        {/* Header inside the card */}
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-2xl md:text-3xl font-bold text-white">My Activity</h2>

          <div className="flex items-center gap-3">
            {/* Filters Toggle Button */}
            <button
              type="button"
              onClick={() => setShowFilters(!showFilters)}
              className="flex items-center gap-1.5 text-white/50 hover:text-white/80 transition-colors text-sm whitespace-nowrap py-2"
            >
              <span>Filters</span>
              {activeFilterCount > 0 && !showFilters && (
                <span className="flex items-center justify-center w-5 h-5 text-xs font-medium bg-white/20 text-white rounded-full">
                  {activeFilterCount}
                </span>
              )}
              <svg
                className={`w-3 h-3 transition-transform duration-200 ${showFilters ? 'rotate-180' : ''}`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
              </svg>
            </button>
            {activeFilterCount > 0 && (
              <button
                type="button"
                onClick={() => { setSearchQuery(''); setTypeFilter('all'); }}
                className="px-2 py-0.5 text-red-400 hover:text-red-300 text-xs transition-colors whitespace-nowrap"
              >
                Clear All
              </button>
            )}
          </div>
        </div>

        {/* Filters Panel */}
        {showFilters && (
          <div className="mb-4 space-y-4">
            {/* Search Bar */}
            <div className="relative w-full">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-500" />
              <input
                type="text"
                placeholder="Search by order ID, token, description..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 bg-black/40 border border-white/10 text-white placeholder-white/30 focus:outline-none focus:border-white/30 focus:bg-black/60 transition-colors shadow-sm rounded-lg"
              />
            </div>

            {/* Type Filter */}
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-white/50 text-sm">Type:</span>
              {EVENT_TYPE_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  onClick={() => setTypeFilter(option.value)}
                  className={`px-3 py-1.5 text-sm rounded-full transition-colors ${
                    typeFilter === option.value
                      ? 'bg-white text-black'
                      : 'bg-white/10 text-white/70 hover:bg-white/20 hover:text-white'
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>
        )}
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
        ) : filteredAndSortedEvents.length === 0 ? (
          <div className="text-center py-12 text-white/50">
            No events match your filters.
          </div>
        ) : (
          <>
            {/* Table Header - Sortable */}
            <div className="hidden md:grid md:grid-cols-12 gap-4 px-4 py-2 text-xs text-white/50 uppercase tracking-wide border-b border-white/10">
              <button
                onClick={() => handleSort('type')}
                className="col-span-2 flex items-center gap-1 hover:text-white/80 transition-colors text-left"
              >
                Type <SortIcon field="type" />
              </button>
              <button
                onClick={() => handleSort('description')}
                className="col-span-8 flex items-center gap-1 hover:text-white/80 transition-colors text-left"
              >
                Description <SortIcon field="description" />
              </button>
              <button
                onClick={() => handleSort('time')}
                className="col-span-2 flex items-center gap-1 justify-end hover:text-white/80 transition-colors"
              >
                Time <SortIcon field="time" />
              </button>
            </div>

            {/* Events List */}
            <div className="divide-y divide-white/5">
              {filteredAndSortedEvents.map((event) => {
                const config = EVENT_CONFIG[event.event_type] || {
                  label: event.event_type,
                  icon: <RefreshCw className="w-4 h-4" />,
                  color: 'text-white/70',
                  bgColor: 'bg-white/10',
                };

                const txHash = event.event_data.tx_hash;
                const explorerUrl = txHash ? `/tx/${txHash}` : null;

                const rowContent = (
                  <>
                    {/* Event Type */}
                    <div className="md:col-span-2 flex items-center gap-2">
                      <span className={`p-1.5 rounded-lg ${config.bgColor}`}>
                        <span className={config.color}>{config.icon}</span>
                      </span>
                      <span className={`text-sm font-medium ${config.color}`}>
                        {config.label}
                      </span>
                    </div>

                    {/* Description */}
                    <div className="md:col-span-8 text-sm text-white/80">
                      {getEventDescription(event)}
                    </div>

                    {/* Time */}
                    <div className="md:col-span-2 text-right text-sm text-white/50">
                      {formatDistanceToNow(new Date(event.created_at), { addSuffix: true })}
                    </div>
                  </>
                );

                return explorerUrl ? (
                  <a
                    key={event.id}
                    href={explorerUrl}
                    className="grid grid-cols-1 md:grid-cols-12 gap-2 md:gap-4 px-4 py-4 hover:bg-white/5 transition-colors cursor-pointer"
                  >
                    {rowContent}
                  </a>
                ) : (
                  <div
                    key={event.id}
                    className="grid grid-cols-1 md:grid-cols-12 gap-2 md:gap-4 px-4 py-4"
                  >
                    {rowContent}
                  </div>
                );
              })}
            </div>

            {/* Results count */}
            {(searchQuery.trim() || typeFilter !== 'all') && (
              <div className="pt-4 text-center text-sm text-white/40">
                Showing {filteredAndSortedEvents.length} of {events.length} events
              </div>
            )}
          </>
        )}
      </LiquidGlassCard>
    </div>
  );
}
