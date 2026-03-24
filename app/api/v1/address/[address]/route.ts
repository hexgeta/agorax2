import { NextRequest } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { checkRateLimit, RATE_LIMITS, apiSuccess, apiError, isValidAddress } from '@/lib/rate-limit';

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseAnonKey);

/**
 * GET /api/v1/address/[address]
 *
 * Returns orders created by and fills made by a given wallet address,
 * plus summary stats and XP data from the leaderboard.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ address: string }> }
): Promise<Response> {
  const rateLimited = await checkRateLimit(request, RATE_LIMITS.data);
  if (rateLimited) return rateLimited;

  const { address: rawAddress } = await params;

  if (!isValidAddress(rawAddress)) {
    return apiError('Invalid Ethereum address format.', 400);
  }

  const address = rawAddress.toLowerCase();

  try {
    // Fetch orders, fills, and user XP data in parallel
    const [ordersResult, fillsResult, userResult] = await Promise.all([
      supabase
        .from('orders')
        .select('*')
        .ilike('maker_address', address)
        .order('created_at', { ascending: false }),

      supabase
        .from('order_fills')
        .select('*')
        .ilike('filler_address', address)
        .order('filled_at', { ascending: false }),

      supabase
        .from('users')
        .select(
          'wallet_address, total_xp, current_prestige, total_orders_created, total_orders_filled, ' +
          'total_orders_cancelled, total_trades, unique_tokens_traded, ' +
          'current_active_orders, longest_streak_days, current_streak_days, last_trade_date, created_at'
        )
        .ilike('wallet_address', address)
        .maybeSingle(),
    ]);

    if (ordersResult.error) {
      return apiError(`Failed to fetch orders: ${ordersResult.error.message}`, 500);
    }
    if (fillsResult.error) {
      return apiError(`Failed to fetch fills: ${fillsResult.error.message}`, 500);
    }

    const orders = ordersResult.data || [];
    const fills = fillsResult.data || [];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const user = (userResult.data as any) || null;

    // Compute status labels for orders
    const nowUnix = Math.floor(Date.now() / 1000);
    const ordersWithStatus = orders.map((order) => {
      let status_label = 'active';
      if (order.status === 1) status_label = 'cancelled';
      else if (order.status === 2) status_label = 'completed';
      else if (order.fill_percentage >= 100) status_label = 'completed';
      else if (order.expiration > 0 && order.expiration <= nowUnix) status_label = 'expired';
      return { ...order, status_label };
    });

    // Collect unique tokens from orders and fills
    const tokenSet = new Set<string>();
    for (const order of orders) {
      if (order.sell_token_ticker) tokenSet.add(order.sell_token_ticker);
      if (order.buy_tokens_tickers) {
        for (const t of order.buy_tokens_tickers) tokenSet.add(t);
      }
    }
    for (const fill of fills) {
      if (fill.buy_token_ticker) tokenSet.add(fill.buy_token_ticker);
    }

    // Summary stats
    const totalOrdersCreated = orders.length;
    const totalFillsMade = fills.length;
    const uniqueTokens = tokenSet.size;

    // Total volume: sell amounts for orders, buy amounts for fills
    let totalOrderVolume = 0;
    for (const order of orders) {
      totalOrderVolume += Number(order.sell_amount_formatted || 0);
    }
    let totalFillVolume = 0;
    for (const fill of fills) {
      totalFillVolume += Number(fill.buy_amount_formatted || 0);
    }

    return apiSuccess(
      {
        address: rawAddress,
        orders: ordersWithStatus,
        fills,
        user,
        summary: {
          total_orders_created: totalOrdersCreated,
          total_fills_made: totalFillsMade,
          unique_tokens: uniqueTokens,
          total_order_volume: totalOrderVolume,
          total_fill_volume: totalFillVolume,
          total_xp: user?.total_xp ?? null,
          current_prestige: user?.current_prestige ?? null,
        },
      },
      request
    );
  } catch {
    return apiError('Internal server error', 500);
  }
}
