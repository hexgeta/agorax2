// Event types for the prestige/achievements system

export type EventType =
  // Wallet/Connection Events
  | 'wallet_connected'

  // Order Events
  | 'order_created'
  | 'order_filled'
  | 'order_cancelled'
  | 'order_expired'
  | 'proceeds_claimed'

  // View/Interaction Events
  | 'order_viewed'
  | 'chart_viewed'
  | 'marketplace_visited'

  // Trade Events
  | 'trade_completed'

  // Special Events
  | 'streak_updated'
  | 'prestige_unlocked';

// Event data structures for different event types
export interface OrderCreatedEventData {
  order_id: number;
  sell_token: string;
  sell_amount: string;
  buy_tokens: string[];
  buy_amounts: string[];
  volume_usd?: number;
  is_all_or_nothing?: boolean;
  expiration?: number;
  price_vs_market_percent?: number; // % difference from market price (positive = above, negative = below)
}

export interface OrderFilledEventData {
  order_id: number;
  fill_amount: string;
  fill_percentage: number;
  buy_token_used: string;
  volume_usd?: number;
  fill_time_seconds?: number; // Time from order creation to fill
}

export interface OrderCancelledEventData {
  order_id: number;
  time_since_creation_seconds?: number;
  fill_percentage_at_cancel?: number;
}

export interface TradeCompletedEventData {
  order_id: number;
  sell_token: string;
  buy_token: string;
  sell_amount: string;
  buy_amount: string;
  volume_usd: number;
  is_maker: boolean; // true if user created the order, false if filled
  trade_hour_utc?: number; // 0-23, for time-based challenges
}

export interface OrderViewedEventData {
  order_id: number;
  unique_order?: boolean; // true if first time viewing this order
  token_symbol?: string; // sell token symbol for Token Explorer challenge
}

export interface ChartViewedEventData {
  token_pair?: string;
}

export interface PrestigeUnlockedEventData {
  new_prestige_level: number;
  prestige_name: string;
}

export type EventData =
  | OrderCreatedEventData
  | OrderFilledEventData
  | OrderCancelledEventData
  | TradeCompletedEventData
  | OrderViewedEventData
  | ChartViewedEventData
  | PrestigeUnlockedEventData
  | Record<string, unknown>;

// API request/response types
export interface TrackEventRequest {
  wallet_address: string;
  event_type: EventType;
  event_data?: EventData;
}

export interface TrackEventResponse {
  success: boolean;
  event_id?: string;
  xp_awarded?: number;
  challenges_completed?: CompletedChallenge[];
  error?: string;
}

export interface CompletedChallenge {
  prestige_level: number;
  challenge_name: string;
  category: string;
  xp_awarded: number;
}

// User stats from database
export interface UserStats {
  wallet_address: string;
  total_xp: number;
  current_prestige: number;
  total_orders_created: number;
  total_orders_filled: number;
  total_orders_cancelled: number;
  total_volume_usd: number;
  total_trades: number;
  unique_tokens_traded: number;
  current_active_orders: number;
  longest_streak_days: number;
  current_streak_days: number;
  last_trade_date: string | null;
  created_at: string;
  updated_at: string;
}

export interface UserAchievements {
  stats: UserStats;
  completed_challenges: {
    prestige_level: number;
    challenge_name: string;
    category: string;
    xp_awarded: number;
    completed_at: string;
  }[];
}

// Leaderboard entry
export interface LeaderboardEntry {
  wallet_address: string;
  total_xp: number;
  current_prestige: number;
  total_orders_created: number;
  total_orders_filled: number;
  total_trades: number;
  total_volume_usd: number;
  rank: number;
}
