import { NextRequest } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { checkRateLimit, RATE_LIMITS, apiSuccess, apiError } from '@/lib/rate-limit';

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Current contract deployment block — filter out data from previous deployments
const DEPLOYMENT_BLOCK = 21266815;

/**
 * GET /api/v1/stats/protocol-data
 *
 * Returns all orders and fills from Supabase for the stats dashboard.
 * This replaces the slow getLogs + getBlock RPC calls with fast DB reads.
 * Filters by deployment block to exclude stale data from previous contracts.
 * Deduplicates fills by tx_hash (no unique constraint on order_fills table).
 */
export async function GET(request: NextRequest): Promise<Response> {
  const rateLimited = await checkRateLimit(request, RATE_LIMITS.data);
  if (rateLimited) return rateLimited;

  try {
    const [ordersResult, fillsResult] = await Promise.all([
      supabase
        .from('orders')
        .select('order_id, maker_address, sell_token_address, sell_token_ticker, sell_amount_raw, sell_amount_formatted, buy_tokens_addresses, buy_tokens_tickers, buy_amounts_raw, buy_amounts_formatted, status, fill_percentage, remaining_sell_amount, redeemed_sell_amount, is_all_or_nothing, expiration, creation_tx_hash, creation_block_number, created_at')
        .gte('creation_block_number', DEPLOYMENT_BLOCK)
        .order('order_id', { ascending: true }),

      supabase
        .from('order_fills')
        .select('order_id, filler_address, buy_token_index, buy_token_address, buy_token_ticker, buy_amount_raw, buy_amount_formatted, tx_hash, block_number, filled_at')
        .gte('block_number', DEPLOYMENT_BLOCK)
        .order('filled_at', { ascending: true }),
    ]);

    if (ordersResult.error) {
      console.error('Failed to fetch orders:', ordersResult.error);
      return apiError('Failed to fetch orders', 500);
    }

    if (fillsResult.error) {
      console.error('Failed to fetch fills:', fillsResult.error);
      return apiError('Failed to fetch fills', 500);
    }

    // Build map of valid order IDs → creation block from the current contract
    const orderCreationBlock = new Map<number, number>();
    (ordersResult.data || []).forEach((o: { order_id: number; creation_block_number: number }) => {
      orderCreationBlock.set(o.order_id, o.creation_block_number);
    });

    // Filter fills to only include those belonging to current contract orders
    // AND that happened after the order was created (eliminates old contract fills
    // with overlapping order IDs). Then deduplicate by tx_hash + order_id + buy_token_index.
    const rawFills = fillsResult.data || [];
    const seenFills = new Set<string>();
    const dedupedFills = rawFills.filter(fill => {
      const creationBlock = orderCreationBlock.get(fill.order_id);
      // Exclude fills for unknown orders or fills that predate the order's creation
      if (creationBlock === undefined) return false;
      if (fill.block_number < creationBlock) return false;
      const key = `${fill.tx_hash}-${fill.order_id}-${fill.buy_token_index}`;
      if (seenFills.has(key)) return false;
      seenFills.add(key);
      return true;
    });

    return apiSuccess(
      {
        orders: ordersResult.data || [],
        fills: dedupedFills,
      },
      request,
    );
  } catch {
    return apiError('Internal server error', 500);
  }
}
