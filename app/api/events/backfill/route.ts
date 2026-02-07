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

// Event ABIs matching what the stats page uses
const ORDER_PLACED_EVENT = parseAbiItem(
  'event OrderPlaced(address indexed user, uint256 indexed orderID, address indexed sellToken, uint256 sellAmount)'
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

// XP values (same as track/route.ts)
const EVENT_XP: Record<string, number> = {
  order_created: 10,
  order_filled: 10,
  order_cancelled: 0,
  proceeds_claimed: 5,
  trade_completed: 25,
  wallet_connected: 0,
};

interface BackfillResult {
  users_created: number;
  events_recorded: number;
  orders_placed: number;
  orders_filled: number;
  orders_cancelled: number;
  proceeds_collected: number;
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
      errors: [],
    };

    // Fetch the whitelist from the contract so we can resolve buyTokenIndex -> address
    let whitelist: string[] = [];
    try {
      const CONTRACT_ABI = (await import('@/config/abis')).CONTRACT_ABI;
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
    // 4. Process OrderPlaced events -> record order_created + wallet_connected
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
        await recordEvent(owner, 'wallet_connected', {}, 0, result);
      }

      // Record order_created
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
        result
      );
      result.orders_placed++;
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
        await recordEvent(buyer, 'wallet_connected', {}, 0, result);
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
        result
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
            sell_amount: '0', // Filler receives sell tokens, but we don't know exact portion
            buy_amount: formatAmount(buyAmount, buyDecimals).toString(),
            volume_usd: 0, // Can't reliably get historical USD price in backfill
            is_maker: false,
          },
          EVENT_XP.trade_completed,
          result
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
          },
          EVENT_XP.trade_completed,
          result
        );
      }

      result.orders_filled++;
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
        result
      );
      result.orders_cancelled++;
    }

    // ================================================================
    // 7. Process OrderProceedsCollected events -> record proceeds_claimed
    // ================================================================
    for (const log of proceedsLogs) {
      const user = (log.args.user as string).toLowerCase();
      const orderId = log.args.orderID?.toString();

      if (!orderId) continue;

      await recordEvent(
        user,
        'proceeds_claimed',
        {
          order_id: Number(orderId),
          tx_hash: log.transactionHash,
        },
        EVENT_XP.proceeds_claimed,
        result
      );
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
  result: BackfillResult
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

    const { error } = await supabase.rpc('record_user_event', {
      p_wallet_address: walletAddress,
      p_event_type: eventType,
      p_event_data: eventData,
      p_xp_awarded: xpAwarded,
    });

    if (error) {
      // Fallback: direct insert
      await supabase.from('user_events').insert({
        wallet_address: walletAddress,
        event_type: eventType,
        event_data: eventData,
        xp_awarded: xpAwarded,
      });
    }

    result.events_recorded++;
  } catch (err) {
    result.errors.push(`Event record failed for ${walletAddress}/${eventType}: ${err}`);
  }
}

// Recalculate aggregate stats from event history
async function recalculateUserStats(walletAddress: string, result: BackfillResult) {
  try {
    // Count events by type
    const { data: eventCounts } = await supabase
      .from('user_events')
      .select('event_type, xp_awarded')
      .eq('wallet_address', walletAddress);

    if (!eventCounts) return;

    let totalXp = 0;
    let ordersCreated = 0;
    let ordersFilled = 0;
    let ordersCancelled = 0;
    let totalTrades = 0;
    let totalVolumeUsd = 0;

    const tradeDates = new Set<string>();

    for (const event of eventCounts) {
      totalXp += event.xp_awarded || 0;

      switch (event.event_type) {
        case 'order_created':
          ordersCreated++;
          break;
        case 'order_filled':
          ordersFilled++;
          break;
        case 'order_cancelled':
          ordersCancelled++;
          break;
        case 'trade_completed':
          totalTrades++;
          break;
      }
    }

    // Get XP from completed challenges too
    const { data: challengeXp } = await supabase
      .from('completed_challenges')
      .select('xp_awarded')
      .eq('wallet_address', walletAddress);

    const challengeXpTotal = challengeXp?.reduce((sum, c) => sum + (c.xp_awarded || 0), 0) || 0;

    await supabase
      .from('users')
      .update({
        total_xp: totalXp + challengeXpTotal,
        total_orders_created: ordersCreated,
        total_orders_filled: ordersFilled,
        total_orders_cancelled: ordersCancelled,
        total_trades: totalTrades,
        total_volume_usd: totalVolumeUsd,
        updated_at: new Date().toISOString(),
      })
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

    // Token diversity challenges - check from trade events
    const { data: tradeEvents } = await supabase
      .from('user_events')
      .select('event_data')
      .eq('wallet_address', walletAddress)
      .eq('event_type', 'trade_completed');

    if (tradeEvents && tradeEvents.length > 0) {
      const uniqueTokens = new Set<string>();
      let tradedMaxi = false;
      let tradedWe = false;
      const tokenCategories = new Set<string>();
      const categoryMap: Record<string, string> = {
        'HEX': 'hex', 'WHEX': 'hex', 'WEHEX': 'hex',
        'PLS': 'pls', 'WPLS': 'pls',
        'PLSX': 'plsx', 'INC': 'inc', 'HDRN': 'hdrn', 'ICSA': 'icsa', 'LOAN': 'loan',
        'DAI': 'stablecoin', 'USDC': 'stablecoin', 'USDT': 'stablecoin', 'USDL': 'stablecoin',
      };

      tradeEvents.forEach((event) => {
        const data = event.event_data as { sell_token?: string; buy_token?: string };
        for (const token of [data.sell_token, data.buy_token]) {
          if (!token) continue;
          const upper = token.toUpperCase();
          uniqueTokens.add(upper);
          if (upper.includes('MAXI')) tradedMaxi = true;
          if (upper.startsWith('WE')) tradedWe = true;
          const cat = categoryMap[upper];
          if (cat) tokenCategories.add(cat);
          if (upper.includes('MAXI')) tokenCategories.add('maxi');
        }
      });

      const count = uniqueTokens.size;
      await Promise.all([
        tryComplete(2, 'Multi-Token Beginner', 'bootcamp', 300, count >= 5),
        tryComplete(3, 'Token Diversity', 'bootcamp', 500, count >= 10),
        tryComplete(4, 'Token Collector', 'bootcamp', 800, count >= 20),
        tryComplete(5, 'Diversified', 'bootcamp', 1200, count >= 30),
        tryComplete(6, 'Token Master', 'bootcamp', 2000, count >= 40),
        tryComplete(7, 'Token Legend', 'bootcamp', 3000, count >= 50),
        tryComplete(8, 'Token God', 'bootcamp', 5000, count >= 75),
        tryComplete(7, 'MAXI Supporter', 'bootcamp', 2000, tradedMaxi),
        tryComplete(6, 'Multi-Chain Explorer', 'bootcamp', 1500, tradedWe),
        tryComplete(8, 'Full Spectrum', 'bootcamp', 4000, tokenCategories.size >= 7),
      ]);
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
