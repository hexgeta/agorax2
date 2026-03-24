import { NextRequest } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { checkRateLimit, RATE_LIMITS, apiSuccess, apiError } from '@/lib/rate-limit';

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseAnonKey);

/**
 * GET /api/v1/order/[id]
 *
 * Returns full order details including fills, cancellation, and computed status.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<Response> {
  const rateLimited = await checkRateLimit(request, RATE_LIMITS.data);
  if (rateLimited) return rateLimited;

  const { id: idStr } = await params;
  const orderId = parseInt(idStr, 10);

  if (isNaN(orderId) || orderId < 0) {
    return apiError('Invalid order ID. Must be a non-negative integer.', 400);
  }

  try {
    // Fetch order, fills, and cancellation in parallel
    const [orderResult, fillsResult, cancellationResult] = await Promise.all([
      supabase
        .from('orders')
        .select('*')
        .eq('order_id', orderId)
        .single(),

      supabase
        .from('order_fills')
        .select('*')
        .eq('order_id', orderId)
        .order('filled_at', { ascending: true }),

      supabase
        .from('order_cancellations')
        .select('*')
        .eq('order_id', orderId)
        .maybeSingle(),
    ]);

    if (orderResult.error) {
      if (orderResult.error.code === 'PGRST116') {
        return apiError(`Order #${orderId} not found`, 404);
      }
      return apiError('Failed to fetch order', 500);
    }

    const order = orderResult.data;
    const fills = fillsResult.data || [];
    const cancellation = cancellationResult.data || null;

    // Compute status label
    const nowUnix = Math.floor(Date.now() / 1000);
    let status_label = 'active';
    if (order.status === 1) status_label = 'cancelled';
    else if (order.status === 2) status_label = 'completed';
    else if (order.fill_percentage >= 100) status_label = 'completed';
    else if (order.expiration > 0 && order.expiration <= nowUnix) status_label = 'expired';

    // Calculate each fill's contribution percentage
    // sell_amount_released_raw is not populated, so derive from buy_amount_raw proportionally
    const currentFillPct = Number(order.fill_percentage ?? 0);
    const totalBuyRaw = fills.reduce((sum, f) => sum + BigInt(f.buy_amount_raw || '0'), 0n);
    const fillsWithPct = fills.map((fill) => {
      let contribution_pct = 0;
      if (totalBuyRaw > 0n && currentFillPct > 0) {
        const thisBuy = BigInt(fill.buy_amount_raw || '0');
        contribution_pct = Math.round((Number(thisBuy) / Number(totalBuyRaw)) * currentFillPct * 100) / 100;
      }
      return { ...fill, contribution_pct };
    });

    return apiSuccess(
      {
        order: { ...order, status_label },
        fills: fillsWithPct,
        cancellation,
      },
      request
    );
  } catch {
    return apiError('Internal server error', 500);
  }
}
