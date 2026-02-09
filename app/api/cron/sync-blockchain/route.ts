import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createPublicClient, http, parseAbiItem } from 'viem';
import { pulsechain } from 'viem/chains';
import { TOKEN_CONSTANTS } from '@/constants/crypto';

// Supabase with service role for writes
const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

// Contract config
const CONTRACT_ADDRESS = (process.env.NEXT_PUBLIC_AGORAX_SMART_CONTRACT || '0xc8a47F14b1833310E2aC72e4C397b5b14a9FEf8B') as `0x${string}`;
const RPC_URL = 'https://rpc.pulsechain.com';
const DEPLOYMENT_BLOCK = 21266815n;

// Vercel cron secret (set CRON_SECRET in env)
const CRON_SECRET = process.env.CRON_SECRET;

// Token resolution
const TOKEN_MAP = new Map<string, { ticker: string; decimals: number }>();
TOKEN_CONSTANTS
  .filter((t): t is typeof t & { a: string } => t.a !== null && t.a.trim() !== '')
  .forEach((t) => {
    TOKEN_MAP.set(t.a.toLowerCase(), { ticker: t.ticker, decimals: t.decimals });
  });
TOKEN_MAP.set('0x000000000000000000000000000000000000dead', { ticker: 'PLS', decimals: 18 });
TOKEN_MAP.set('0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee', { ticker: 'PLS', decimals: 18 });

function getTokenTicker(address: string): string {
  return TOKEN_MAP.get(address.toLowerCase())?.ticker || 'UNKNOWN';
}

function getTokenDecimals(address: string): number {
  return TOKEN_MAP.get(address.toLowerCase())?.decimals || 18;
}

function formatAmount(amount: bigint, decimals: number): number {
  const str = amount.toString();
  if (str.length <= decimals) {
    return parseFloat('0.' + str.padStart(decimals, '0'));
  }
  const intPart = str.slice(0, -decimals);
  const decPart = str.slice(-decimals);
  return parseFloat(`${intPart}.${decPart}`);
}

// Event ABIs (must match contract's actual event signatures)
const ORDER_PLACED_EVENT = parseAbiItem(
  'event OrderPlaced(address indexed user, uint256 indexed orderID, address indexed sellToken, uint256 sellAmount, uint256[] buyTokensIndex, uint256[] buyAmounts, uint64 expirationTime, bool allOrNothing)'
);
const ORDER_FILLED_EVENT = parseAbiItem(
  'event OrderFilled(address indexed buyer, uint256 indexed orderID, uint256 indexed buyTokenIndex, uint256 buyAmount)'
);
const ORDER_CANCELLED_EVENT = parseAbiItem(
  'event OrderCancelled(address indexed user, uint256 indexed orderID)'
);
const ORDER_PROCEEDS_COLLECTED_EVENT = parseAbiItem(
  'event OrderProceedsCollected(address indexed user, uint256 indexed orderID)'
);

const EVENT_XP: Record<string, number> = {
  order_created: 10,
  order_filled: 10,
  order_cancelled: 0,
  proceeds_claimed: 5,
  trade_completed: 25,
  wallet_connected: 0,
};

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    // Auth: Vercel cron sends authorization header, or check CRON_SECRET
    if (CRON_SECRET) {
      const auth = request.headers.get('authorization');
      if (auth !== `Bearer ${CRON_SECRET}`) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }
    }

    const startTime = Date.now();

    // 1. Get last synced block from sync_state table
    const { data: syncState, error: syncError } = await supabase
      .from('sync_state')
      .select('value')
      .eq('key', 'last_synced_block')
      .single();

    if (syncError || !syncState) {
      // Table may not exist yet - use deployment block
      console.log('sync_state not found, using deployment block');
    }

    const lastSyncedBlock = syncState ? BigInt(syncState.value) : DEPLOYMENT_BLOCK;
    // Start from the next block after the last synced one
    const fromBlock = lastSyncedBlock + 1n;

    const client = createPublicClient({
      chain: pulsechain,
      transport: http(RPC_URL, { timeout: 30000, retryCount: 3 }),
    });

    // Get current block number
    const currentBlock = await client.getBlockNumber();

    // Nothing new to sync
    if (fromBlock > currentBlock) {
      return NextResponse.json({
        success: true,
        message: 'Already up to date',
        last_synced_block: lastSyncedBlock.toString(),
        current_block: currentBlock.toString(),
      });
    }

    // Cap at 10000 blocks per run to stay within Vercel timeout (max ~10s for hobby, 60s for pro)
    const maxBlocksPerRun = 10000n;
    const toBlock = fromBlock + maxBlocksPerRun < currentBlock
      ? fromBlock + maxBlocksPerRun
      : currentBlock;

    const CONTRACT_ABI = (await import('@/config/abis')).CONTRACT_ABI;

    // Fetch whitelist for token resolution
    let whitelist: string[] = [];
    try {
      const whitelistResult = await client.readContract({
        address: CONTRACT_ADDRESS,
        abi: CONTRACT_ABI,
        functionName: 'viewWhitelisted',
        args: [0n, 1000n],
      }) as [Array<{ tokenAddress: string; isActive: boolean }>, bigint];
      whitelist = whitelistResult[0].map((t) => t.tokenAddress.toLowerCase());
    } catch (err) {
      console.error('Failed to fetch whitelist:', err);
    }

    // 2. Fetch events in the block range
    const logParams = { address: CONTRACT_ADDRESS, fromBlock, toBlock };

    const [placedLogs, filledLogs, cancelledLogs, proceedsLogs] = await Promise.all([
      client.getLogs({ ...logParams, event: ORDER_PLACED_EVENT as any }).catch(() => [] as any[]),
      client.getLogs({ ...logParams, event: ORDER_FILLED_EVENT as any }).catch(() => [] as any[]),
      client.getLogs({ ...logParams, event: ORDER_CANCELLED_EVENT as any }).catch(() => [] as any[]),
      client.getLogs({ ...logParams, event: ORDER_PROCEEDS_COLLECTED_EVENT as any }).catch(() => [] as any[]),
    ]);

    const totalEvents = placedLogs.length + filledLogs.length + cancelledLogs.length + proceedsLogs.length;

    // If no events, just advance the cursor
    if (totalEvents === 0) {
      await supabase
        .from('sync_state')
        .upsert({ key: 'last_synced_block', value: Number(toBlock), updated_at: new Date().toISOString() });

      return NextResponse.json({
        success: true,
        message: 'No new events',
        blocks_scanned: `${fromBlock} to ${toBlock}`,
        current_block: currentBlock.toString(),
        duration_ms: Date.now() - startTime,
      });
    }

    // 3. Collect unique blocks for timestamps
    const uniqueBlocks = new Set<bigint>();
    for (const log of [...placedLogs, ...filledLogs, ...cancelledLogs, ...proceedsLogs]) {
      uniqueBlocks.add(log.blockNumber);
    }

    const blockTimestamps = new Map<bigint, number>();
    const blockArray = Array.from(uniqueBlocks);
    for (let i = 0; i < blockArray.length; i += 20) {
      const batch = blockArray.slice(i, i + 20);
      const results = await Promise.all(
        batch.map((bn) => client.getBlock({ blockNumber: bn }).catch(() => null))
      );
      for (let j = 0; j < results.length; j++) {
        if (results[j]) blockTimestamps.set(batch[j], Number(results[j]!.timestamp));
      }
    }

    // 4. Ensure all wallets exist
    const allWallets = new Set<string>();
    for (const log of placedLogs) if (log.args.user) allWallets.add((log.args.user as string).toLowerCase());
    for (const log of filledLogs) if (log.args.buyer) allWallets.add((log.args.buyer as string).toLowerCase());
    for (const log of cancelledLogs) if (log.args.user) allWallets.add((log.args.user as string).toLowerCase());
    for (const log of proceedsLogs) if (log.args.user) allWallets.add((log.args.user as string).toLowerCase());

    for (const wallet of allWallets) {
      await supabase
        .from('users')
        .upsert({ wallet_address: wallet }, { onConflict: 'wallet_address', ignoreDuplicates: true });
    }

    // 5. Batch-fetch order details from contract for all order IDs in this batch
    const allOrderIds = new Set<string>();
    for (const log of placedLogs) { const oid = log.args.orderID?.toString(); if (oid) allOrderIds.add(oid); }
    for (const log of filledLogs) { const oid = log.args.orderID?.toString(); if (oid) allOrderIds.add(oid); }
    for (const log of cancelledLogs) { const oid = log.args.orderID?.toString(); if (oid) allOrderIds.add(oid); }
    for (const log of proceedsLogs) { const oid = log.args.orderID?.toString(); if (oid) allOrderIds.add(oid); }

    const onChainOrders = new Map<string, any>();
    const orderIdArray = Array.from(allOrderIds);
    for (let i = 0; i < orderIdArray.length; i += 10) {
      const batch = orderIdArray.slice(i, i + 10);
      const batchResults = await Promise.all(
        batch.map((oid) =>
          client.readContract({
            address: CONTRACT_ADDRESS,
            abi: CONTRACT_ABI,
            functionName: 'getOrderDetails',
            args: [BigInt(oid)],
          }).then((res: any) => ({ oid, data: res })).catch(() => ({ oid, data: null }))
        )
      );
      for (const { oid, data } of batchResults) {
        if (data) {
          const details = data.orderDetailsWithID || data;
          onChainOrders.set(oid, details);
        }
      }
    }

    // Build order owner map from placed events
    const orderOwnerMap = new Map<string, { owner: string; sellToken: string; sellTicker: string; timestamp: number }>();

    const stats = { placed: 0, filled: 0, cancelled: 0, proceeds: 0, errors: [] as string[] };

    // 6. Process OrderPlaced
    for (const log of placedLogs) {
      const owner = (log.args.user as string).toLowerCase();
      const orderId = log.args.orderID?.toString();
      const sellToken = (log.args.sellToken as string).toLowerCase();
      const sellAmount = log.args.sellAmount as bigint;
      const timestamp = blockTimestamps.get(log.blockNumber) || 0;
      if (!orderId) continue;

      orderOwnerMap.set(orderId, { owner, sellToken, sellTicker: getTokenTicker(sellToken), timestamp });

      const sellDecimals = getTokenDecimals(sellToken);

      // Record event (dedup via tx_hash)
      await recordEvent(owner, 'order_created', {
        order_id: Number(orderId),
        sell_token: getTokenTicker(sellToken),
        sell_amount: formatAmount(sellAmount, sellDecimals).toString(),
        tx_hash: log.transactionHash,
      }, EVENT_XP.order_created);

      // Write to orders table
      try {
        const onChain = onChainOrders.get(orderId);
        const orderDetails = onChain?.orderDetails;
        const buyTokensIndices = (orderDetails?.buyTokensIndex || []).map((x: any) => Number(x));
        const buyAddresses = buyTokensIndices.map((idx: number) => whitelist[idx] || '');
        const buyTickers = buyAddresses.map((addr: string) => addr ? getTokenTicker(addr) : 'UNKNOWN');
        const buyAmountsRaw = (orderDetails?.buyAmounts || []).map((a: any) => a.toString());
        const buyAmountsFormatted = (orderDetails?.buyAmounts || []).map((a: any, i: number) => {
          const addr = buyAddresses[i];
          const dec = addr ? getTokenDecimals(addr) : 18;
          return formatAmount(BigInt(a), dec);
        });

        const orderStatus = onChain ? Number(onChain.status ?? 0) : 0;
        const totalSell = orderDetails?.sellAmount ? BigInt(orderDetails.sellAmount) : 0n;
        const redeemed = onChain?.redeemedSellAmount ? BigInt(onChain.redeemedSellAmount) : 0n;
        const fillPct = totalSell > 0n ? Number((redeemed * 10000n) / totalSell) / 100 : 0;

        await supabase.from('orders').upsert({
          order_id: Number(orderId),
          maker_address: owner,
          sell_token_address: sellToken,
          sell_token_ticker: getTokenTicker(sellToken),
          sell_amount_raw: sellAmount.toString(),
          sell_amount_formatted: formatAmount(sellAmount, sellDecimals),
          buy_tokens_addresses: buyAddresses,
          buy_tokens_tickers: buyTickers,
          buy_amounts_raw: buyAmountsRaw,
          buy_amounts_formatted: buyAmountsFormatted,
          status: orderStatus,
          fill_percentage: fillPct,
          remaining_sell_amount: onChain?.remainingSellAmount?.toString() || sellAmount.toString(),
          redeemed_sell_amount: redeemed.toString(),
          is_all_or_nothing: Boolean(orderDetails?.allOrNothing),
          expiration: Number(orderDetails?.expirationTime || 0n),
          creation_tx_hash: log.transactionHash,
          creation_block_number: Number(log.blockNumber),
          created_at: timestamp ? new Date(timestamp * 1000).toISOString() : new Date().toISOString(),
        }, { onConflict: 'order_id' });
      } catch (err) {
        stats.errors.push(`Order write ${orderId}: ${err}`);
      }

      stats.placed++;
    }

    // 7. Process OrderFilled
    for (const log of filledLogs) {
      const buyer = (log.args.buyer as string).toLowerCase();
      const orderId = log.args.orderID?.toString();
      const buyTokenIndex = log.args.buyTokenIndex !== undefined ? Number(log.args.buyTokenIndex) : -1;
      const buyAmount = log.args.buyAmount as bigint;
      const timestamp = blockTimestamps.get(log.blockNumber) || 0;
      if (!orderId) continue;

      const buyTokenAddress = whitelist[buyTokenIndex] || '';
      const buyTicker = buyTokenAddress ? getTokenTicker(buyTokenAddress) : 'UNKNOWN';
      const buyDecimals = buyTokenAddress ? getTokenDecimals(buyTokenAddress) : 18;

      const orderMeta = orderOwnerMap.get(orderId);

      // Record order_filled for filler
      await recordEvent(buyer, 'order_filled', {
        order_id: Number(orderId),
        buy_token_used: buyTicker,
        fill_amount: formatAmount(buyAmount, buyDecimals).toString(),
        tx_hash: log.transactionHash,
      }, EVENT_XP.order_filled);

      // Record trade_completed for filler (taker)
      if (orderMeta) {
        await recordEvent(buyer, 'trade_completed', {
          order_id: Number(orderId),
          sell_token: orderMeta.sellTicker,
          buy_token: buyTicker,
          sell_amount: '0',
          buy_amount: formatAmount(buyAmount, buyDecimals).toString(),
          volume_usd: 0,
          is_maker: false,
          filler_wallet: buyer,
        }, EVENT_XP.trade_completed);

        // Record trade_completed for maker
        await recordEvent(orderMeta.owner, 'trade_completed', {
          order_id: Number(orderId),
          sell_token: orderMeta.sellTicker,
          buy_token: buyTicker,
          sell_amount: '0',
          buy_amount: formatAmount(buyAmount, buyDecimals).toString(),
          volume_usd: 0,
          is_maker: true,
          filler_wallet: buyer,
        }, EVENT_XP.trade_completed);
      }

      // Write to order_fills table
      try {
        const { error } = await supabase.from('order_fills').insert({
          order_id: Number(orderId),
          filler_address: buyer,
          buy_token_index: buyTokenIndex,
          buy_token_address: buyTokenAddress,
          buy_token_ticker: buyTicker,
          buy_amount_raw: buyAmount.toString(),
          buy_amount_formatted: formatAmount(buyAmount, buyDecimals),
          volume_usd: 0,
          tx_hash: log.transactionHash,
          block_number: Number(log.blockNumber),
          filled_at: timestamp ? new Date(timestamp * 1000).toISOString() : new Date().toISOString(),
        });
        if (error && error.code !== '23505') stats.errors.push(`Fill write ${orderId}: ${error.message}`);
      } catch (err) {
        stats.errors.push(`Fill write ${orderId}: ${err}`);
      }

      stats.filled++;
    }

    // 8. Process OrderCancelled
    for (const log of cancelledLogs) {
      const user = (log.args.user as string).toLowerCase();
      const orderId = log.args.orderID?.toString();
      const timestamp = blockTimestamps.get(log.blockNumber) || 0;
      if (!orderId) continue;

      const orderMeta = orderOwnerMap.get(orderId);
      const timeSinceCreation = orderMeta ? Math.max(0, timestamp - orderMeta.timestamp) : 0;

      await recordEvent(user, 'order_cancelled', {
        order_id: Number(orderId),
        time_since_creation_seconds: timeSinceCreation,
        tx_hash: log.transactionHash,
      }, EVENT_XP.order_cancelled);

      // Write to order_cancellations table
      try {
        const onChain = onChainOrders.get(orderId);
        const totalSell = onChain?.orderDetails?.sellAmount ? BigInt(onChain.orderDetails.sellAmount) : 0n;
        const redeemed = onChain?.redeemedSellAmount ? BigInt(onChain.redeemedSellAmount) : 0n;
        const fillPctAtCancel = totalSell > 0n ? Number((redeemed * 10000n) / totalSell) / 100 : 0;

        const { error } = await supabase.from('order_cancellations').insert({
          order_id: Number(orderId),
          cancelled_by: user,
          fill_percentage_at_cancel: fillPctAtCancel,
          time_since_creation_seconds: timeSinceCreation,
          tx_hash: log.transactionHash,
          block_number: Number(log.blockNumber),
          cancelled_at: timestamp ? new Date(timestamp * 1000).toISOString() : new Date().toISOString(),
        });
        if (error && error.code !== '23505') stats.errors.push(`Cancel write ${orderId}: ${error.message}`);
      } catch (err) {
        stats.errors.push(`Cancel write ${orderId}: ${err}`);
      }

      // Update order status
      await supabase.from('orders').update({ status: 1, updated_at: new Date().toISOString() }).eq('order_id', Number(orderId));

      stats.cancelled++;
    }

    // 9. Process OrderProceedsCollected
    for (const log of proceedsLogs) {
      const user = (log.args.user as string).toLowerCase();
      const orderId = log.args.orderID?.toString();
      const timestamp = blockTimestamps.get(log.blockNumber) || 0;
      if (!orderId) continue;

      await recordEvent(user, 'proceeds_claimed', {
        order_id: Number(orderId),
        tx_hash: log.transactionHash,
      }, EVENT_XP.proceeds_claimed);

      // Write to order_proceeds table
      try {
        const { error } = await supabase.from('order_proceeds').insert({
          order_id: Number(orderId),
          claimed_by: user,
          tx_hash: log.transactionHash,
          block_number: Number(log.blockNumber),
          claimed_at: timestamp ? new Date(timestamp * 1000).toISOString() : new Date().toISOString(),
        });
        if (error && error.code !== '23505') stats.errors.push(`Proceeds write ${orderId}: ${error.message}`);
      } catch (err) {
        stats.errors.push(`Proceeds write ${orderId}: ${err}`);
      }

      stats.proceeds++;
    }

    // 10. Recalculate stats for affected users
    for (const wallet of allWallets) {
      await recalculateUserStats(wallet);
    }

    // 11. Advance the sync cursor
    await supabase
      .from('sync_state')
      .upsert({ key: 'last_synced_block', value: Number(toBlock), updated_at: new Date().toISOString() });

    return NextResponse.json({
      success: true,
      blocks_scanned: `${fromBlock} to ${toBlock}`,
      behind: currentBlock > toBlock ? `${currentBlock - toBlock} blocks behind` : 'caught up',
      events: {
        placed: stats.placed,
        filled: stats.filled,
        cancelled: stats.cancelled,
        proceeds: stats.proceeds,
        total: totalEvents,
      },
      wallets_affected: allWallets.size,
      errors: stats.errors.length > 0 ? stats.errors.slice(0, 10) : undefined,
      duration_ms: Date.now() - startTime,
    });
  } catch (error) {
    console.error('Sync cron error:', error);
    return NextResponse.json({ success: false, error: `Sync failed: ${error}` }, { status: 500 });
  }
}

// Record event with dedup
async function recordEvent(
  wallet: string,
  eventType: string,
  eventData: Record<string, unknown>,
  xp: number
) {
  try {
    // Dedup by tx_hash + event_type + wallet
    if (eventData.tx_hash) {
      const { data: existing } = await supabase
        .from('user_events')
        .select('id')
        .eq('wallet_address', wallet)
        .eq('event_type', eventType)
        .contains('event_data', { tx_hash: eventData.tx_hash })
        .limit(1)
        .maybeSingle();
      if (existing) return;
    }

    const { error } = await supabase.rpc('record_user_event', {
      p_wallet_address: wallet,
      p_event_type: eventType,
      p_event_data: eventData,
      p_xp_awarded: xp,
    });

    if (error) {
      await supabase.from('user_events').insert({
        wallet_address: wallet,
        event_type: eventType,
        event_data: eventData,
        xp_awarded: xp,
      });
    }
  } catch {
    // Non-critical - continue processing
  }
}

// Lightweight stats recalculation
async function recalculateUserStats(wallet: string) {
  try {
    const { data: events } = await supabase
      .from('user_events')
      .select('event_type, xp_awarded, event_data, created_at')
      .eq('wallet_address', wallet);

    if (!events) return;

    let totalXp = 0;
    let ordersCreated = 0;
    let ordersFilled = 0;
    let ordersCancelled = 0;
    let totalTrades = 0;
    let totalVolumeUsd = 0;
    let totalVolumeAsMaker = 0;
    let totalVolumeAsTaker = 0;
    let fillsGiven = 0;
    let fillsReceived = 0;
    let proceedsClaims = 0;
    const uniqueTokens = new Set<string>();
    let firstTradeDate: string | null = null;

    for (const event of events) {
      totalXp += event.xp_awarded || 0;
      const data = event.event_data as Record<string, any> | null;

      switch (event.event_type) {
        case 'order_created': ordersCreated++; break;
        case 'order_filled': ordersFilled++; fillsGiven++; break;
        case 'order_cancelled': ordersCancelled++; break;
        case 'trade_completed': {
          totalTrades++;
          const vol = parseFloat(data?.volume_usd || '0') || 0;
          totalVolumeUsd += vol;
          if (data?.is_maker) { totalVolumeAsMaker += vol; fillsReceived++; }
          else { totalVolumeAsTaker += vol; }
          if (data?.sell_token) uniqueTokens.add(data.sell_token.toUpperCase());
          if (data?.buy_token) uniqueTokens.add(data.buy_token.toUpperCase());
          if (!firstTradeDate || event.created_at < firstTradeDate) firstTradeDate = event.created_at;
          break;
        }
        case 'proceeds_claimed': proceedsClaims++; break;
      }
    }

    const { data: challengeXp } = await supabase
      .from('completed_challenges')
      .select('xp_awarded')
      .eq('wallet_address', wallet);

    const challengeXpTotal = challengeXp?.reduce((sum, c) => sum + (c.xp_awarded || 0), 0) || 0;

    // Query orders table for accurate current_active_orders count
    // Only count orders that are status 0 (active) AND not expired (expiration 0 means no expiry, or expiration > now)
    const nowUnix = Math.floor(Date.now() / 1000);
    const { count: activeOrdersCount } = await supabase
      .from('orders')
      .select('*', { count: 'exact', head: true })
      .eq('maker_address', wallet)
      .eq('status', 0)
      .or(`expiration.eq.0,expiration.gt.${nowUnix}`);

    const updateData: Record<string, any> = {
      total_xp: totalXp + challengeXpTotal,
      total_orders_created: ordersCreated,
      total_orders_filled: ordersFilled,
      total_orders_cancelled: ordersCancelled,
      total_trades: totalTrades,
      total_volume_usd: totalVolumeUsd,
      total_volume_as_maker_usd: totalVolumeAsMaker,
      total_volume_as_taker_usd: totalVolumeAsTaker,
      total_fills_given: fillsGiven,
      total_fills_received: fillsReceived,
      total_proceeds_claims: proceedsClaims,
      total_unique_tokens_traded: uniqueTokens.size,
      total_proceeds_claimed: proceedsClaims,
      current_active_orders: activeOrdersCount || 0,
      updated_at: new Date().toISOString(),
    };

    if (firstTradeDate) {
      updateData.first_trade_date = firstTradeDate.split('T')[0];
    }

    await supabase.from('users').update(updateData).eq('wallet_address', wallet);
  } catch {
    // Non-critical
  }
}
