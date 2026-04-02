import { createClient } from '@supabase/supabase-js';
import StatsClient from './StatsClient';

export const revalidate = 300; // ISR: regenerate every 5 minutes

const DEPLOYMENT_BLOCK = 21266815;

async function fetchProtocolData() {
  const supabase = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_ANON_KEY!
  );

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

  if (ordersResult.error || fillsResult.error) {
    console.error('Failed to fetch protocol data:', ordersResult.error || fillsResult.error);
    return { orders: [], fills: [] };
  }

  // Build map of valid order IDs → creation block from the current contract
  const orderCreationBlock = new Map<number, number>();
  (ordersResult.data || []).forEach((o: { order_id: number; creation_block_number: number }) => {
    orderCreationBlock.set(o.order_id, o.creation_block_number);
  });

  // Filter fills to only include those belonging to current contract orders
  // AND that happened after the order was created. Deduplicate by tx_hash + order_id + buy_token_index.
  const rawFills = fillsResult.data || [];
  const seenFills = new Set<string>();
  const dedupedFills = rawFills.filter((fill: { order_id: number; block_number: number; tx_hash: string; buy_token_index: number }) => {
    const creationBlock = orderCreationBlock.get(fill.order_id);
    if (creationBlock === undefined) return false;
    if (fill.block_number < creationBlock) return false;
    const key = `${fill.tx_hash}-${fill.order_id}-${fill.buy_token_index}`;
    if (seenFills.has(key)) return false;
    seenFills.add(key);
    return true;
  });

  return {
    orders: ordersResult.data || [],
    fills: dedupedFills,
  };
}

export default async function StatsPage() {
  const { orders, fills } = await fetchProtocolData();

  return <StatsClient dbOrders={orders} dbFills={fills} />;
}
