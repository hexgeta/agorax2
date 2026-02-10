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

// Backfill secret to protect this endpoint
const BACKFILL_SECRET = process.env.BACKFILL_SECRET;

// Build token address -> info map for symbol resolution
const TOKEN_MAP = new Map<string, { ticker: string; decimals: number }>();
TOKEN_CONSTANTS
  .filter((t): t is typeof t & { a: string } => t.a !== null && t.a.trim() !== '')
  .forEach((t) => {
    TOKEN_MAP.set(t.a.toLowerCase(), { ticker: t.ticker, decimals: t.decimals });
  });
// Native PLS addresses
TOKEN_MAP.set('0x000000000000000000000000000000000000dead', { ticker: 'PLS', decimals: 18 });
TOKEN_MAP.set('0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee', { ticker: 'PLS', decimals: 18 });

function getTokenTicker(address: string): string {
  return TOKEN_MAP.get(address.toLowerCase())?.ticker || 'UNKNOWN';
}

function getTokenDecimals(address: string): number {
  return TOKEN_MAP.get(address.toLowerCase())?.decimals || 18;
}

function formatAmount(amount: bigint, decimals: number): number {
  // Convert to a float for storage (not for precise accounting)
  const str = amount.toString();
  if (str.length <= decimals) {
    return parseFloat('0.' + str.padStart(decimals, '0'));
  }
  const intPart = str.slice(0, -decimals);
  const decPart = str.slice(-decimals);
  return parseFloat(`${intPart}.${decPart}`);
}

// Event ABIs matching what the contract actually emits
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

// XP values (same as track/route.ts) - all 0 since XP only comes from challenges
const EVENT_XP: Record<string, number> = {
  order_created: 0,
  order_filled: 0,
  order_cancelled: 0,
  proceeds_claimed: 0,
  trade_completed: 0,
  wallet_connected: 0,
};

interface BackfillResult {
  users_created: number;
  events_recorded: number;
  orders_placed: number;
  orders_filled: number;
  orders_cancelled: number;
  proceeds_collected: number;
  orders_table_written: number;
  fills_table_written: number;
  cancellations_table_written: number;
  proceeds_table_written: number;
  errors: string[];
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    // Auth check
    if (BACKFILL_SECRET) {
      const auth = request.headers.get('authorization');
      if (auth !== `Bearer ${BACKFILL_SECRET}`) {
        return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
      }
    }

    const body = await request.json().catch(() => ({}));
    const fromBlock = body.from_block ? BigInt(body.from_block) : DEPLOYMENT_BLOCK;
    const toBlock = body.to_block ? BigInt(body.to_block) : undefined; // undefined = latest
    const resetEvents = body.reset === true;

    // If reset flag is set, delete all existing user_events first
    if (resetEvents) {
      await supabase.from('user_events').delete().neq('id', '00000000-0000-0000-0000-000000000000');
      console.log('Cleared all user_events for fresh backfill');
    }

    const client = createPublicClient({
      chain: pulsechain,
      transport: http(RPC_URL, { timeout: 30000, retryCount: 3 }),
    });

    const result: BackfillResult = {
      users_created: 0,
      events_recorded: 0,
      orders_placed: 0,
      orders_filled: 0,
      orders_cancelled: 0,
      proceeds_collected: 0,
      orders_table_written: 0,
      fills_table_written: 0,
      cancellations_table_written: 0,
      proceeds_table_written: 0,
      errors: [],
    };

    // Import contract ABI for RPC calls
    const CONTRACT_ABI = (await import('@/config/abis')).CONTRACT_ABI;

    // Fetch the whitelist from the contract so we can resolve buyTokenIndex -> address
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
      result.errors.push(`Failed to fetch whitelist: ${err}`);
    }

    // ================================================================
    // 1. Fetch all on-chain events in parallel
    // ================================================================
    const logParams = {
      address: CONTRACT_ADDRESS,
      fromBlock,
      ...(toBlock ? { toBlock } : {}),
    };

    const [placedLogs, filledLogs, cancelledLogs, proceedsLogs] = await Promise.all([
      client.getLogs({ ...logParams, event: ORDER_PLACED_EVENT as any }).catch((err) => {
        result.errors.push(`OrderPlaced fetch failed: ${err}`);
        return [] as any[];
      }),
      client.getLogs({ ...logParams, event: ORDER_FILLED_EVENT as any }).catch((err) => {
        result.errors.push(`OrderFilled fetch failed: ${err}`);
        return [] as any[];
      }),
      client.getLogs({ ...logParams, event: ORDER_CANCELLED_EVENT as any }).catch((err) => {
        result.errors.push(`OrderCancelled fetch failed: ${err}`);
        return [] as any[];
      }),
      client.getLogs({ ...logParams, event: ORDER_PROCEEDS_COLLECTED_EVENT as any }).catch((err) => {
        result.errors.push(`OrderProceedsCollected fetch failed: ${err}`);
        return [] as any[];
      }),
    ]);

    // ================================================================
    // 2. Collect all unique wallet addresses and ensure they exist
    // ================================================================
    const allWallets = new Set<string>();
    for (const log of placedLogs) {
      if (log.args.user) allWallets.add((log.args.user as string).toLowerCase());
    }
    for (const log of filledLogs) {
      if (log.args.buyer) allWallets.add((log.args.buyer as string).toLowerCase());
    }
    for (const log of cancelledLogs) {
      if (log.args.user) allWallets.add((log.args.user as string).toLowerCase());
    }
    for (const log of proceedsLogs) {
      if (log.args.user) allWallets.add((log.args.user as string).toLowerCase());
    }

    // Batch upsert all users
    for (const wallet of allWallets) {
      const { error } = await supabase
        .from('users')
        .upsert({ wallet_address: wallet }, { onConflict: 'wallet_address', ignoreDuplicates: true });
      if (!error) result.users_created++;
      else result.errors.push(`User upsert failed for ${wallet}: ${error.message}`);
    }

    // ================================================================
    // 3. Build order metadata map from OrderPlaced events
    // ================================================================
    // We need block timestamps. Batch unique blocks to minimize RPC calls.
    const uniqueBlocks = new Set<bigint>();
    for (const log of [...placedLogs, ...filledLogs, ...cancelledLogs, ...proceedsLogs]) {
      uniqueBlocks.add(log.blockNumber);
    }

    const blockTimestamps = new Map<bigint, number>();
    const blockArray = Array.from(uniqueBlocks);
    // Fetch in batches of 20
    for (let i = 0; i < blockArray.length; i += 20) {
      const batch = blockArray.slice(i, i + 20);
      const results = await Promise.all(
        batch.map((bn) =>
          client.getBlock({ blockNumber: bn }).catch(() => null)
        )
      );
      for (let j = 0; j < results.length; j++) {
        const block = results[j];
        if (block) {
          blockTimestamps.set(batch[j], Number(block.timestamp));
        }
      }
    }

    // Map orderId -> { owner, sellToken, sellAmount, timestamp, blockNumber }
    interface OrderMeta {
      owner: string;
      sellToken: string;
      sellTicker: string;
      sellAmount: bigint;
      timestamp: number;
      blockNumber: bigint;
    }
    const orderMap = new Map<string, OrderMeta>();

    // ================================================================
    // 3b. Batch-fetch full order details from the contract
    // ================================================================
    interface OnChainOrderDetails {
      orderID: bigint;
      remainingSellAmount: bigint;
      redeemedSellAmount: bigint;
      status: number;
      orderDetails: {
        sellToken: string;
        sellAmount: bigint;
        buyTokensIndex: bigint[];
        buyAmounts: bigint[];
        expirationTime: bigint;
        allOrNothing: boolean;
      };
    }
    const onChainOrderMap = new Map<string, OnChainOrderDetails>();

    // Collect all unique order IDs from all events
    const allOrderIds = new Set<string>();
    for (const log of placedLogs) {
      const oid = log.args.orderID?.toString();
      if (oid) allOrderIds.add(oid);
    }
    for (const log of filledLogs) {
      const oid = log.args.orderID?.toString();
      if (oid) allOrderIds.add(oid);
    }
    for (const log of cancelledLogs) {
      const oid = log.args.orderID?.toString();
      if (oid) allOrderIds.add(oid);
    }
    for (const log of proceedsLogs) {
      const oid = log.args.orderID?.toString();
      if (oid) allOrderIds.add(oid);
    }

    // Fetch order details in batches of 10
    const orderIdArray = Array.from(allOrderIds);
    for (let i = 0; i < orderIdArray.length; i += 10) {
      const batch = orderIdArray.slice(i, i + 10);
      const batchResults = await Promise.all(
        batch.map((oid) =>
          client
            .readContract({
              address: CONTRACT_ADDRESS,
              abi: CONTRACT_ABI,
              functionName: 'getOrderDetails',
              args: [BigInt(oid)],
            })
            .then((res: any) => ({ oid, data: res }))
            .catch(() => ({ oid, data: null }))
        )
      );
      for (const { oid, data } of batchResults) {
        if (data) {
          try {
            const details = data.orderDetailsWithID || data;
            onChainOrderMap.set(oid, {
              orderID: details.orderID ?? BigInt(oid),
              remainingSellAmount: details.remainingSellAmount ?? 0n,
              redeemedSellAmount: details.redeemedSellAmount ?? 0n,
              status: Number(details.status ?? 0),
              orderDetails: {
                sellToken: String(details.orderDetails?.sellToken || ''),
                sellAmount: details.orderDetails?.sellAmount ?? 0n,
                buyTokensIndex: (details.orderDetails?.buyTokensIndex || []).map((x: any) => BigInt(x)),
                buyAmounts: (details.orderDetails?.buyAmounts || []).map((x: any) => BigInt(x)),
                expirationTime: details.orderDetails?.expirationTime ?? 0n,
                allOrNothing: Boolean(details.orderDetails?.allOrNothing),
              },
            });
          } catch (err) {
            result.errors.push(`Failed to parse order details for ${oid}: ${err}`);
          }
        }
      }
      // Small delay between batches
      if (i + 10 < orderIdArray.length) {
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
    }

    // ================================================================
    // 4. Process OrderPlaced events -> record order_created + wallet_connected + orders table
    // ================================================================
    const connectedWallets = new Set<string>();

    for (const log of placedLogs) {
      const owner = (log.args.user as string).toLowerCase();
      const orderId = log.args.orderID?.toString();
      const sellToken = (log.args.sellToken as string).toLowerCase();
      const sellAmount = log.args.sellAmount as bigint;
      const timestamp = blockTimestamps.get(log.blockNumber) || 0;

      if (!orderId) continue;

      orderMap.set(orderId, {
        owner,
        sellToken,
        sellTicker: getTokenTicker(sellToken),
        sellAmount,
        timestamp,
        blockNumber: log.blockNumber,
      });

      // Record wallet_connected (first time we see this wallet)
      if (!connectedWallets.has(owner)) {
        connectedWallets.add(owner);
        await recordEvent(owner, 'wallet_connected', {}, 0, result, timestamp);
      }

      // Record order_created event
      const sellDecimals = getTokenDecimals(sellToken);
      await recordEvent(
        owner,
        'order_created',
        {
          order_id: Number(orderId),
          sell_token: getTokenTicker(sellToken),
          sell_amount: formatAmount(sellAmount, sellDecimals).toString(),
          tx_hash: log.transactionHash,
        },
        EVENT_XP.order_created,
        result,
        timestamp
      );
      result.orders_placed++;

      // Write to orders table
      try {
        const onChain = onChainOrderMap.get(orderId);
        const buyTokensIndices = onChain?.orderDetails.buyTokensIndex || [];
        const buyAmounts = onChain?.orderDetails.buyAmounts || [];
        const buyAddresses = buyTokensIndices.map((idx) => whitelist[Number(idx)] || '');
        const buyTickers = buyAddresses.map((addr) => (addr ? getTokenTicker(addr) : 'UNKNOWN'));
        const buyAmountsRaw = buyAmounts.map((a) => a.toString());
        const buyAmountsFormatted = buyAmounts.map((a, i) => {
          const addr = buyAddresses[i];
          const decimals = addr ? getTokenDecimals(addr) : 18;
          return formatAmount(a, decimals);
        });

        const orderStatus = onChain ? onChain.status : 0;
        const fillPct = onChain
          ? (() => {
              const total = onChain.orderDetails.sellAmount;
              const redeemed = onChain.redeemedSellAmount;
              if (total === 0n) return 0;
              return Number((redeemed * 10000n) / total) / 100;
            })()
          : 0;

        const { error: orderErr } = await supabase.from('orders').upsert(
          {
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
            remaining_sell_amount: onChain?.remainingSellAmount.toString() || sellAmount.toString(),
            redeemed_sell_amount: onChain?.redeemedSellAmount.toString() || '0',
            is_all_or_nothing: onChain?.orderDetails.allOrNothing || false,
            expiration: Number(onChain?.orderDetails.expirationTime || 0n),
            creation_tx_hash: log.transactionHash,
            creation_block_number: Number(log.blockNumber),
            created_at: timestamp ? new Date(timestamp * 1000).toISOString() : new Date().toISOString(),
          },
          { onConflict: 'order_id' }
        );
        if (!orderErr) {
          result.orders_table_written++;
        } else {
          result.errors.push(`Orders table upsert failed for order ${orderId}: ${orderErr.message}`);
        }
      } catch (err) {
        result.errors.push(`Orders table write failed for order ${orderId}: ${err}`);
      }
    }

    // ================================================================
    // 5. Process OrderFilled events -> record order_filled + trade_completed
    // ================================================================
    for (const log of filledLogs) {
      const buyer = (log.args.buyer as string).toLowerCase();
      const orderId = log.args.orderID?.toString();
      const buyTokenIndex = log.args.buyTokenIndex !== undefined ? Number(log.args.buyTokenIndex) : -1;
      const buyAmount = log.args.buyAmount as bigint;
      const timestamp = blockTimestamps.get(log.blockNumber) || 0;

      if (!orderId) continue;

      // Record wallet_connected for filler too
      if (!connectedWallets.has(buyer)) {
        connectedWallets.add(buyer);
        await recordEvent(buyer, 'wallet_connected', {}, 0, result, timestamp);
      }

      // Resolve buy token
      const buyTokenAddress = whitelist[buyTokenIndex] || '';
      const buyTicker = buyTokenAddress ? getTokenTicker(buyTokenAddress) : 'UNKNOWN';
      const buyDecimals = buyTokenAddress ? getTokenDecimals(buyTokenAddress) : 18;

      // Record order_filled for the filler
      const orderMeta = orderMap.get(orderId);
      const fillTimeSec = orderMeta ? Math.max(0, timestamp - orderMeta.timestamp) : undefined;

      await recordEvent(
        buyer,
        'order_filled',
        {
          order_id: Number(orderId),
          buy_token_used: buyTicker,
          fill_amount: formatAmount(buyAmount, buyDecimals).toString(),
          fill_percentage: 0, // Can't determine from event alone
          fill_time_seconds: fillTimeSec,
          tx_hash: log.transactionHash,
        },
        EVENT_XP.order_filled,
        result,
        timestamp
      );

      // Record trade_completed for the filler (they are the buyer)
      if (orderMeta) {
        await recordEvent(
          buyer,
          'trade_completed',
          {
            order_id: Number(orderId),
            sell_token: orderMeta.sellTicker,
            buy_token: buyTicker,
            sell_amount: '0',
            buy_amount: formatAmount(buyAmount, buyDecimals).toString(),
            volume_usd: 0,
            is_maker: false,
            filler_wallet: buyer,
            tx_hash: log.transactionHash,
          },
          EVENT_XP.trade_completed,
          result,
          timestamp
        );
      }

      // Also record trade_completed for the order owner (maker side)
      if (orderMeta) {
        await recordEvent(
          orderMeta.owner,
          'trade_completed',
          {
            order_id: Number(orderId),
            sell_token: orderMeta.sellTicker,
            buy_token: buyTicker,
            sell_amount: '0',
            buy_amount: formatAmount(buyAmount, buyDecimals).toString(),
            volume_usd: 0,
            is_maker: true,
            filler_wallet: buyer,
            tx_hash: log.transactionHash,
          },
          EVENT_XP.trade_completed,
          result,
          timestamp
        );
      }

      // Write to order_fills table
      try {
        const buyDecimals2 = buyTokenAddress ? getTokenDecimals(buyTokenAddress) : 18;
        const { error: fillErr } = await supabase.from('order_fills').insert({
          order_id: Number(orderId),
          filler_address: buyer,
          buy_token_index: buyTokenIndex,
          buy_token_address: buyTokenAddress || '',
          buy_token_ticker: buyTicker,
          buy_amount_raw: buyAmount.toString(),
          buy_amount_formatted: formatAmount(buyAmount, buyDecimals2),
          volume_usd: 0, // USD values not available from events alone
          tx_hash: log.transactionHash,
          block_number: Number(log.blockNumber),
          filled_at: timestamp ? new Date(timestamp * 1000).toISOString() : new Date().toISOString(),
        });
        if (!fillErr) {
          result.fills_table_written++;
        } else if (fillErr.code !== '23505') {
          // Ignore unique constraint violations (duplicates)
          result.errors.push(`Fills table insert failed for order ${orderId}: ${fillErr.message}`);
        }
      } catch (err) {
        result.errors.push(`Fills table write failed for order ${orderId}: ${err}`);
      }

      result.orders_filled++;
    }

    // Update order fill counts from the fills we just inserted
    for (const oid of allOrderIds) {
      try {
        const { data: fillCount } = await supabase
          .from('order_fills')
          .select('filler_address', { count: 'exact' })
          .eq('order_id', Number(oid));

        const uniqueFillers = new Set(fillCount?.map((f) => f.filler_address) || []).size;

        await supabase
          .from('orders')
          .update({
            total_fills: fillCount?.length || 0,
            unique_fillers: uniqueFillers,
            updated_at: new Date().toISOString(),
          })
          .eq('order_id', Number(oid));
      } catch {
        // Non-critical - skip
      }
    }

    // ================================================================
    // 6. Process OrderCancelled events -> record order_cancelled
    // ================================================================
    for (const log of cancelledLogs) {
      const user = (log.args.user as string).toLowerCase();
      const orderId = log.args.orderID?.toString();
      const timestamp = blockTimestamps.get(log.blockNumber) || 0;

      if (!orderId) continue;

      const orderMeta = orderMap.get(orderId);
      const timeSinceCreation = orderMeta ? Math.max(0, timestamp - orderMeta.timestamp) : undefined;

      await recordEvent(
        user,
        'order_cancelled',
        {
          order_id: Number(orderId),
          time_since_creation_seconds: timeSinceCreation,
          tx_hash: log.transactionHash,
        },
        EVENT_XP.order_cancelled,
        result,
        timestamp
      );
      // Write to order_cancellations table
      try {
        const onChain = onChainOrderMap.get(orderId);
        const fillPctAtCancel = onChain
          ? (() => {
              const total = onChain.orderDetails.sellAmount;
              const redeemed = onChain.redeemedSellAmount;
              if (total === 0n) return 0;
              return Number((redeemed * 10000n) / total) / 100;
            })()
          : 0;

        const { error: cancelErr } = await supabase.from('order_cancellations').insert({
          order_id: Number(orderId),
          cancelled_by: user,
          fill_percentage_at_cancel: fillPctAtCancel,
          time_since_creation_seconds: timeSinceCreation || 0,
          tx_hash: log.transactionHash,
          block_number: Number(log.blockNumber),
          cancelled_at: timestamp ? new Date(timestamp * 1000).toISOString() : new Date().toISOString(),
        });
        if (!cancelErr) {
          result.cancellations_table_written++;
        } else if (cancelErr.code !== '23505') {
          result.errors.push(`Cancellations table insert failed for order ${orderId}: ${cancelErr.message}`);
        }
      } catch (err) {
        result.errors.push(`Cancellations table write failed for order ${orderId}: ${err}`);
      }

      // Update order status in orders table
      try {
        await supabase
          .from('orders')
          .update({ status: 1, updated_at: new Date().toISOString() })
          .eq('order_id', Number(orderId));
      } catch {
        // Non-critical
      }

      result.orders_cancelled++;
    }

    // ================================================================
    // 7. Process OrderProceedsCollected events -> record proceeds_claimed
    // ================================================================
    for (const log of proceedsLogs) {
      const user = (log.args.user as string).toLowerCase();
      const orderId = log.args.orderID?.toString();
      const timestamp = blockTimestamps.get(log.blockNumber) || 0;

      if (!orderId) continue;

      await recordEvent(
        user,
        'proceeds_claimed',
        {
          order_id: Number(orderId),
          tx_hash: log.transactionHash,
        },
        EVENT_XP.proceeds_claimed,
        result,
        timestamp
      );
      // Write to order_proceeds table
      try {
        const { error: proceedsErr } = await supabase.from('order_proceeds').insert({
          order_id: Number(orderId),
          claimed_by: user,
          tx_hash: log.transactionHash,
          block_number: Number(log.blockNumber),
          claimed_at: timestamp ? new Date(timestamp * 1000).toISOString() : new Date().toISOString(),
        });
        if (!proceedsErr) {
          result.proceeds_table_written++;
        } else if (proceedsErr.code !== '23505') {
          result.errors.push(`Proceeds table insert failed for order ${orderId}: ${proceedsErr.message}`);
        }
      } catch (err) {
        result.errors.push(`Proceeds table write failed for order ${orderId}: ${err}`);
      }

      result.proceeds_collected++;
    }

    // ================================================================
    // 8. Recalculate aggregate stats for all users
    // ================================================================
    for (const wallet of allWallets) {
      await recalculateUserStats(wallet, result);
    }

    // ================================================================
    // 9. Evaluate challenges for all users
    // ================================================================
    for (const wallet of allWallets) {
      await evaluateChallengesForUser(wallet, result);
    }

    return NextResponse.json({
      success: true,
      data: result,
      summary: {
        wallets_found: allWallets.size,
        blocks_scanned: `${fromBlock} to ${toBlock || 'latest'}`,
        total_events: placedLogs.length + filledLogs.length + cancelledLogs.length + proceedsLogs.length,
      },
    });
  } catch (error) {
    console.error('Backfill error:', error);
    return NextResponse.json(
      { success: false, error: `Backfill failed: ${error}` },
      { status: 500 }
    );
  }
}

// Record a single event to Supabase (idempotent via tx_hash check)
async function recordEvent(
  walletAddress: string,
  eventType: string,
  eventData: Record<string, unknown>,
  xpAwarded: number,
  result: BackfillResult,
  blockTimestamp?: number
) {
  try {
    // Skip duplicate events based on tx_hash + event_type + wallet (best effort dedup)
    if (eventData.tx_hash) {
      const { data: existing } = await supabase
        .from('user_events')
        .select('id')
        .eq('wallet_address', walletAddress)
        .eq('event_type', eventType)
        .contains('event_data', { tx_hash: eventData.tx_hash })
        .limit(1)
        .maybeSingle();

      if (existing) return; // Already recorded
    }

    // Use block timestamp if provided, otherwise current time
    const createdAt = blockTimestamp
      ? new Date(blockTimestamp * 1000).toISOString()
      : new Date().toISOString();

    // Insert directly with the correct timestamp
    await supabase.from('user_events').insert({
      wallet_address: walletAddress,
      event_type: eventType,
      event_data: eventData,
      xp_awarded: xpAwarded,
      created_at: createdAt,
    });

    result.events_recorded++;
  } catch (err) {
    result.errors.push(`Event record failed for ${walletAddress}/${eventType}: ${err}`);
  }
}

// Recalculate aggregate stats from event history
async function recalculateUserStats(walletAddress: string, result: BackfillResult) {
  try {
    // Count events by type - include event_data for detailed stats
    const { data: eventCounts } = await supabase
      .from('user_events')
      .select('event_type, xp_awarded, event_data, created_at')
      .eq('wallet_address', walletAddress);

    if (!eventCounts) return;

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

    for (const event of eventCounts) {
      totalXp += event.xp_awarded || 0;
      const data = event.event_data as Record<string, any> | null;

      switch (event.event_type) {
        case 'order_created':
          ordersCreated++;
          break;
        case 'order_filled':
          ordersFilled++;
          // The filler is giving a fill
          fillsGiven++;
          break;
        case 'order_cancelled':
          ordersCancelled++;
          break;
        case 'trade_completed': {
          totalTrades++;
          const vol = parseFloat(data?.volume_usd || '0') || 0;
          totalVolumeUsd += vol;
          if (data?.is_maker) {
            totalVolumeAsMaker += vol;
            fillsReceived++;
          } else {
            totalVolumeAsTaker += vol;
          }
          // Track unique tokens
          if (data?.sell_token) uniqueTokens.add(data.sell_token.toUpperCase());
          if (data?.buy_token) uniqueTokens.add(data.buy_token.toUpperCase());
          // Track first trade date
          if (!firstTradeDate || event.created_at < firstTradeDate) {
            firstTradeDate = event.created_at;
          }
          break;
        }
        case 'proceeds_claimed':
          proceedsClaims++;
          break;
      }
    }

    // Get XP from completed challenges too
    const { data: challengeXp } = await supabase
      .from('completed_challenges')
      .select('xp_awarded')
      .eq('wallet_address', walletAddress);

    const challengeXpTotal = challengeXp?.reduce((sum, c) => sum + (c.xp_awarded || 0), 0) || 0;

    // Query orders table for accurate current_active_orders count
    // Only count orders that are status 0 (active) AND not expired (expiration 0 means no expiry, or expiration > now)
    const nowUnix = Math.floor(Date.now() / 1000);
    const { count: activeOrdersCount } = await supabase
      .from('orders')
      .select('*', { count: 'exact', head: true })
      .eq('maker_address', walletAddress)
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
      unique_tokens_traded: uniqueTokens.size,
      current_active_orders: activeOrdersCount || 0,
      updated_at: new Date().toISOString(),
    };

    if (firstTradeDate) {
      updateData.first_trade_date = firstTradeDate.split('T')[0]; // DATE type
    }

    // Count proceeds_claimed for the separate total_proceeds_claimed column
    updateData.total_proceeds_claimed = proceedsClaims;

    await supabase
      .from('users')
      .update(updateData)
      .eq('wallet_address', walletAddress);
  } catch (err) {
    result.errors.push(`Stats recalc failed for ${walletAddress}: ${err}`);
  }
}

// Evaluate all challenges for a user based on their current stats
async function evaluateChallengesForUser(walletAddress: string, result: BackfillResult) {
  try {
    const { data: userStats } = await supabase
      .from('users')
      .select('*')
      .eq('wallet_address', walletAddress)
      .single();

    if (!userStats) return;

    const { data: existingChallenges } = await supabase
      .from('completed_challenges')
      .select('challenge_name, prestige_level')
      .eq('wallet_address', walletAddress);

    const completedSet = new Set(
      existingChallenges?.map((c) => `${c.prestige_level}-${c.challenge_name}`) || []
    );

    const tryComplete = async (
      prestigeLevel: number,
      challengeName: string,
      category: string,
      xp: number,
      condition: boolean
    ) => {
      const key = `${prestigeLevel}-${challengeName}`;
      if (!condition || completedSet.has(key)) return;
      completedSet.add(key);

      await supabase.rpc('complete_challenge', {
        p_wallet_address: walletAddress,
        p_prestige_level: prestigeLevel,
        p_challenge_name: challengeName,
        p_category: category,
        p_xp_awarded: xp,
      });
    };

    const stats = userStats as {
      total_orders_created: number;
      total_orders_filled: number;
      total_trades: number;
      total_volume_usd: number;
      current_active_orders: number;
      current_streak_days: number;
    };

    // The user has interacted with the contract, so they connected their wallet
    await tryComplete(0, 'First Steps', 'bootcamp', 50, true);

    // Order creation milestones
    await Promise.all([
      tryComplete(0, 'First Order', 'operations', 250, stats.total_orders_created >= 1),
      tryComplete(1, 'Getting Comfortable', 'operations', 400, stats.total_orders_created >= 5),
      tryComplete(3, 'Order Machine', 'operations', 800, stats.total_orders_created >= 25),
      tryComplete(4, 'Order Veteran', 'operations', 1200, stats.total_orders_created >= 50),
      tryComplete(5, 'Order Legend', 'operations', 2500, stats.total_orders_created >= 100),
      tryComplete(7, 'Order God', 'operations', 8000, stats.total_orders_created >= 500),
      tryComplete(8, 'Order Immortal', 'operations', 20000, stats.total_orders_created >= 1000),
    ]);

    // Order fill milestones
    await Promise.all([
      tryComplete(0, 'First Fill', 'operations', 250, stats.total_orders_filled >= 1),
      tryComplete(1, 'Active Buyer', 'operations', 400, stats.total_orders_filled >= 5),
      tryComplete(3, 'Fill Expert', 'operations', 800, stats.total_orders_filled >= 25),
      tryComplete(6, 'Fill Master', 'operations', 5000, stats.total_orders_filled >= 200),
    ]);

    // Trade milestones
    await Promise.all([
      tryComplete(2, 'Active Trader', 'operations', 500, stats.total_trades >= 10),
      tryComplete(4, 'Veteran Trader', 'operations', 1500, stats.total_trades >= 50),
      tryComplete(5, 'Century Trader', 'operations', 3000, stats.total_trades >= 100),
      tryComplete(7, 'Trade Machine', 'operations', 10000, stats.total_trades >= 500),
      tryComplete(8, 'Trade Legend', 'operations', 25000, stats.total_trades >= 1000),
    ]);

    // Volume milestones
    await Promise.all([
      tryComplete(1, 'Volume Starter', 'elite', 500, stats.total_volume_usd >= 500),
      tryComplete(2, 'Volume Builder', 'elite', 750, stats.total_volume_usd >= 1000),
      tryComplete(4, 'Volume Veteran', 'elite', 2000, stats.total_volume_usd >= 10000),
      tryComplete(6, 'Volume King', 'elite', 8000, stats.total_volume_usd >= 100000),
      tryComplete(8, 'Volume God', 'elite', 50000, stats.total_volume_usd >= 1000000),
    ]);

    // Token diversity challenges + new challenges - check from trade events
    const { data: tradeEvents } = await supabase
      .from('user_events')
      .select('event_data, created_at')
      .eq('wallet_address', walletAddress)
      .eq('event_type', 'trade_completed');

    if (tradeEvents && tradeEvents.length > 0) {
      const uniqueTokens = new Set<string>();
      let tradedMaxi = false;
      let tradedWe = false;
      let totalHexTraded = 0;
      let totalPlsTraded = 0;
      let totalStableTraded = 0;
      let pennyTradeCount = 0;
      const stableTokens = new Set(['DAI', 'USDC', 'USDT', 'USDL', 'WEDAI', 'WEUSDC', 'WEUSDT', 'PXDC', 'HEXDC']);

      // Weekend Warrior tracking
      const tradeDays = new Set<number>();
      // Multi-Fill tracking
      const orderFillers = new Map<string, Set<string>>();
      // Clean Sweep / AON Champion tracking
      const completedMakerOrders = new Set<string>();
      const completedAonOrders = new Set<string>();
      // Full House tracking
      const partiallyFilledMakerOrders = new Set<string>();

      tradeEvents.forEach((event) => {
        const data = event.event_data as {
          sell_token?: string; buy_token?: string;
          sell_amount?: number; buy_amount?: number;
          volume_usd?: number; is_maker?: boolean;
          order_id?: number; is_all_or_nothing?: boolean;
          order_completed?: boolean; filler_wallet?: string;
        };

        // Track day of week for Weekend Warrior
        const tradeTime = new Date(event.created_at);
        tradeDays.add(tradeTime.getUTCDay());

        // Penny trades
        if (data.volume_usd !== undefined && data.volume_usd > 0 && data.volume_usd < 1) pennyTradeCount++;

        // Clean Sweep / AON / Full House / Multi-Fill
        if (data.is_maker && data.order_id !== undefined) {
          if (data.order_completed) {
            completedMakerOrders.add(String(data.order_id));
            if (data.is_all_or_nothing) completedAonOrders.add(String(data.order_id));
          } else {
            partiallyFilledMakerOrders.add(String(data.order_id));
          }
          if (data.filler_wallet) {
            const oid = String(data.order_id);
            if (!orderFillers.has(oid)) orderFillers.set(oid, new Set());
            orderFillers.get(oid)!.add(data.filler_wallet.toLowerCase());
          }
        }

        for (const token of [data.sell_token, data.buy_token]) {
          if (!token) continue;
          const upper = token.toUpperCase();
          uniqueTokens.add(upper);
          if (upper === 'HEX') totalHexTraded += data.sell_amount || data.buy_amount || 0;
          if (upper === 'PLS' || upper === 'WPLS') totalPlsTraded += data.sell_amount || data.buy_amount || 0;
          if (stableTokens.has(upper)) totalStableTraded += data.sell_amount || data.buy_amount || 0;
          if (upper.includes('MAXI')) tradedMaxi = true;
          if (upper.startsWith('WE')) tradedWe = true;
        }
      });

      let maxFillers = 0;
      for (const fillers of orderFillers.values()) {
        maxFillers = Math.max(maxFillers, fillers.size);
      }

      const count = uniqueTokens.size;
      await Promise.all([
        // Token diversity
        tryComplete(2, 'Multi-Token Beginner', 'bootcamp', 300, count >= 5),
        tryComplete(3, 'Token Diversity', 'bootcamp', 500, count >= 10),
        tryComplete(4, 'Token Collector', 'bootcamp', 800, count >= 20),
        tryComplete(5, 'Diversified', 'bootcamp', 1200, count >= 30),
        tryComplete(6, 'Token Master', 'bootcamp', 2000, count >= 40),
        tryComplete(7, 'Token Legend', 'bootcamp', 3000, count >= 50),
        tryComplete(8, 'Token God', 'bootcamp', 5000, count >= 75),
        tryComplete(7, 'MAXI Maxi', 'bootcamp', 2000, tradedMaxi),
        tryComplete(6, 'Ethereum Maxi', 'bootcamp', 1500, tradedWe),

        // Token volume barons
        tryComplete(5, 'HEX Baron', 'elite', 3000, totalHexTraded >= 1000000),
        tryComplete(6, 'PLS Baron', 'elite', 3000, totalPlsTraded >= 10000000),
        tryComplete(7, 'Stablecoin Baron', 'elite', 5000, totalStableTraded >= 100000),

        // Weekend Warrior
        tryComplete(1, 'Weekend Warrior', 'operations', 300, tradeDays.has(0) && tradeDays.has(6)),

        // Perfect Record
        tryComplete(4, 'Perfect Record', 'operations', 1500, stats.total_trades >= 10 && (stats as any).total_orders_cancelled === 0),

        // Clean Sweep
        tryComplete(3, 'Clean Sweep', 'operations', 800, completedMakerOrders.size >= 5),

        // AON Champion
        tryComplete(5, 'AON Champion', 'operations', 2500, completedAonOrders.size >= 3),

        // Multi-Fill
        tryComplete(6, 'Multi-Fill', 'operations', 3000, maxFillers >= 5),

        // Full House
        tryComplete(7, 'Full House', 'operations', 5000, partiallyFilledMakerOrders.size >= 3),

        // Penny Pincher
        tryComplete(4, 'Penny Pincher', 'wildcard', 200, pennyTradeCount >= 10),
      ]);
    }

    // Order-based token-specific challenges (HTT, COM, pDAI)
    const { data: orderEvents } = await supabase
      .from('user_events')
      .select('event_data')
      .eq('wallet_address', walletAddress)
      .eq('event_type', 'order_created');

    if (orderEvents && orderEvents.length > 0) {
      let hasHTT = false;
      let hasCOM = false;
      let hasPDAI = false;
      let hasAboveMarketOrder = false;
      let hasBelowMarketOrder = false;

      orderEvents.forEach((event) => {
        const data = event.event_data as {
          sell_token?: string;
          buy_tokens?: string[];
          price_vs_market_percent?: number;
        };

        const sellToken = data.sell_token?.toUpperCase() || '';
        const buyTokens = data.buy_tokens?.map(t => t.toUpperCase()) || [];
        const priceVsMarket = data.price_vs_market_percent || 0;

        if (sellToken === 'HTT' || buyTokens.includes('HTT')) hasHTT = true;
        if (sellToken === 'COM' || buyTokens.includes('COM')) hasCOM = true;
        if (sellToken === 'PDAI' || sellToken === 'DAI' || buyTokens.includes('PDAI') || buyTokens.includes('DAI')) hasPDAI = true;
        if (priceVsMarket > 0) hasAboveMarketOrder = true;
        if (priceVsMarket <= -50) hasBelowMarketOrder = true;
      });

      await Promise.all([
        tryComplete(7, 'Bond Trader', 'bootcamp', 2000, hasHTT),
        tryComplete(7, 'Coupon Clipper', 'bootcamp', 2000, hasCOM),
        tryComplete(7, '$1 Inevitable', 'bootcamp', 2000, hasPDAI),
        tryComplete(5, 'Fatfinger', 'wildcard', 150, hasAboveMarketOrder),
        tryComplete(5, 'Dip Catcher', 'wildcard', 150, hasBelowMarketOrder),
      ]);
    }

    // Proceeds claimed challenges
    const { data: claimEvents } = await supabase
      .from('user_events')
      .select('event_data, created_at')
      .eq('wallet_address', walletAddress)
      .eq('event_type', 'proceeds_claimed');

    if (claimEvents && claimEvents.length > 0) {
      const totalClaims = claimEvents.length;
      const uniqueOrdersClaimed = new Set(
        claimEvents.map((e) => String((e.event_data as { order_id?: number }).order_id)).filter(Boolean)
      ).size;

      // Iron Hands / Diamond Hands: check order age for each claimed order
      let maxOrderAgeDays = 0;
      for (const claim of claimEvents) {
        const oid = (claim.event_data as { order_id?: number }).order_id;
        if (oid === undefined) continue;
        const { data: orderCreation } = await supabase
          .from('user_events')
          .select('created_at')
          .eq('wallet_address', walletAddress)
          .eq('event_type', 'order_created')
          .contains('event_data', { order_id: oid })
          .limit(1)
          .maybeSingle();
        if (orderCreation) {
          const ageDays = Math.floor(
            (new Date(claim.created_at).getTime() - new Date(orderCreation.created_at).getTime()) / (1000 * 60 * 60 * 24)
          );
          maxOrderAgeDays = Math.max(maxOrderAgeDays, ageDays);
        }
      }

      await Promise.all([
        tryComplete(3, 'The Collector', 'operations', 600, uniqueOrdersClaimed >= 10),
        tryComplete(5, 'Claim Machine', 'operations', 2000, totalClaims >= 50),
        tryComplete(7, 'Profit Master', 'elite', 12000, totalClaims >= 100),
        tryComplete(4, 'Iron Hands', 'elite', 1500, maxOrderAgeDays >= 30),
        tryComplete(6, 'Diamond Hands', 'elite', 5000, maxOrderAgeDays >= 90),
      ]);
    }

    // Ghost Town: count expired orders with 0 fills
    const { data: expiredEvents } = await supabase
      .from('user_events')
      .select('event_data')
      .eq('wallet_address', walletAddress)
      .eq('event_type', 'order_expired');

    if (expiredEvents) {
      const ghostCount = expiredEvents.filter((e) => {
        const d = e.event_data as { fill_percentage?: number };
        return (d.fill_percentage || 0) === 0;
      }).length;
      await tryComplete(5, 'Ghost Town', 'wildcard', 200, ghostCount >= 5);
    }

    // Recalculate total XP after all challenges are evaluated
    const { data: allChallenges } = await supabase
      .from('completed_challenges')
      .select('xp_awarded')
      .eq('wallet_address', walletAddress);

    const { data: allEvents } = await supabase
      .from('user_events')
      .select('xp_awarded')
      .eq('wallet_address', walletAddress);

    const challengeXp = allChallenges?.reduce((s, c) => s + (c.xp_awarded || 0), 0) || 0;
    const eventXp = allEvents?.reduce((s, e) => s + (e.xp_awarded || 0), 0) || 0;

    await supabase
      .from('users')
      .update({ total_xp: challengeXp + eventXp, updated_at: new Date().toISOString() })
      .eq('wallet_address', walletAddress);
  } catch (err) {
    result.errors.push(`Challenge eval failed for ${walletAddress}: ${err}`);
  }
}
