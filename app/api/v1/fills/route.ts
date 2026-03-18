import { NextRequest } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { apiSuccess, apiError } from '@/lib/rate-limit';

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseAnonKey);

/**
 * GET /api/v1/fills?order_ids=2,3,5
 *
 * Fetch fill events for one or more orders. Returns fills grouped by order_id.
 */
export async function GET(req: NextRequest) {
  const orderIdsParam = req.nextUrl.searchParams.get('order_ids');
  if (!orderIdsParam) {
    return apiError('order_ids query parameter is required', 400);
  }

  const orderIds = orderIdsParam.split(',').map(Number).filter(n => !isNaN(n) && n > 0);
  if (orderIds.length === 0) {
    return apiError('No valid order IDs provided', 400);
  }
  if (orderIds.length > 100) {
    return apiError('Maximum 100 order IDs per request', 400);
  }

  const { data, error } = await supabase
    .from('order_fills')
    .select('order_id, buy_token_address, buy_token_ticker, buy_amount_raw, buy_amount_formatted, filled_at')
    .in('order_id', orderIds)
    .order('filled_at', { ascending: true });

  if (error) {
    return apiError('Failed to fetch fills', 500);
  }

  // Group by order_id, aggregate by buy_token_address
  const byOrder: Record<number, Record<string, { address: string; ticker: string; totalAmount: number }>> = {};
  for (const fill of data || []) {
    if (!byOrder[fill.order_id]) byOrder[fill.order_id] = {};
    const tokens = byOrder[fill.order_id];
    const addr = fill.buy_token_address.toLowerCase();
    if (!tokens[addr]) {
      tokens[addr] = { address: addr, ticker: fill.buy_token_ticker, totalAmount: 0 };
    }
    tokens[addr].totalAmount += fill.buy_amount_formatted || 0;
  }

  // Convert to array format
  const result: Record<number, { address: string; ticker: string; totalAmount: number }[]> = {};
  for (const [orderId, tokens] of Object.entries(byOrder)) {
    result[Number(orderId)] = Object.values(tokens);
  }

  return apiSuccess(result, req);
}
