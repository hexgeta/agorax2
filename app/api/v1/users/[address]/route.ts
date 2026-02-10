import { NextRequest } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import {
  checkRateLimit,
  isValidAddress,
  apiSuccess,
  apiError,
} from '@/lib/rate-limit';

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseAnonKey);

const RATE_LIMIT = { limit: 30, windowSeconds: 60 };

/**
 * GET /api/v1/users/[address]
 *
 * Returns full user profile: stats, completed challenges, recent activity,
 * and order summary.
 *
 * Query params:
 *   include=challenges,events,orders,daily  (comma-separated, defaults to all)
 *   events_limit=50       (max recent events to return, default 50, max 200)
 *   orders_limit=50       (max orders to return, default 50, max 200)
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ address: string }> }
): Promise<Response> {
  // Rate limit
  const rateLimited = await checkRateLimit(request, RATE_LIMIT);
  if (rateLimited) return rateLimited;

  const { address } = await params;

  if (!isValidAddress(address)) {
    return apiError('Invalid wallet address format. Expected 0x followed by 40 hex characters.', 400);
  }

  const wallet = address.toLowerCase();
  const url = new URL(request.url);
  const includeParam = url.searchParams.get('include') || 'challenges,events,orders,daily';
  const includes = new Set(includeParam.split(',').map(s => s.trim()));
  const eventsLimit = Math.min(parseInt(url.searchParams.get('events_limit') || '50', 10), 200);
  const ordersLimit = Math.min(parseInt(url.searchParams.get('orders_limit') || '50', 10), 200);

  try {
    // Always fetch user stats
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('*')
      .eq('wallet_address', wallet)
      .single();

    if (userError && userError.code !== 'PGRST116') {
      console.error('User fetch error:', userError);
      return apiError('Failed to fetch user data', 500);
    }

    if (!userData) {
      return apiError('User not found. This wallet has no recorded activity.', 404);
    }

    const result: Record<string, unknown> = {
      wallet_address: wallet,
      stats: {
        total_xp: userData.total_xp,
        current_prestige: userData.current_prestige,
        prestige_name: ['Alpha', 'Beta', 'Gamma', 'Delta', 'Epsilon', 'Zeta', 'Eta', 'Theta', 'Omega'][userData.current_prestige] || 'Alpha',
        total_orders_created: userData.total_orders_created,
        total_orders_filled: userData.total_orders_filled,
        total_orders_cancelled: userData.total_orders_cancelled,
        total_orders_expired: userData.total_orders_expired || 0,
        total_trades: userData.total_trades,
        total_volume_usd: parseFloat(userData.total_volume_usd) || 0,
        total_volume_as_maker_usd: parseFloat(userData.total_volume_as_maker_usd) || 0,
        total_volume_as_taker_usd: parseFloat(userData.total_volume_as_taker_usd) || 0,
        total_fills_given: userData.total_fills_given || 0,
        total_fills_received: userData.total_fills_received || 0,
        unique_tokens_traded: userData.unique_tokens_traded,
        current_active_orders: userData.current_active_orders,
        longest_streak_days: userData.longest_streak_days,
        current_streak_days: userData.current_streak_days,
        last_trade_date: userData.last_trade_date,
        first_trade_date: userData.first_trade_date || null,
        total_proceeds_claimed: userData.total_proceeds_claimed || 0,
        fill_rate_percent: userData.total_orders_created > 0
          ? Math.round((userData.total_orders_filled / userData.total_orders_created) * 1000) / 10
          : 0,
        member_since: userData.created_at,
      },
    };

    // Parallel fetches for optional includes
    const promises: Promise<void>[] = [];

    if (includes.has('challenges')) {
      promises.push(
        supabase
          .from('completed_challenges')
          .select('prestige_level, challenge_name, category, xp_awarded, completed_at')
          .eq('wallet_address', wallet)
          .order('completed_at', { ascending: false })
          .then(({ data, error }) => {
            if (error) console.error('Challenges fetch error:', error);
            result.challenges = {
              total: (data || []).length,
              by_prestige: groupBy(data || [], 'prestige_level'),
              by_category: groupBy(data || [], 'category'),
              list: data || [],
            };
          })
      );
    }

    if (includes.has('events')) {
      promises.push(
        supabase
          .from('user_events')
          .select('event_type, event_data, xp_awarded, created_at')
          .eq('wallet_address', wallet)
          .order('created_at', { ascending: false })
          .limit(eventsLimit)
          .then(({ data, error }) => {
            if (error) console.error('Events fetch error:', error);
            result.recent_events = data || [];
          })
      );
    }

    if (includes.has('orders')) {
      promises.push(
        supabase
          .from('orders')
          .select('order_id, sell_token_ticker, buy_tokens_tickers, sell_amount_formatted, buy_amounts_formatted, status, fill_percentage, total_fills, unique_fillers, is_all_or_nothing, created_at, updated_at')
          .eq('maker_address', wallet)
          .order('created_at', { ascending: false })
          .limit(ordersLimit)
          .then(({ data, error }) => {
            if (error && error.code !== '42P01') {
              // 42P01 = table doesn't exist yet (migration not run)
              console.error('Orders fetch error:', error);
            }
            if (data) {
              const statusCounts = { active: 0, completed: 0, cancelled: 0 };
              data.forEach((o) => {
                if (o.status === 0) statusCounts.active++;
                else if (o.status === 1) statusCounts.cancelled++;
                else if (o.status === 2) statusCounts.completed++;
              });
              result.orders = {
                total: data.length,
                status_counts: statusCounts,
                list: data.map((o) => ({
                  ...o,
                  status_label: o.status === 0 ? 'active' : o.status === 1 ? 'cancelled' : 'completed',
                })),
              };
            } else {
              result.orders = { total: 0, status_counts: { active: 0, completed: 0, cancelled: 0 }, list: [] };
            }
          })
      );
    }

    if (includes.has('daily')) {
      promises.push(
        supabase
          .from('daily_activity')
          .select('activity_date, trades_count, orders_created, orders_filled, volume_usd')
          .eq('wallet_address', wallet)
          .order('activity_date', { ascending: false })
          .limit(90)
          .then(({ data, error }) => {
            if (error) console.error('Daily activity fetch error:', error);
            result.daily_activity = data || [];
          })
      );
    }

    await Promise.all(promises);

    return apiSuccess(result, request);
  } catch (error) {
    console.error('User API error:', error);
    return apiError('Internal server error', 500);
  }
}

function groupBy<T>(items: T[], key: keyof T): Record<string, T[]> {
  const groups: Record<string, T[]> = {};
  items.forEach((item) => {
    const k = String(item[key]);
    if (!groups[k]) groups[k] = [];
    groups[k].push(item);
  });
  return groups;
}
