import { NextRequest } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import {
  checkRateLimit,
  apiSuccess,
  apiError,
} from '@/lib/rate-limit';

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseAnonKey);

const RATE_LIMIT = { limit: 60, windowSeconds: 60 };

/**
 * GET /api/v1/orders/[orderId]
 *
 * Returns full order details including fill history, cancellation info,
 * and proceeds claims.
 *
 * Query params:
 *   include=fills,cancellation,proceeds  (comma-separated, defaults to all)
 *   fills_limit=100                       (max fills to return, default 100, max 500)
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ orderId: string }> }
): Promise<Response> {
  const rateLimited = await checkRateLimit(request, RATE_LIMIT);
  if (rateLimited) return rateLimited;

  const { orderId: orderIdStr } = await params;
  const orderId = parseInt(orderIdStr, 10);

  if (isNaN(orderId) || orderId < 0) {
    return apiError('Invalid order ID. Must be a non-negative integer.', 400);
  }

  const url = new URL(request.url);
  const includeParam = url.searchParams.get('include') || 'fills,cancellation,proceeds';
  const includes = new Set(includeParam.split(',').map((s) => s.trim()));
  const fillsLimit = Math.min(
    parseInt(url.searchParams.get('fills_limit') || '100', 10),
    500
  );

  try {
    // Fetch the order
    const { data: orderData, error: orderError } = await supabase
      .from('orders')
      .select('*')
      .eq('order_id', orderId)
      .single();

    if (orderError) {
      if (orderError.code === 'PGRST116') {
        return apiError(`Order #${orderId} not found`, 404);
      }
      if (orderError.code === '42P01') {
        return apiError(
          'Orders table not found. Run migration 003_full_blockchain_mirror.sql first.',
          503
        );
      }
      return apiError('Failed to fetch order', 500);
    }

    const nowUnix = Math.floor(Date.now() / 1000);
    const getStatusLabel = (o: any): string => {
      if (o.status === 1) return 'cancelled';
      if (o.status === 2) return 'completed';
      if (o.fill_percentage >= 100) return 'completed';
      if (o.expiration > 0 && o.expiration <= nowUnix) return 'expired';
      return 'active';
    };

    const result: Record<string, unknown> = {
      order: {
        ...orderData,
        status_label: getStatusLabel(orderData),
      },
    };

    // Parallel optional fetches
    const promises: Promise<void>[] = [];

    if (includes.has('fills')) {
      promises.push(
        supabase
          .from('order_fills')
          .select(
            'filler_address, buy_token_ticker, buy_amount_raw, ' +
            'sell_amount_released_raw, tx_hash, block_number, filled_at'
          )
          .eq('order_id', orderId)
          .order('filled_at', { ascending: true })
          .limit(fillsLimit)
          .then(({ data, error }) => {
            if (error && error.code !== '42P01') {
            }
            const fills = data || [];

            const uniqueFillers = new Set(fills.map((f) => f.filler_address));

            result.fills = {
              total: fills.length,
              unique_fillers: uniqueFillers.size,
              list: fills,
            };
          })
      );
    }

    if (includes.has('cancellation')) {
      promises.push(
        supabase
          .from('order_cancellations')
          .select('cancelled_by, fill_percentage_at_cancel, time_since_creation_seconds, tx_hash, block_number, cancelled_at')
          .eq('order_id', orderId)
          .single()
          .then(({ data, error }) => {
            if (error && error.code !== 'PGRST116' && error.code !== '42P01') {
            }
            result.cancellation = data || null;
          })
      );
    }

    if (includes.has('proceeds')) {
      promises.push(
        supabase
          .from('order_proceeds')
          .select('claimed_by, tx_hash, block_number, claimed_at')
          .eq('order_id', orderId)
          .order('claimed_at', { ascending: true })
          .then(({ data, error }) => {
            if (error && error.code !== '42P01') {
            }
            result.proceeds = {
              total_claims: (data || []).length,
              list: data || [],
            };
          })
      );
    }

    // Also fetch related events from user_events if available
    promises.push(
      supabase
        .from('user_events')
        .select('event_type, event_data, xp_awarded, created_at')
        .contains('event_data', { order_id: orderId })
        .order('created_at', { ascending: true })
        .limit(50)
        .then(({ data, error }) => {
          if (error) {
            // Silently skip - GIN index may not support this query format
            result.event_history = [];
          } else {
            result.event_history = data || [];
          }
        })
    );

    await Promise.all(promises);

    return apiSuccess(result, request);
  } catch (error) {
    return apiError('Internal server error', 500);
  }
}
