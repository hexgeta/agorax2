import { NextRequest } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { checkRateLimit, apiSuccess, apiError } from '@/lib/rate-limit';

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseAnonKey);

const RATE_LIMIT = { limit: 20, windowSeconds: 60 };

const PRESTIGE_NAMES = [
  'Alpha', 'Beta', 'Gamma', 'Delta', 'Epsilon',
  'Zeta', 'Eta', 'Theta', 'Omega',
];

/**
 * GET /api/v1/leaderboard
 *
 * Returns ranked users sorted by XP with full stats.
 *
 * Query params:
 *   sort=total_xp         Sort by: total_xp, total_trades, total_volume_usd, total_orders_created (default: total_xp)
 *   order=desc            Sort order: asc or desc (default: desc)
 *   limit=50              Results per page (max 200, default 50)
 *   offset=0              Pagination offset
 *   min_xp=0              Minimum XP threshold
 *   min_trades=0          Minimum trades threshold
 */
export async function GET(request: NextRequest): Promise<Response> {
  const rateLimited = await checkRateLimit(request, RATE_LIMIT);
  if (rateLimited) return rateLimited;

  const url = new URL(request.url);
  const sortField = url.searchParams.get('sort') || 'total_xp';
  const sortOrder = url.searchParams.get('order') === 'asc';
  const limit = Math.min(parseInt(url.searchParams.get('limit') || '50', 10), 200);
  const offset = Math.max(parseInt(url.searchParams.get('offset') || '0', 10), 0);
  const minXp = parseInt(url.searchParams.get('min_xp') || '0', 10);
  const minTrades = parseInt(url.searchParams.get('min_trades') || '0', 10);

  const validSortFields = ['total_xp', 'total_trades', 'total_volume_usd', 'total_orders_created', 'total_orders_filled', 'current_prestige'];
  if (!validSortFields.includes(sortField)) {
    return apiError(`Invalid sort field. Valid options: ${validSortFields.join(', ')}`, 400);
  }

  try {
    let query = supabase
      .from('users')
      .select(
        'wallet_address, total_xp, current_prestige, total_orders_created, total_orders_filled, ' +
        'total_orders_cancelled, total_trades, total_volume_usd, unique_tokens_traded, ' +
        'current_active_orders, longest_streak_days, current_streak_days, last_trade_date, created_at',
        { count: 'exact' }
      );

    if (minXp > 0) query = query.gte('total_xp', minXp);
    if (minTrades > 0) query = query.gte('total_trades', minTrades);

    query = query
      .order(sortField, { ascending: sortOrder })
      .range(offset, offset + limit - 1);

    const { data, error, count } = await query;

    if (error) {
      console.error('Leaderboard query error:', error.message, error.code, error.details);
      return apiError(`Failed to fetch leaderboard: ${error.message}`, 500);
    }

    const ranked = (data || []).map((user, idx) => ({
      rank: offset + idx + 1,
      wallet_address: user.wallet_address,
      total_xp: user.total_xp,
      prestige_level: user.current_prestige,
      prestige_name: PRESTIGE_NAMES[user.current_prestige] || 'Alpha',
      total_orders_created: user.total_orders_created,
      total_orders_filled: user.total_orders_filled,
      total_orders_cancelled: user.total_orders_cancelled,
      total_trades: user.total_trades,
      total_volume_usd: parseFloat(user.total_volume_usd) || 0,
      unique_tokens_traded: user.unique_tokens_traded,
      current_active_orders: user.current_active_orders,
      longest_streak_days: user.longest_streak_days,
      current_streak_days: user.current_streak_days,
      last_trade_date: user.last_trade_date,
      fill_rate_percent:
        user.total_orders_created > 0
          ? Math.round((user.total_orders_filled / user.total_orders_created) * 1000) / 10
          : 0,
      member_since: user.created_at,
    }));

    return apiSuccess(
      {
        leaderboard: ranked,
        pagination: {
          total: count || 0,
          limit,
          offset,
          has_more: (count || 0) > offset + limit,
        },
      },
      request,
    );
  } catch (error) {
    console.error('Leaderboard API error:', error);
    return apiError('Internal server error', 500);
  }
}
