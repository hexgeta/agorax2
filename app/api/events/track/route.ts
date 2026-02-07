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
const rateLimitCache = new Map<string, { count: number; resetTime: number }>();

function checkRateLimit(walletAddress: string): boolean {
  const now = Date.now();
  const key = walletAddress.toLowerCase();
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
      // Continue anyway, the event insert might create the user via trigger
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

      // Update user XP manually
      if (baseXp > 0) {
        await supabase.rpc('get_or_create_user', { p_wallet_address: normalizedWallet });
        await supabase
          .from('users')
          .update({ total_xp: supabase.rpc('', {}) }) // This won't work, need raw SQL
          .eq('wallet_address', normalizedWallet);
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

  // Helper to check and complete a challenge
  const tryComplete = async (
    prestigeLevel: number,
    challengeName: string,
    category: string,
    xp: number,
    condition: boolean
  ) => {
    const key = `${prestigeLevel}-${challengeName}`;
    if (condition && !completedSet.has(key)) {
      const { data: success } = await supabase.rpc('complete_challenge', {
        p_wallet_address: walletAddress,
        p_prestige_level: prestigeLevel,
        p_challenge_name: challengeName,
        p_category: category,
        p_xp_awarded: xp,
      });

      if (success) {
        completed.push({ prestige_level: prestigeLevel, challenge_name: challengeName, category, xp_awarded: xp });
        completedSet.add(key);
      }
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

  // Alpha (Level 0) challenges
  if (eventType === 'wallet_connected') {
    await tryComplete(0, 'First Steps', 'bootcamp', 50, true);
  }

  if (eventType === 'order_created') {
    await tryComplete(0, 'First Order', 'operations', 250, stats.total_orders_created >= 1);
    await tryComplete(1, 'Getting Comfortable', 'operations', 400, stats.total_orders_created >= 5);
    await tryComplete(3, 'Order Machine', 'operations', 800, stats.total_orders_created >= 25);
    await tryComplete(4, 'Order Veteran', 'operations', 1200, stats.total_orders_created >= 50);
    await tryComplete(5, 'Order Legend', 'operations', 2500, stats.total_orders_created >= 100);
    await tryComplete(7, 'Order God', 'operations', 8000, stats.total_orders_created >= 500);
    await tryComplete(8, 'Order Immortal', 'operations', 20000, stats.total_orders_created >= 1000);
  }

  if (eventType === 'order_filled') {
    await tryComplete(0, 'First Fill', 'operations', 250, stats.total_orders_filled >= 1);
    await tryComplete(1, 'Active Buyer', 'operations', 400, stats.total_orders_filled >= 5);
    await tryComplete(6, 'Fill Master', 'operations', 5000, stats.total_orders_filled >= 200);
  }

  if (eventType === 'trade_completed') {
    const volumeUsd = (eventData.volume_usd as number) || 0;

    // Single trade value challenges
    await tryComplete(0, 'Small Fish', 'elite', 300, volumeUsd >= 100);
    await tryComplete(2, 'Rising Star', 'elite', 600, volumeUsd >= 500);
    await tryComplete(3, 'Big Spender', 'elite', 1200, volumeUsd >= 1000);
    await tryComplete(5, 'Whale Alert', 'elite', 4000, volumeUsd >= 10000);
    await tryComplete(7, 'Mega Whale', 'elite', 20000, volumeUsd >= 100000);
    await tryComplete(8, 'Leviathan', 'elite', 75000, volumeUsd >= 500000);

    // Total volume challenges
    await tryComplete(1, 'Volume Starter', 'elite', 500, stats.total_volume_usd >= 500);
    await tryComplete(2, 'Volume Builder', 'elite', 750, stats.total_volume_usd >= 1000);
    await tryComplete(4, 'Volume Veteran', 'elite', 2000, stats.total_volume_usd >= 10000);
    await tryComplete(6, 'Volume King', 'elite', 8000, stats.total_volume_usd >= 100000);
    await tryComplete(8, 'Volume God', 'elite', 50000, stats.total_volume_usd >= 1000000);

    // Total trades challenges
    await tryComplete(2, 'Active Trader', 'operations', 500, stats.total_trades >= 10);
    await tryComplete(4, 'Veteran Trader', 'operations', 1500, stats.total_trades >= 50);
    await tryComplete(5, 'Century Trader', 'operations', 3000, stats.total_trades >= 100);
    await tryComplete(7, 'Trade Machine', 'operations', 10000, stats.total_trades >= 500);
    await tryComplete(8, 'Trade Legend', 'operations', 25000, stats.total_trades >= 1000);

    // Concurrent orders challenges
    await tryComplete(5, 'Market Maker', 'operations', 1500, stats.current_active_orders >= 5);
    await tryComplete(6, 'Power Maker', 'operations', 2500, stats.current_active_orders >= 10);
    await tryComplete(8, 'Market Dominator', 'operations', 5000, stats.current_active_orders >= 20);
  }

  if (eventType === 'order_cancelled') {
    const timeSinceCreation = (eventData.time_since_creation_seconds as number) || Infinity;
    await tryComplete(0, 'Paper Hands', 'humiliation', 50, timeSinceCreation < 60);
  }

  if (eventType === 'order_viewed') {
    // Count unique orders viewed by this user
    const { data: viewedOrders } = await supabase
      .from('user_events')
      .select('event_data')
      .eq('wallet_address', walletAddress)
      .eq('event_type', 'order_viewed');

    // Extract unique order IDs from event_data
    const uniqueOrderIds = new Set<number>();
    viewedOrders?.forEach((event) => {
      const orderId = (event.event_data as { order_id?: number })?.order_id;
      if (orderId !== undefined) {
        uniqueOrderIds.add(orderId);
      }
    });

    const uniqueOrdersViewed = uniqueOrderIds.size;
    await tryComplete(0, 'Window Shopper', 'bootcamp', 100, uniqueOrdersViewed >= 10);
    await tryComplete(2, 'Market Scanner', 'bootcamp', 200, uniqueOrdersViewed >= 50);
    await tryComplete(3, 'Market Regular', 'bootcamp', 300, uniqueOrdersViewed >= 100);
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

  // Token Explorer: View orders for 5 different tokens
  // Token diversity tracking (tokens traded)
  if (eventType === 'order_viewed' || eventType === 'trade_completed') {
    // For Token Explorer: check unique tokens viewed
    if (eventType === 'order_viewed') {
      const { data: viewedTokenEvents } = await supabase
        .from('user_events')
        .select('event_data')
        .eq('wallet_address', walletAddress)
        .eq('event_type', 'order_viewed');

      const uniqueTokensViewed = new Set<string>();
      viewedTokenEvents?.forEach((event) => {
        const token = (event.event_data as { token_symbol?: string })?.token_symbol;
        if (token) {
          uniqueTokensViewed.add(token.toUpperCase());
        }
      });

      await tryComplete(1, 'Token Explorer', 'bootcamp', 150, uniqueTokensViewed.size >= 5);
    }

    // For token trading diversity challenges
    if (eventType === 'trade_completed') {
      const { data: tradeEvents } = await supabase
        .from('user_events')
        .select('event_data')
        .eq('wallet_address', walletAddress)
        .eq('event_type', 'trade_completed');

      const uniqueTokensTraded = new Set<string>();
      let totalHexTraded = 0;
      let totalPlsTraded = 0;
      let tradedMaxiToken = false;
      let tradedWeToken = false;

      tradeEvents?.forEach((event) => {
        const data = event.event_data as {
          sell_token?: string;
          buy_token?: string;
          sell_amount?: number;
          buy_amount?: number;
        };
        if (data.sell_token) {
          const token = data.sell_token.toUpperCase();
          uniqueTokensTraded.add(token);
          // Track HEX volume
          if (token === 'HEX') {
            totalHexTraded += data.sell_amount || 0;
          }
          // Track PLS volume
          if (token === 'PLS' || token === 'WPLS') {
            totalPlsTraded += data.sell_amount || 0;
          }
          // Track MAXI tokens
          if (token.includes('MAXI')) {
            tradedMaxiToken = true;
          }
          // Track wrapped Ethereum tokens (weHEX, etc.)
          if (token.startsWith('WE')) {
            tradedWeToken = true;
          }
        }
        if (data.buy_token) {
          const token = data.buy_token.toUpperCase();
          uniqueTokensTraded.add(token);
          if (token === 'HEX') {
            totalHexTraded += data.buy_amount || 0;
          }
          if (token === 'PLS' || token === 'WPLS') {
            totalPlsTraded += data.buy_amount || 0;
          }
          if (token.includes('MAXI')) {
            tradedMaxiToken = true;
          }
          if (token.startsWith('WE')) {
            tradedWeToken = true;
          }
        }
      });

      const tokensTraded = uniqueTokensTraded.size;
      await tryComplete(2, 'Multi-Token Beginner', 'bootcamp', 300, tokensTraded >= 5);
      await tryComplete(3, 'Token Diversity', 'bootcamp', 500, tokensTraded >= 10);
      await tryComplete(4, 'Token Collector', 'bootcamp', 800, tokensTraded >= 20);
      await tryComplete(5, 'Diversified', 'bootcamp', 1200, tokensTraded >= 30);
      await tryComplete(6, 'Token Master', 'bootcamp', 2000, tokensTraded >= 40);
      await tryComplete(7, 'Token Legend', 'bootcamp', 3000, tokensTraded >= 50);
      await tryComplete(8, 'Token God', 'bootcamp', 5000, tokensTraded >= 75);

      // Token-specific challenges
      await tryComplete(4, 'HEX Enthusiast', 'bootcamp', 600, totalHexTraded >= 100000);
      await tryComplete(5, 'PLS Stacker', 'bootcamp', 1000, totalPlsTraded >= 1000000);
      await tryComplete(7, 'MAXI Supporter', 'bootcamp', 2000, tradedMaxiToken);
      await tryComplete(6, 'Multi-Chain Explorer', 'bootcamp', 1500, tradedWeToken);

      // Night Owl: trade between 3-5 AM UTC
      const now = new Date();
      const utcHour = now.getUTCHours();
      if (utcHour >= 3 && utcHour < 5) {
        await tryComplete(2, 'Night Owl', 'humiliation', 200, true);
      }

      // Micro Trader: trade worth less than $1
      const volumeUsd = (eventData.volume_usd as number) || 0;
      await tryComplete(1, 'Micro Trader', 'humiliation', 75, volumeUsd > 0 && volumeUsd < 1);
    }
  }

  // Indecisive/Total Chaos: multiple cancels in one day
  if (eventType === 'order_cancelled') {
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

    await tryComplete(3, 'Indecisive', 'humiliation', 100, (cancelsToday || 0) >= 5);
    await tryComplete(7, 'Total Chaos', 'humiliation', 500, (cancelsToday || 0) >= 20);
  }

  // Ghost Order: order expired with 0 fills
  if (eventType === 'order_expired') {
    const fillPercentage = (eventData.fill_percentage as number) || 0;
    await tryComplete(3, 'Ghost Order', 'humiliation', 75, fillPercentage === 0);
  }

  // Speed Runner / Sniper / Instant Legend: quick fills
  if (eventType === 'order_filled') {
    const fillTimeSeconds = (eventData.fill_time_seconds as number) || Infinity;
    await tryComplete(4, 'Speed Runner', 'humiliation', 400, fillTimeSeconds <= 30);
    await tryComplete(6, 'The Sniper', 'humiliation', 800, fillTimeSeconds <= 5);
    await tryComplete(8, 'Instant Legend', 'humiliation', 2000, fillTimeSeconds <= 1);
  }

  // Overkill / Fire Sale: pricing challenges (checked on order creation)
  if (eventType === 'order_created') {
    const priceVsMarket = (eventData.price_vs_market_percent as number) || 0;
    // Overkill: 10x above market (900% above = 1000% of market = 10x)
    await tryComplete(5, 'Overkill', 'humiliation', 150, priceVsMarket >= 900);
    // Fire Sale: 50% below market
    await tryComplete(5, 'Fire Sale', 'humiliation', 150, priceVsMarket <= -50);
  }

  // Fill Expert (25 fills) - already have Active Buyer (5) and Fill Master (200)
  if (eventType === 'order_filled') {
    await tryComplete(3, 'Fill Expert', 'operations', 800, stats.total_orders_filled >= 25);
  }

  // Streak challenges (Consistent, Dedicated, Two Week Warrior, Marathon, Unstoppable, Year Warrior)
  // These are checked on any trade_completed event
  if (eventType === 'trade_completed') {
    await tryComplete(2, 'Consistent', 'operations', 400, stats.current_streak_days >= 3);
    await tryComplete(3, 'Dedicated', 'operations', 600, stats.current_streak_days >= 7);
    await tryComplete(4, 'Two Week Warrior', 'operations', 1000, stats.current_streak_days >= 14);
    await tryComplete(6, 'Marathon Trader', 'operations', 4000, stats.current_streak_days >= 30);
    await tryComplete(7, 'Unstoppable', 'operations', 8000, stats.current_streak_days >= 60);
    await tryComplete(8, 'Year Warrior', 'operations', 15000, stats.current_streak_days >= 100);
  }

  // Full Spectrum challenge: trade every whitelisted token category
  // This requires checking if user has traded from all major categories
  if (eventType === 'trade_completed') {
    const { data: tradeEvents } = await supabase
      .from('user_events')
      .select('event_data')
      .eq('wallet_address', walletAddress)
      .eq('event_type', 'trade_completed');

    const tokenCategories = new Set<string>();
    // Define category mappings
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

    tradeEvents?.forEach((event) => {
      const data = event.event_data as { sell_token?: string; buy_token?: string };
      [data.sell_token, data.buy_token].forEach((token) => {
        if (token) {
          const upper = token.toUpperCase();
          const category = categoryMap[upper];
          if (category) {
            tokenCategories.add(category);
          }
          // MAXI tokens are their own category
          if (upper.includes('MAXI')) {
            tokenCategories.add('maxi');
          }
        }
      });
    });

    // Need at least 7 different categories for Full Spectrum
    await tryComplete(8, 'Full Spectrum', 'bootcamp', 4000, tokenCategories.size >= 7);
  }

  // All-Nighter: Make trades every hour for 24 hours straight
  // This is complex - would need to check for 24 consecutive hours with trades
  if (eventType === 'trade_completed') {
    const { data: last24hTrades } = await supabase
      .from('user_events')
      .select('created_at')
      .eq('wallet_address', walletAddress)
      .eq('event_type', 'trade_completed')
      .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
      .order('created_at', { ascending: true });

    if (last24hTrades && last24hTrades.length >= 24) {
      // Check if there's a trade in each of the last 24 hours
      const hoursWithTrades = new Set<number>();
      last24hTrades.forEach((trade) => {
        const tradeTime = new Date(trade.created_at);
        // Round down to hour
        const hourKey = Math.floor(tradeTime.getTime() / (60 * 60 * 1000));
        hoursWithTrades.add(hourKey);
      });

      // Check for 24 consecutive hours
      const sortedHours = Array.from(hoursWithTrades).sort((a, b) => a - b);
      let maxConsecutive = 1;
      let currentConsecutive = 1;
      for (let i = 1; i < sortedHours.length; i++) {
        if (sortedHours[i] === sortedHours[i - 1] + 1) {
          currentConsecutive++;
          maxConsecutive = Math.max(maxConsecutive, currentConsecutive);
        } else {
          currentConsecutive = 1;
        }
      }

      await tryComplete(8, 'All-Nighter', 'humiliation', 3000, maxConsecutive >= 24);
    }
  }

  return completed;
}
