import { NextRequest } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import {
  checkRateLimit,
  RATE_LIMITS,
  isValidAddress,
  apiSuccess,
  apiError,
} from '@/lib/rate-limit';

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseAnonKey);

/**
 * GET /api/v1/orders
 *
 * List and search orders with flexible filtering, sorting, and pagination.
 *
 * Query params:
 *   maker=0x...           Filter by maker wallet address
 *   status=active         Filter by status: active, completed, cancelled (or 0,1,2)
 *   sell_token=HEX        Filter by sell token ticker (case-insensitive)
 *   buy_token=PLS         Filter by buy token ticker (case-insensitive)
 *   min_fills=1           Minimum fill count
 *   has_fills=true        Only orders that have been partially/fully filled
 *   sort=created_at       Sort field: created_at, order_id, fill_percentage, total_fills (default: created_at)
 *   order=desc            Sort order: asc or desc (default: desc)
 *   limit=50              Results per page (max 200, default 50)
 *   offset=0              Pagination offset
 */
export async function GET(request: NextRequest): Promise<Response> {
  const rateLimited = await checkRateLimit(request, RATE_LIMITS.data);
  if (rateLimited) return rateLimited;

  const url = new URL(request.url);
  const maker = url.searchParams.get('maker');
  const statusParam = url.searchParams.get('status');
  const sellToken = url.searchParams.get('sell_token');
  const buyToken = url.searchParams.get('buy_token');
  const minFills = url.searchParams.get('min_fills');
  const hasFills = url.searchParams.get('has_fills');
  const sortField = url.searchParams.get('sort') || 'created_at';
  const sortOrder = url.searchParams.get('order') === 'asc' ? true : false;
  const limit = Math.min(parseInt(url.searchParams.get('limit') || '50', 10), 200);
  const offset = Math.max(parseInt(url.searchParams.get('offset') || '0', 10), 0);

  // Validate maker address if provided
  if (maker && !isValidAddress(maker)) {
    return apiError('Invalid maker address format', 400);
  }

  // Validate sort field
  const validSortFields = ['created_at', 'order_id', 'fill_percentage', 'total_fills', 'updated_at'];
  if (!validSortFields.includes(sortField)) {
    return apiError(`Invalid sort field. Valid options: ${validSortFields.join(', ')}`, 400);
  }

  try {
    let query = supabase
      .from('orders')
      .select(
        'order_id, maker_address, sell_token_ticker, sell_token_address, sell_amount_raw, ' +
        'buy_tokens_tickers, buy_tokens_addresses, buy_amounts_raw, ' +
        'status, fill_percentage, remaining_sell_amount, redeemed_sell_amount, ' +
        'is_all_or_nothing, expiration, total_fills, unique_fillers, ' +
        'creation_tx_hash, creation_block_number, created_at, updated_at',
        { count: 'exact' }
      );

    // Apply filters
    if (maker) {
      query = query.eq('maker_address', maker.toLowerCase());
    }

    if (statusParam !== null) {
      const statusMap: Record<string, number> = { active: 0, cancelled: 1, completed: 2 };
      const statusNum = statusMap[statusParam.toLowerCase()] ?? parseInt(statusParam, 10);
      if (isNaN(statusNum) || statusNum < 0 || statusNum > 2) {
        return apiError('Invalid status. Use: active, completed, cancelled (or 0, 1, 2)', 400);
      }
      query = query.eq('status', statusNum);

      // For active orders, also exclude expired and fully filled
      if (statusNum === 0) {
        const nowUnix = Math.floor(Date.now() / 1000);
        query = query.or(`expiration.eq.0,expiration.gt.${nowUnix}`);
        query = query.lt('fill_percentage', 100);
      }
    }

    if (sellToken) {
      query = query.ilike('sell_token_ticker', sellToken);
    }

    if (buyToken) {
      query = query.contains('buy_tokens_tickers', [buyToken.toUpperCase()]);
    }

    if (minFills) {
      const min = parseInt(minFills, 10);
      if (!isNaN(min)) query = query.gte('total_fills', min);
    }

    if (hasFills === 'true') {
      query = query.gt('total_fills', 0);
    }

    // Apply sort and pagination
    query = query
      .order(sortField, { ascending: sortOrder })
      .range(offset, offset + limit - 1);

    const { data, error, count } = await query;

    if (error) {
      // Table might not exist yet if migration hasn't been run
      if (error.code === '42P01') {
        return apiError(
          'Orders table not found. Run migration 003_full_blockchain_mirror.sql first.',
          503
        );
      }
      return apiError('Failed to fetch orders', 500);
    }

    const nowUnix = Math.floor(Date.now() / 1000);

    const getStatusLabel = (o: any): string => {
      if (o.status === 1) return 'cancelled';
      if (o.status === 2) return 'completed';
      // status 0 but check if effectively expired or completed
      if (o.fill_percentage >= 100) return 'completed';
      if (o.expiration > 0 && o.expiration <= nowUnix) return 'expired';
      return 'active';
    };

    return apiSuccess(
      {
        orders: (data || []).map((o) => ({
          // General order details
          order_id: o.order_id,
          maker_address: o.maker_address,
          status: o.status,
          status_label: getStatusLabel(o),
          fill_percentage: o.fill_percentage,
          total_fills: o.total_fills,
          unique_fillers: o.unique_fillers,
          is_all_or_nothing: o.is_all_or_nothing,
          expiration: o.expiration,
          remaining_sell_amount: o.remaining_sell_amount,
          redeemed_sell_amount: o.redeemed_sell_amount,
          created_at: o.created_at,
          updated_at: o.updated_at,
          creation_tx_hash: o.creation_tx_hash,
          creation_block_number: o.creation_block_number,
          // Token details
          sell_token_ticker: o.sell_token_ticker,
          sell_token_address: o.sell_token_address,
          sell_amount_raw: o.sell_amount_raw,
          buy_tokens_tickers: o.buy_tokens_tickers,
          buy_tokens_addresses: o.buy_tokens_addresses,
          buy_amounts_raw: o.buy_amounts_raw || [],
        })),
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
    return apiError('Internal server error', 500);
  }
}
