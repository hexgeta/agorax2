import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import type { TrackEventRequest, TrackEventResponse, CompletedChallenge, EventType } from '@/types/events';

// Use service role for server-side operations
const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

// XP values for different events (base values, challenges give additional XP)
const EVENT_XP: Partial<Record<EventType, number>> = {
  wallet_connected: 0, // Tracked but no XP
  order_created: 10,
  order_filled: 10,
  order_cancelled: 0,
  order_expired: 0,
  proceeds_claimed: 5,
  order_viewed: 1,
  chart_viewed: 1,
  marketplace_visited: 1,
  trade_completed: 25,
  streak_updated: 0,
  prestige_unlocked: 0,
};

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
    const baseXp = EVENT_XP[event_type] || 0;

    // One-off events: check if already recorded for this user
    const ONE_OFF_EVENTS: EventType[] = ['wallet_connected', 'marketplace_visited'];
    if (ONE_OFF_EVENTS.includes(event_type)) {
      const { data: existingEvent } = await supabase
        .from('user_events')
        .select('id')
        .eq('wallet_address', normalizedWallet)
        .eq('event_type', event_type)
        .limit(1)
        .single();

      if (existingEvent) {
        // Already tracked, return success but don't record again
        return NextResponse.json({
          success: true,
          xp_awarded: 0,
          challenges_completed: [],
        });
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
    await Promise.all([
      tryComplete(0, 'First Order', 'operations', 250, stats.total_orders_created >= 1),
      tryComplete(1, 'Getting Comfortable', 'operations', 400, stats.total_orders_created >= 5),
      tryComplete(3, 'Order Machine', 'operations', 800, stats.total_orders_created >= 25),
      tryComplete(4, 'Order Veteran', 'operations', 1200, stats.total_orders_created >= 50),
      tryComplete(5, 'Order Legend', 'operations', 2500, stats.total_orders_created >= 100),
      tryComplete(7, 'Order God', 'operations', 8000, stats.total_orders_created >= 500),
      tryComplete(8, 'Order Immortal', 'operations', 20000, stats.total_orders_created >= 1000),
      // Overkill / Fire Sale: pricing challenges
      tryComplete(5, 'Overkill', 'humiliation', 150, priceVsMarket >= 900),
      tryComplete(5, 'Fire Sale', 'humiliation', 150, priceVsMarket <= -50),
    ]);
  }

  if (eventType === 'order_filled') {
    const fillTimeSeconds = (eventData.fill_time_seconds as number) || Infinity;
    await Promise.all([
      tryComplete(0, 'First Fill', 'operations', 250, stats.total_orders_filled >= 1),
      tryComplete(1, 'Active Buyer', 'operations', 400, stats.total_orders_filled >= 5),
      tryComplete(3, 'Fill Expert', 'operations', 800, stats.total_orders_filled >= 25),
      tryComplete(6, 'Fill Master', 'operations', 5000, stats.total_orders_filled >= 200),
      // Speed challenges
      tryComplete(4, 'Speed Runner', 'humiliation', 400, fillTimeSeconds <= 30),
      tryComplete(6, 'The Sniper', 'humiliation', 800, fillTimeSeconds <= 5),
      tryComplete(8, 'Instant Legend', 'humiliation', 2000, fillTimeSeconds <= 1),
    ]);
  }

  if (eventType === 'order_cancelled') {
    const timeSinceCreation = (eventData.time_since_creation_seconds as number) || Infinity;
    await tryComplete(0, 'Paper Hands', 'humiliation', 50, timeSinceCreation < 60);

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
      tryComplete(3, 'Indecisive', 'humiliation', 100, (cancelsToday || 0) >= 5),
      tryComplete(7, 'Total Chaos', 'humiliation', 500, (cancelsToday || 0) >= 20),
    ]);
  }

  if (eventType === 'order_expired') {
    const fillPercentage = (eventData.fill_percentage as number) || 0;
    await tryComplete(3, 'Ghost Order', 'humiliation', 75, fillPercentage === 0);
  }

  // ---- order_viewed: single query for both unique orders and unique tokens ----
  if (eventType === 'order_viewed') {
    const { data: viewedEvents } = await supabase
      .from('user_events')
      .select('event_data')
      .eq('wallet_address', walletAddress)
      .eq('event_type', 'order_viewed');

    const uniqueOrderIds = new Set<string>();
    const uniqueTokensViewed = new Set<string>();
    viewedEvents?.forEach((event) => {
      const data = event.event_data as { order_id?: number; token_symbol?: string };
      if (data.order_id !== undefined) uniqueOrderIds.add(String(data.order_id));
      if (data.token_symbol) uniqueTokensViewed.add(data.token_symbol.toUpperCase());
    });

    const uniqueOrdersViewed = uniqueOrderIds.size;
    await Promise.all([
      tryComplete(0, 'Window Shopper', 'bootcamp', 100, uniqueOrdersViewed >= 10),
      tryComplete(2, 'Market Scanner', 'bootcamp', 200, uniqueOrdersViewed >= 50),
      tryComplete(3, 'Market Regular', 'bootcamp', 300, uniqueOrdersViewed >= 100),
      tryComplete(1, 'Token Explorer', 'bootcamp', 150, uniqueTokensViewed.size >= 5),
    ]);
  }

  // Price Watcher: Check chart views (10 times)
  if (eventType === 'chart_viewed') {
    const { count: chartViews } = await supabase
      .from('user_events')
      .select('id', { count: 'exact', head: true })
      .eq('wallet_address', walletAddress)
      .eq('event_type', 'chart_viewed');

    await tryComplete(1, 'Price Watcher', 'bootcamp', 100, (chartViews || 0) >= 10);
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
    let tradedMaxiToken = false;
    let tradedWeToken = false;
    const tokenCategories = new Set<string>();
    const categoryMap: Record<string, string> = {
      'HEX': 'hex', 'WHEX': 'hex', 'WEHEX': 'hex',
      'PLS': 'pls', 'WPLS': 'pls',
      'PLSX': 'plsx',
      'INC': 'inc',
      'HDRN': 'hdrn',
      'ICSA': 'icsa',
      'LOAN': 'loan',
      'DAI': 'stablecoin', 'USDC': 'stablecoin', 'USDT': 'stablecoin', 'USDL': 'stablecoin',
    };

    // For All-Nighter check
    const hoursWithTrades = new Set<number>();

    tradeEvents?.forEach((event) => {
      const data = event.event_data as {
        sell_token?: string;
        buy_token?: string;
        sell_amount?: number;
        buy_amount?: number;
      };

      // Track hours for All-Nighter
      const tradeTime = new Date(event.created_at);
      hoursWithTrades.add(Math.floor(tradeTime.getTime() / (60 * 60 * 1000)));

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
        if (upper.includes('MAXI')) tradedMaxiToken = true;
        if (upper.startsWith('WE')) tradedWeToken = true;

        const category = categoryMap[upper];
        if (category) tokenCategories.add(category);
        if (upper.includes('MAXI')) tokenCategories.add('maxi');
      }
    });

    const tokensTraded = uniqueTokensTraded.size;
    const now = new Date();
    const utcHour = now.getUTCHours();

    // All-Nighter: check for 24 consecutive hours
    let maxConsecutiveHours = 0;
    if (hoursWithTrades.size >= 24) {
      const sortedHours = Array.from(hoursWithTrades).sort((a, b) => a - b);
      let currentConsecutive = 1;
      for (let i = 1; i < sortedHours.length; i++) {
        if (sortedHours[i] === sortedHours[i - 1] + 1) {
          currentConsecutive++;
          maxConsecutiveHours = Math.max(maxConsecutiveHours, currentConsecutive);
        } else {
          currentConsecutive = 1;
        }
      }
    }

    // Fire all trade_completed challenges in parallel
    await Promise.all([
      // Single trade value challenges
      tryComplete(0, 'Small Fish', 'elite', 300, volumeUsd >= 100),
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
      tryComplete(8, 'Market Dominator', 'operations', 5000, stats.current_active_orders >= 20),

      // Streak challenges
      tryComplete(2, 'Consistent', 'operations', 400, stats.current_streak_days >= 3),
      tryComplete(3, 'Dedicated', 'operations', 600, stats.current_streak_days >= 7),
      tryComplete(4, 'Two Week Warrior', 'operations', 1000, stats.current_streak_days >= 14),
      tryComplete(6, 'Marathon Trader', 'operations', 4000, stats.current_streak_days >= 30),
      tryComplete(7, 'Unstoppable', 'operations', 8000, stats.current_streak_days >= 60),
      tryComplete(8, 'Year Warrior', 'operations', 15000, stats.current_streak_days >= 100),

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
      tryComplete(7, 'MAXI Supporter', 'bootcamp', 2000, tradedMaxiToken),
      tryComplete(6, 'Multi-Chain Explorer', 'bootcamp', 1500, tradedWeToken),

      // Time-based challenges
      tryComplete(2, 'Night Owl', 'humiliation', 200, utcHour >= 3 && utcHour < 5),
      tryComplete(1, 'Micro Trader', 'humiliation', 75, volumeUsd > 0 && volumeUsd < 1),

      // Full Spectrum
      tryComplete(8, 'Full Spectrum', 'bootcamp', 4000, tokenCategories.size >= 7),

      // All-Nighter
      tryComplete(8, 'All-Nighter', 'humiliation', 3000, maxConsecutiveHours >= 24),
    ]);
  }

  return completed;
}
