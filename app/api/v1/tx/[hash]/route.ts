import { NextRequest } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { checkRateLimit, RATE_LIMITS, apiSuccess, apiError } from '@/lib/rate-limit';

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseAnonKey);

/**
 * GET /api/v1/tx/[hash]
 *
 * Returns AgoraX transaction details by looking up the tx hash across
 * orders (creation_tx_hash), order_fills (tx_hash), and order_cancellations (tx_hash).
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ hash: string }> }
): Promise<Response> {
  const rateLimited = await checkRateLimit(request, RATE_LIMITS.data);
  if (rateLimited) return rateLimited;

  const { hash } = await params;

  // Validate tx hash format
  if (!hash || !/^0x[a-fA-F0-9]{64}$/.test(hash)) {
    return apiError('Invalid transaction hash. Must be a 0x-prefixed 64-character hex string.', 400);
  }

  const txHash = hash.toLowerCase();

  try {
    // Query all three tables in parallel
    const [orderResult, fillsResult, cancellationResult] = await Promise.all([
      supabase
        .from('orders')
        .select('*')
        .eq('creation_tx_hash', txHash)
        .maybeSingle(),

      supabase
        .from('order_fills')
        .select('*')
        .eq('tx_hash', txHash),

      supabase
        .from('order_cancellations')
        .select('*')
        .eq('tx_hash', txHash)
        .maybeSingle(),
    ]);

    const events: Array<{ type: string; data: unknown }> = [];

    // Order creation
    if (orderResult.data) {
      const order = orderResult.data;
      const nowUnix = Math.floor(Date.now() / 1000);
      let statusLabel = 'active';
      if (order.status === 1) statusLabel = 'cancelled';
      else if (order.status === 2) statusLabel = 'completed';
      else if (order.fill_percentage >= 100) statusLabel = 'completed';
      else if (order.expiration > 0 && order.expiration <= nowUnix) statusLabel = 'expired';

      events.push({
        type: 'order_created',
        data: { ...order, status_label: statusLabel },
      });
    }

    // Fills (a single tx can fill multiple orders)
    if (fillsResult.data && fillsResult.data.length > 0) {
      // Fetch the parent orders for context
      const orderIds = [...new Set(fillsResult.data.map(f => f.order_id))];
      const { data: parentOrders } = await supabase
        .from('orders')
        .select('order_id, maker_address, sell_token_address, sell_token_ticker, sell_amount_raw, sell_amount_formatted, status, fill_percentage')
        .in('order_id', orderIds);

      const orderMap = new Map((parentOrders || []).map(o => [o.order_id, o]));

      for (const fill of fillsResult.data) {
        events.push({
          type: 'order_filled',
          data: {
            ...fill,
            parent_order: orderMap.get(fill.order_id) || null,
          },
        });
      }
    }

    // Cancellation
    if (cancellationResult.data) {
      const cancel = cancellationResult.data;
      // Fetch the parent order for context
      const { data: parentOrder } = await supabase
        .from('orders')
        .select('order_id, maker_address, sell_token_address, sell_token_ticker, sell_amount_raw, sell_amount_formatted, buy_tokens_tickers')
        .eq('order_id', cancel.order_id)
        .maybeSingle();

      events.push({
        type: 'order_cancelled',
        data: {
          ...cancel,
          parent_order: parentOrder || null,
        },
      });
    }

    if (events.length === 0) {
      return apiError('Transaction not found in AgoraX records', 404);
    }

    return apiSuccess({ tx_hash: txHash, events }, request);
  } catch {
    return apiError('Internal server error', 500);
  }
}
