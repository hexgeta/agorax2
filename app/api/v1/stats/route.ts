import { NextRequest } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { checkRateLimit, apiSuccess, apiError } from '@/lib/rate-limit';

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseAnonKey);

const RATE_LIMIT = { limit: 20, windowSeconds: 60 };

/**
 * GET /api/v1/stats
 *
 * Returns protocol-wide aggregate statistics.
 */
export async function GET(request: NextRequest): Promise<Response> {
  const rateLimited = await checkRateLimit(request, RATE_LIMIT);
  if (rateLimited) return rateLimited;

  try {
    // Parallel fetch all aggregate stats
    const [
      usersResult,
      ordersResult,
      fillsResult,
      challengesResult,
      eventsResult,
    ] = await Promise.all([
      // Total users and aggregate user stats
      supabase
        .from('users')
        .select('total_xp, total_trades, total_orders_created, total_orders_filled, total_orders_cancelled'),

      // Order status breakdown (if orders table exists)
      supabase
        .from('orders')
        .select('status', { count: 'exact' }),

      // Total fills (if order_fills table exists)
      supabase
        .from('order_fills')
        .select('*', { count: 'exact', head: true }),

      // Total completed challenges
      supabase
        .from('completed_challenges')
        .select('xp_awarded', { count: 'exact' }),

      // Total events
      supabase
        .from('user_events')
        .select('event_type', { count: 'exact' }),
    ]);

    // Aggregate user stats
    const users = usersResult.data || [];
    const totalUsers = users.length;
    const totalXpIssued = users.reduce((sum, u) => sum + (u.total_xp || 0), 0);
    const totalTrades = users.reduce((sum, u) => sum + (u.total_trades || 0), 0);
    const totalOrdersCreated = users.reduce((sum, u) => sum + (u.total_orders_created || 0), 0);
    const totalOrdersFilled = users.reduce((sum, u) => sum + (u.total_orders_filled || 0), 0);
    const totalOrdersCancelled = users.reduce((sum, u) => sum + (u.total_orders_cancelled || 0), 0);

    // Order breakdown
    const orders = ordersResult.data || [];
    const ordersByStatus = { active: 0, cancelled: 0, completed: 0 };
    orders.forEach((o) => {
      if (o.status === 0) ordersByStatus.active++;
      else if (o.status === 1) ordersByStatus.cancelled++;
      else if (o.status === 2) ordersByStatus.completed++;
    });

    return apiSuccess(
      {
        protocol: {
          total_users: totalUsers,
          total_xp_issued: totalXpIssued,
          total_trades: totalTrades,
          total_orders_created: totalOrdersCreated,
          total_orders_filled: totalOrdersFilled,
          total_orders_cancelled: totalOrdersCancelled,
          fill_rate_percent:
            totalOrdersCreated > 0
              ? Math.round((totalOrdersFilled / totalOrdersCreated) * 1000) / 10
              : 0,
        },
        orders: {
          total: ordersResult.count || orders.length,
          by_status: ordersByStatus,
        },
        fills: {
          total: fillsResult.count || 0,
        },
        achievements: {
          total_challenges_completed: challengesResult.count || 0,
          total_xp_from_challenges: (challengesResult.data || []).reduce(
            (sum, c) => sum + (c.xp_awarded || 0),
            0
          ),
        },
        events: {
          total_recorded: eventsResult.count || 0,
        },
      },
      request,
    );
  } catch {
    return apiError('Internal server error', 500);
  }
}
