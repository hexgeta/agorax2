import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import type { TrackEventRequest, TrackEventResponse, CompletedChallenge, EventType } from '@/types/events';
import { verifySessionToken } from '@/lib/auth';
import { ACTION_XP, calculateTradeXp } from '@/constants/xp';

// Use service role for server-side operations
const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

// Compute base XP for an event. On-chain actions earn XP per constants/xp.ts;
// view events and housekeeping events earn nothing.
function getEventXp(eventType: EventType, eventData: Record<string, unknown>): number {
  switch (eventType) {
    case 'order_created':
      return ACTION_XP.ORDER_CREATED;       // 20 XP
    case 'order_filled':
      return ACTION_XP.ORDER_FILLED;        // 25 XP
    case 'proceeds_claimed':
      return ACTION_XP.PROCEEDS_CLAIMED;    // 10 XP
    case 'trade_completed': {
      // 25 XP (taker) or 30 XP (maker) + volume bonus (1 XP per $10 USD, capped at 100)
      const isMaker = (eventData.is_maker as boolean) || false;
      const volumeUsd = (eventData.volume_usd as number) || 0;
      return calculateTradeXp(isMaker, volumeUsd);
    }
    default:
      return 0;
  }
}

// Rate limiting: max events per wallet per minute
const RATE_LIMIT_WINDOW_MS = 60000; // 1 minute
const MAX_EVENTS_PER_WINDOW = 30;
const RATE_LIMIT_CLEANUP_INTERVAL_MS = 300000; // Clean up every 5 minutes
const rateLimitCache = new Map<string, { count: number; resetTime: number }>();
let lastRateLimitCleanup = Date.now();

function checkRateLimit(walletAddress: string): boolean {
  const now = Date.now();
  const key = walletAddress.toLowerCase();

  // Periodically clean up expired entries to prevent memory leak
  if (now - lastRateLimitCleanup > RATE_LIMIT_CLEANUP_INTERVAL_MS) {
    for (const [k, v] of rateLimitCache) {
      if (now > v.resetTime) rateLimitCache.delete(k);
    }
    lastRateLimitCleanup = now;
  }

  const entry = rateLimitCache.get(key);

  if (!entry || now > entry.resetTime) {
    rateLimitCache.set(key, { count: 1, resetTime: now + RATE_LIMIT_WINDOW_MS });
    return true;
  }

  if (entry.count >= MAX_EVENTS_PER_WINDOW) {
    return false;
  }

  entry.count++;
  return true;
}

// Validate wallet address format
function isValidWalletAddress(address: string): boolean {
  return /^0x[a-fA-F0-9]{40}$/.test(address);
}

export async function POST(request: NextRequest): Promise<NextResponse<TrackEventResponse>> {
  try {
    const body: TrackEventRequest = await request.json();
    const { wallet_address, event_type, event_data = {} } = body;

    // Validate required fields
    if (!wallet_address || !event_type) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields: wallet_address and event_type' },
        { status: 400 }
      );
    }

    // Validate wallet address format
    if (!isValidWalletAddress(wallet_address)) {
      return NextResponse.json(
        { success: false, error: 'Invalid wallet address format' },
        { status: 400 }
      );
    }

    // Check rate limit
    if (!checkRateLimit(wallet_address)) {
      return NextResponse.json(
        { success: false, error: 'Rate limit exceeded. Please slow down.' },
        { status: 429 }
      );
    }

    const normalizedWallet = wallet_address.toLowerCase();

    // Reject blacklisted wallets immediately
    const { data: userRow } = await supabase
      .from('users')
      .select('is_blacklisted')
      .eq('wallet_address', normalizedWallet)
      .maybeSingle();

    if (userRow?.is_blacklisted) {
      return NextResponse.json(
        { success: false, error: 'Account suspended' },
        { status: 403 },
      );
    }

    const baseXp = getEventXp(event_type, event_data);

    // Events that don't require authentication (harmless view events)
    const UNVERIFIED_EVENTS: EventType[] = [
      'wallet_connected',
      'marketplace_visited',
      'chart_viewed',
    ];

    // For challenge-triggering events, require a valid signed session token.
    // This proves the caller owns the wallet (they signed a message with it).
    if (!UNVERIFIED_EVENTS.includes(event_type)) {
      const authHeader = request.headers.get('authorization');
      const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;

      if (!token) {
        return NextResponse.json(
          { success: false, error: 'Authentication required. Please verify wallet ownership.' },
          { status: 401 },
        );
      }

      const tokenWallet = verifySessionToken(token);
      if (!tokenWallet) {
        return NextResponse.json(
          { success: false, error: 'Session expired or invalid. Please re-verify wallet.' },
          { status: 401 },
        );
      }

      // Ensure the token's wallet matches the request's wallet
      if (tokenWallet !== normalizedWallet) {
        return NextResponse.json(
          { success: false, error: 'Token wallet mismatch' },
          { status: 403 },
        );
      }
    }

    // Dedup: skip if an identical event already exists.
    // - One-off events (wallet_connected, marketplace_visited): one per wallet ever.
    // - Events with tx_hash: one per wallet + event_type + tx_hash (matches cron dedup).
    // - Events with order_id: one per wallet + event_type + order_id.
    const ONE_OFF_EVENTS: EventType[] = ['wallet_connected', 'marketplace_visited'];
    const txHash = event_data.tx_hash as string | undefined;
    const orderId = event_data.order_id as string | number | undefined;

    if (ONE_OFF_EVENTS.includes(event_type)) {
      const { data: existing } = await supabase
        .from('user_events')
        .select('id')
        .eq('wallet_address', normalizedWallet)
        .eq('event_type', event_type)
        .limit(1)
        .maybeSingle();

      if (existing) {
        return NextResponse.json({ success: true, xp_awarded: 0, challenges_completed: [] });
      }
    } else if (txHash) {
      const { data: existing } = await supabase
        .from('user_events')
        .select('id')
        .eq('wallet_address', normalizedWallet)
        .eq('event_type', event_type)
        .contains('event_data', { tx_hash: txHash })
        .limit(1)
        .maybeSingle();

      if (existing) {
        return NextResponse.json({ success: true, xp_awarded: 0, challenges_completed: [] });
      }
    } else if (orderId !== undefined) {
      const { data: existing } = await supabase
        .from('user_events')
        .select('id')
        .eq('wallet_address', normalizedWallet)
        .eq('event_type', event_type)
        .contains('event_data', { order_id: orderId })
        .limit(1)
        .maybeSingle();

      if (existing) {
        return NextResponse.json({ success: true, xp_awarded: 0, challenges_completed: [] });
      }
    }

    // Ensure user exists
    const { error: userError } = await supabase
      .from('users')
      .upsert(
        { wallet_address: normalizedWallet },
        { onConflict: 'wallet_address', ignoreDuplicates: true }
      );

    if (userError) {
      console.error('Error upserting user:', userError);
    }

    // Record the event using the database function
    const { data: eventResult, error: eventError } = await supabase.rpc('record_user_event', {
      p_wallet_address: normalizedWallet,
      p_event_type: event_type,
      p_event_data: event_data,
      p_xp_awarded: baseXp,
    });

    if (eventError) {
      console.error('Error recording event:', eventError);

      // Fallback: direct insert if function fails
      const { data: insertData, error: insertError } = await supabase
        .from('user_events')
        .insert({
          wallet_address: normalizedWallet,
          event_type,
          event_data,
          xp_awarded: baseXp,
        })
        .select('id')
        .single();

      if (insertError) {
        return NextResponse.json(
          { success: false, error: 'Failed to record event' },
          { status: 500 }
        );
      }

      // Update user XP manually via raw increment
      if (baseXp > 0) {
        await supabase.rpc('get_or_create_user', { p_wallet_address: normalizedWallet });
        // Fetch current XP and increment
        const { data: currentUser } = await supabase
          .from('users')
          .select('total_xp')
          .eq('wallet_address', normalizedWallet)
          .single();

        if (currentUser) {
          await supabase
            .from('users')
            .update({ total_xp: (currentUser.total_xp || 0) + baseXp, updated_at: new Date().toISOString() })
            .eq('wallet_address', normalizedWallet);
        }
      }

      return NextResponse.json({
        success: true,
        event_id: insertData?.id,
        xp_awarded: baseXp,
        challenges_completed: [],
      });
    }

    // Check for newly completed challenges based on the event
    const completedChallenges: CompletedChallenge[] = [];

    // Get user's current stats to check challenge completion
    const { data: userStats } = await supabase
      .from('users')
      .select('*')
      .eq('wallet_address', normalizedWallet)
      .single();

    if (userStats) {
      // Check challenges based on event type and user stats
      const newlyCompleted = await checkAndCompleteChallenges(
        normalizedWallet,
        event_type,
        event_data,
        userStats
      );
      completedChallenges.push(...newlyCompleted);
    }

    const totalXpAwarded = baseXp + completedChallenges.reduce((sum, c) => sum + c.xp_awarded, 0);

    return NextResponse.json({
      success: true,
      event_id: eventResult,
      xp_awarded: totalXpAwarded,
      challenges_completed: completedChallenges,
    });
  } catch (error) {
    console.error('Error in track event API:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// Check and complete challenges based on current event and user stats
async function checkAndCompleteChallenges(
  walletAddress: string,
  eventType: EventType,
  eventData: Record<string, unknown>,
  userStats: Record<string, unknown>
): Promise<CompletedChallenge[]> {
  const completed: CompletedChallenge[] = [];

  // Get user's already completed challenges
  const { data: existingChallenges } = await supabase
    .from('completed_challenges')
    .select('challenge_name, prestige_level')
    .eq('wallet_address', walletAddress);

  const completedSet = new Set(
    existingChallenges?.map((c) => `${c.prestige_level}-${c.challenge_name}`) || []
  );

  // Helper to complete a challenge (checks condition and dedup synchronously, only calls RPC if needed)
  const tryComplete = async (
    prestigeLevel: number,
    challengeName: string,
    category: string,
    xp: number,
    condition: boolean
  ) => {
    const key = `${prestigeLevel}-${challengeName}`;
    if (!condition || completedSet.has(key)) return;

    // Optimistically mark to prevent duplicate attempts in same batch
    completedSet.add(key);

    const { data: success } = await supabase.rpc('complete_challenge', {
      p_wallet_address: walletAddress,
      p_prestige_level: prestigeLevel,
      p_challenge_name: challengeName,
      p_category: category,
      p_xp_awarded: xp,
    });

    if (success) {
      completed.push({ prestige_level: prestigeLevel, challenge_name: challengeName, category, xp_awarded: xp });
    }
  };

  const stats = userStats as {
    total_orders_created: number;
    total_orders_filled: number;
    total_trades: number;
    total_volume_usd: number;
    current_active_orders: number;
    current_streak_days: number;
  };

  // ---- Challenges that only need stats (no extra DB queries) ----
  // These can be batched into parallel Promise.all calls

  if (eventType === 'wallet_connected') {
    await tryComplete(0, 'First Steps', 'bootcamp', 50, true);
  }

  if (eventType === 'order_created') {
    const priceVsMarket = (eventData.price_vs_market_percent as number) || 0;

    // Check Playing Both Sides: did user also fill an order today?
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const { count: fillsToday } = await supabase
      .from('user_events')
      .select('id', { count: 'exact', head: true })
      .eq('wallet_address', walletAddress)
      .eq('event_type', 'order_filled')
      .gte('created_at', today.toISOString())
      .lt('created_at', tomorrow.toISOString());

    // Check Arbitrage Artist: did user fill an order within last 2 minutes?
    const twoMinAgo = new Date(Date.now() - 120000).toISOString();
    const { count: recentFills } = await supabase
      .from('user_events')
      .select('id', { count: 'exact', head: true })
      .eq('wallet_address', walletAddress)
      .eq('event_type', 'order_filled')
      .gte('created_at', twoMinAgo);

    // Check Deja Vu: duplicate order params
    let hasDuplicateOrder = false;
    const sellToken = eventData.sell_token as string | undefined;
    const buyTokens = eventData.buy_tokens as string[] | undefined;
    const sellAmount = eventData.sell_amount as string | undefined;
    if (sellToken && buyTokens && sellAmount) {
      const { data: prevOrders } = await supabase
        .from('user_events')
        .select('event_data')
        .eq('wallet_address', walletAddress)
        .eq('event_type', 'order_created')
        .neq('id', 'placeholder'); // exclude current (it's already recorded)

      if (prevOrders) {
        hasDuplicateOrder = prevOrders.some((prev) => {
          const d = prev.event_data as { sell_token?: string; buy_tokens?: string[]; sell_amount?: string };
          return d.sell_token === sellToken &&
            d.sell_amount === sellAmount &&
            JSON.stringify(d.buy_tokens) === JSON.stringify(buyTokens);
        });
      }
    }

    // Check Order Hoarder: 15+ active orders with 0 fills (approximate via stats)
    const activeUnfilled = stats.current_active_orders;

    // Check for token-specific challenges (HTT, COM, pDAI, DEX tokens)
    const sellTokenUpper = sellToken?.toUpperCase() || '';
    const buyTokensUpper = buyTokens?.map(t => t.toUpperCase()) || [];
    const hasHTT = sellTokenUpper === 'HTT' || buyTokensUpper.includes('HTT');
    const hasCOM = sellTokenUpper === 'COM' || buyTokensUpper.includes('COM');
    const hasPDAI = sellTokenUpper === 'PDAI' || sellTokenUpper === 'DAI' || buyTokensUpper.includes('PDAI') || buyTokensUpper.includes('DAI');

    // DEX Degen: order with PulseChain DEX tokens
    const dexTokens = new Set(['PLSX', '9MM', '9INCH', 'PHUX', 'TIDE', 'UNI']);
    const hasDexToken = dexTokens.has(sellTokenUpper) || buyTokensUpper.some(t => dexTokens.has(t));

    // Weekend Warrior: create order on Saturday or Sunday
    const orderDay = new Date().getUTCDay();
    const isWeekend = orderDay === 0 || orderDay === 6;

    await Promise.all([
      tryComplete(0, 'First Order', 'operations', 250, stats.total_orders_created >= 1),
      tryComplete(1, 'Getting Comfortable', 'operations', 400, stats.total_orders_created >= 5),
      tryComplete(3, 'Order Machine', 'operations', 800, stats.total_orders_created >= 25),
      tryComplete(4, 'Order Veteran', 'operations', 1200, stats.total_orders_created >= 50),
      tryComplete(5, 'Order Legend', 'operations', 2500, stats.total_orders_created >= 100),
      tryComplete(7, 'Order God', 'operations', 8000, stats.total_orders_created >= 500),
      tryComplete(8, 'Order Immortal', 'operations', 20000, stats.total_orders_created >= 1000),
      // Pricing challenges
      tryComplete(5, 'Fatfinger', 'wildcard', 150, priceVsMarket > 0),
      tryComplete(5, 'Dip Catcher', 'wildcard', 150, priceVsMarket <= -50),
      // Playing Both Sides (also checked on order_filled)
      tryComplete(2, 'Playing Both Sides', 'operations', 500, (fillsToday || 0) >= 1),
      // Arbitrage Artist
      tryComplete(4, 'Arbitrage Artist', 'operations', 1000, (recentFills || 0) >= 1),
      // Deja Vu
      tryComplete(2, 'Deja Vu', 'wildcard', 100, hasDuplicateOrder),
      // Order Hoarder
      tryComplete(5, 'Order Hoarder', 'wildcard', 300, activeUnfilled >= 15),
      // Token-specific challenges
      tryComplete(7, 'Bond Trader', 'bootcamp', 2000, hasHTT),
      tryComplete(7, 'Coupon Clipper', 'bootcamp', 2000, hasCOM),
      tryComplete(7, '$1 Inevitable', 'bootcamp', 2000, hasPDAI),
      // DEX Degen wildcard
      tryComplete(1, 'DEX Degen', 'wildcard', 150, hasDexToken),
      // Weekend Warrior
      tryComplete(1, 'Weekend Warrior', 'operations', 300, isWeekend),
    ]);
  }

  if (eventType === 'order_filled') {
    const fillTimeSeconds = (eventData.fill_time_seconds as number) || Infinity;

    // Check Playing Both Sides: did user also create an order today?
    const todayFill = new Date();
    todayFill.setUTCHours(0, 0, 0, 0);
    const tomorrowFill = new Date(todayFill);
    tomorrowFill.setDate(tomorrowFill.getDate() + 1);

    const { count: createdToday } = await supabase
      .from('user_events')
      .select('id', { count: 'exact', head: true })
      .eq('wallet_address', walletAddress)
      .eq('event_type', 'order_created')
      .gte('created_at', todayFill.toISOString())
      .lt('created_at', tomorrowFill.toISOString());

    await Promise.all([
      tryComplete(0, 'First Fill', 'operations', 250, stats.total_orders_filled >= 1),
      tryComplete(1, 'Active Buyer', 'operations', 400, stats.total_orders_filled >= 5),
      tryComplete(3, 'Fill Expert', 'operations', 800, stats.total_orders_filled >= 25),
      tryComplete(6, 'Fill Master', 'operations', 5000, stats.total_orders_filled >= 200),
      // Speed challenges
      tryComplete(4, 'Speed Runner', 'wildcard', 400, fillTimeSeconds <= 30),
      tryComplete(8, 'Sniper', 'wildcard', 2000, fillTimeSeconds <= 60),
      // Playing Both Sides (also checked on order_created)
      tryComplete(2, 'Playing Both Sides', 'operations', 500, (createdToday || 0) >= 1),
    ]);
  }

  if (eventType === 'order_cancelled') {
    const timeSinceCreation = (eventData.time_since_creation_seconds as number) || Infinity;
    await tryComplete(0, 'Paper Hands', 'wildcard', 50, timeSinceCreation < 60);

    // Indecisive/Total Chaos: multiple cancels in one day
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const { count: cancelsToday } = await supabase
      .from('user_events')
      .select('id', { count: 'exact', head: true })
      .eq('wallet_address', walletAddress)
      .eq('event_type', 'order_cancelled')
      .gte('created_at', today.toISOString())
      .lt('created_at', tomorrow.toISOString());

    await Promise.all([
      tryComplete(3, 'Indecisive', 'wildcard', 100, (cancelsToday || 0) >= 5),
      tryComplete(7, 'Total Chaos', 'wildcard', 500, (cancelsToday || 0) >= 20),
    ]);
  }

  if (eventType === 'order_expired') {
    const fillPercentage = (eventData.fill_percentage as number) || 0;
    await tryComplete(3, 'Ghost Order', 'wildcard', 75, fillPercentage === 0);

    // Ghost Town: 5+ expired orders with 0 fills
    if (fillPercentage === 0) {
      const { data: expiredEvents } = await supabase
        .from('user_events')
        .select('event_data')
        .eq('wallet_address', walletAddress)
        .eq('event_type', 'order_expired');

      const ghostCount = expiredEvents?.filter((e) => {
        const d = e.event_data as { fill_percentage?: number };
        return (d.fill_percentage || 0) === 0;
      }).length || 0;

      await tryComplete(5, 'Ghost Town', 'wildcard', 200, ghostCount >= 5);
    }
  }

  // ---- proceeds_claimed: collector, claim machine, profit master, hands ----
  if (eventType === 'proceeds_claimed') {
    const { data: claimEvents } = await supabase
      .from('user_events')
      .select('event_data')
      .eq('wallet_address', walletAddress)
      .eq('event_type', 'proceeds_claimed');

    const totalClaims = claimEvents?.length || 0;
    const uniqueOrdersClaimed = new Set(
      claimEvents?.map((e) => String((e.event_data as { order_id?: number }).order_id)).filter(Boolean)
    ).size;

    // Check Iron Hands / Diamond Hands: order age from creation to now
    const orderId = eventData.order_id as number | undefined;
    let orderAgeDays = 0;
    if (orderId !== undefined) {
      const { data: orderCreation } = await supabase
        .from('user_events')
        .select('created_at')
        .eq('wallet_address', walletAddress)
        .eq('event_type', 'order_created')
        .contains('event_data', { order_id: orderId })
        .limit(1)
        .maybeSingle();

      if (orderCreation) {
        orderAgeDays = Math.floor((Date.now() - new Date(orderCreation.created_at).getTime()) / (1000 * 60 * 60 * 24));
      }
    }

    await Promise.all([
      tryComplete(3, 'The Collector', 'operations', 600, uniqueOrdersClaimed >= 10),
      tryComplete(5, 'Claim Machine', 'operations', 2000, totalClaims >= 50),
      tryComplete(7, 'Profit Master', 'elite', 12000, totalClaims >= 100),
      tryComplete(4, 'Iron Hands', 'elite', 1500, orderAgeDays >= 30),
      tryComplete(6, 'Diamond Hands', 'elite', 5000, orderAgeDays >= 90),
    ]);
  }

  // ---- trade_completed: single consolidated query for all trade-based challenges ----
  if (eventType === 'trade_completed') {
    const volumeUsd = (eventData.volume_usd as number) || 0;

    // Single query for all trade events (used by token diversity, Full Spectrum, All-Nighter)
    const { data: tradeEvents } = await supabase
      .from('user_events')
      .select('event_data, created_at')
      .eq('wallet_address', walletAddress)
      .eq('event_type', 'trade_completed');

    // Process trade events once for multiple challenge checks
    const uniqueTokensTraded = new Set<string>();
    let totalHexTraded = 0;
    let totalPlsTraded = 0;
    let totalStableTraded = 0;
    let tradedMaxiToken = false;
    let tradedWeToken = false;
    let pennyTradeCount = 0;
    const stableTokens = new Set(['DAI', 'USDC', 'USDT', 'USDL', 'WEDAI', 'WEUSDC', 'WEUSDT', 'PXDC', 'HEXDC']);

    // For Clean Sweep: track completed maker orders
    const completedMakerOrders = new Set<string>();
    // For AON Champion: track completed AON maker orders
    const completedAonOrders = new Set<string>();
    // For Multi-Fill: track unique fillers per order
    const orderFillers = new Map<string, Set<string>>();
    // For Full House: track partially filled active maker orders
    const partiallyFilledMakerOrders = new Set<string>();

    tradeEvents?.forEach((event) => {
      const data = event.event_data as {
        sell_token?: string;
        buy_token?: string;
        sell_amount?: number;
        buy_amount?: number;
        volume_usd?: number;
        is_maker?: boolean;
        order_id?: number;
        is_all_or_nothing?: boolean;
        order_completed?: boolean;
        filler_wallet?: string;
      };

      // Track penny trades
      if (data.volume_usd !== undefined && data.volume_usd > 0 && data.volume_usd < 1) {
        pennyTradeCount++;
      }

      // Track completed maker orders for Clean Sweep
      if (data.is_maker && data.order_completed && data.order_id !== undefined) {
        completedMakerOrders.add(String(data.order_id));
        if (data.is_all_or_nothing) {
          completedAonOrders.add(String(data.order_id));
        }
      }

      // Track partially filled maker orders for Full House
      if (data.is_maker && !data.order_completed && data.order_id !== undefined) {
        partiallyFilledMakerOrders.add(String(data.order_id));
      }

      // Track unique fillers per order for Multi-Fill
      if (data.is_maker && data.order_id !== undefined && data.filler_wallet) {
        const oid = String(data.order_id);
        if (!orderFillers.has(oid)) orderFillers.set(oid, new Set());
        orderFillers.get(oid)!.add(data.filler_wallet.toLowerCase());
      }

      // Process both sell and buy tokens
      for (const [token, amount] of [
        [data.sell_token, data.sell_amount],
        [data.buy_token, data.buy_amount],
      ] as [string | undefined, number | undefined][]) {
        if (!token) continue;
        const upper = token.toUpperCase();
        uniqueTokensTraded.add(upper);

        if (upper === 'HEX') totalHexTraded += amount || 0;
        if (upper === 'PLS' || upper === 'WPLS') totalPlsTraded += amount || 0;
        if (stableTokens.has(upper)) totalStableTraded += amount || 0;
        if (upper.includes('MAXI')) tradedMaxiToken = true;
        if (upper.startsWith('WE')) tradedWeToken = true;
      }
    });

    const tokensTraded = uniqueTokensTraded.size;
    const now = new Date();
    const utcHour = now.getUTCHours();

    // Check max unique fillers on any single order
    let maxFillers = 0;
    for (const fillers of orderFillers.values()) {
      maxFillers = Math.max(maxFillers, fillers.size);
    }

    // Fire all trade_completed challenges in parallel
    await Promise.all([
      // Single trade value challenges
      tryComplete(0, 'Small Fry', 'elite', 300, volumeUsd >= 100),
      tryComplete(2, 'Rising Star', 'elite', 600, volumeUsd >= 500),
      tryComplete(3, 'Big Spender', 'elite', 1200, volumeUsd >= 1000),
      tryComplete(5, 'Whale Alert', 'elite', 4000, volumeUsd >= 10000),
      tryComplete(7, 'Mega Whale', 'elite', 20000, volumeUsd >= 100000),
      tryComplete(8, 'Leviathan', 'elite', 75000, volumeUsd >= 500000),

      // Total volume challenges
      tryComplete(1, 'Volume Starter', 'elite', 500, stats.total_volume_usd >= 500),
      tryComplete(2, 'Volume Builder', 'elite', 750, stats.total_volume_usd >= 1000),
      tryComplete(4, 'Volume Veteran', 'elite', 2000, stats.total_volume_usd >= 10000),
      tryComplete(6, 'Volume King', 'elite', 8000, stats.total_volume_usd >= 100000),
      tryComplete(8, 'Volume God', 'elite', 50000, stats.total_volume_usd >= 1000000),

      // Total trades challenges
      tryComplete(2, 'Active Trader', 'operations', 500, stats.total_trades >= 10),
      tryComplete(4, 'Veteran Trader', 'operations', 1500, stats.total_trades >= 50),
      tryComplete(5, 'Century Trader', 'operations', 3000, stats.total_trades >= 100),
      tryComplete(7, 'Trade Machine', 'operations', 10000, stats.total_trades >= 500),
      tryComplete(8, 'Trade Legend', 'operations', 25000, stats.total_trades >= 1000),

      // Concurrent orders challenges
      tryComplete(5, 'Market Maker', 'operations', 1500, stats.current_active_orders >= 5),
      tryComplete(6, 'Power Maker', 'operations', 2500, stats.current_active_orders >= 10),
      tryComplete(8, 'Domination', 'operations', 5000, stats.current_active_orders >= 20),

      // Streak challenges
      tryComplete(2, 'Consistent', 'operations', 400, stats.current_streak_days >= 3),
      tryComplete(3, 'Dedicated', 'operations', 600, stats.current_streak_days >= 7),
      tryComplete(4, 'Two Week Warrior', 'operations', 1000, stats.current_streak_days >= 14),

      // Token diversity challenges
      tryComplete(2, 'Multi-Token Beginner', 'bootcamp', 300, tokensTraded >= 5),
      tryComplete(3, 'Token Diversity', 'bootcamp', 500, tokensTraded >= 10),
      tryComplete(4, 'Token Collector', 'bootcamp', 800, tokensTraded >= 20),
      tryComplete(5, 'Diversified', 'bootcamp', 1200, tokensTraded >= 30),
      tryComplete(6, 'Token Master', 'bootcamp', 2000, tokensTraded >= 40),
      tryComplete(7, 'Token Legend', 'bootcamp', 3000, tokensTraded >= 50),
      tryComplete(8, 'Token God', 'bootcamp', 5000, tokensTraded >= 75),

      // Token-specific challenges
      tryComplete(4, 'HEX Enthusiast', 'bootcamp', 600, totalHexTraded >= 100000),
      tryComplete(5, 'PLS Stacker', 'bootcamp', 1000, totalPlsTraded >= 1000000),
      tryComplete(7, 'MAXI Maxi', 'bootcamp', 2000, tradedMaxiToken),
      tryComplete(6, 'Ethereum Maxi', 'bootcamp', 1500, tradedWeToken),

      // Time-based challenges
      tryComplete(2, 'Night Owl', 'wildcard', 200, utcHour >= 3 && utcHour < 5),
      tryComplete(3, 'Early Bird', 'wildcard', 250, utcHour === 0),
      tryComplete(1, 'Micro Trader', 'wildcard', 75, volumeUsd > 0 && volumeUsd < 1),
      tryComplete(4, 'Penny Pincher', 'wildcard', 200, pennyTradeCount >= 10),

      // Perfect Record: 10+ trades with 0 cancellations
      tryComplete(4, 'Perfect Record', 'operations', 1500, stats.total_trades >= 10 && (stats as any).total_orders_cancelled === 0),

      // Clean Sweep: 5 fully completed maker orders
      tryComplete(3, 'Clean Sweep', 'operations', 800, completedMakerOrders.size >= 5),

      // AON Champion: 3 completed AON orders
      tryComplete(5, 'AON Champion', 'operations', 2500, completedAonOrders.size >= 3),

      // Multi-Fill: single order filled by 5+ different wallets
      tryComplete(6, 'Multi-Fill', 'operations', 3000, maxFillers >= 5),

      // Full House: 3 partially filled active maker orders simultaneously
      tryComplete(7, 'Full House', 'operations', 5000, partiallyFilledMakerOrders.size >= 3),

      // Token volume barons
      tryComplete(5, 'HEX Baron', 'elite', 3000, totalHexTraded >= 1000000),
      tryComplete(6, 'PLS Baron', 'elite', 3000, totalPlsTraded >= 10000000),
      tryComplete(7, 'Stablecoin Baron', 'elite', 5000, totalStableTraded >= 100000),
    ]);
  }

  return completed;
}
