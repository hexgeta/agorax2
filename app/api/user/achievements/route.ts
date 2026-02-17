import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import type { UserAchievements, UserStats, LeaderboardEntry } from '@/types/events';

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

// Validate wallet address format
function isValidWalletAddress(address: string): boolean {
  return /^0x[a-fA-F0-9]{40}$/.test(address);
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const { searchParams } = new URL(request.url);
    const walletAddress = searchParams.get('wallet');

    if (!walletAddress) {
      return NextResponse.json(
        { success: false, error: 'Missing wallet address parameter' },
        { status: 400 }
      );
    }

    if (!isValidWalletAddress(walletAddress)) {
      return NextResponse.json(
        { success: false, error: 'Invalid wallet address format' },
        { status: 400 }
      );
    }

    const normalizedWallet = walletAddress.toLowerCase();

    // Fetch user stats
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('*')
      .eq('wallet_address', normalizedWallet)
      .single();

    if (userError && userError.code !== 'PGRST116') {
      // PGRST116 = no rows returned
      return NextResponse.json(
        { success: false, error: 'Failed to fetch user data' },
        { status: 500 }
      );
    }

    // Fetch completed challenges
    const { data: challengesData, error: challengesError } = await supabase
      .from('completed_challenges')
      .select('prestige_level, challenge_name, category, xp_awarded, completed_at')
      .eq('wallet_address', normalizedWallet)
      .order('completed_at', { ascending: false });

    if (challengesError) {
    }

    // Fetch XP breakdown by event type
    const { data: eventsData, error: eventsError } = await supabase
      .from('user_events')
      .select('event_type, xp_awarded')
      .eq('wallet_address', normalizedWallet);

    if (eventsError) {
    }

    // Aggregate XP by event type
    const eventXp: Record<string, { count: number; xp: number }> = {};
    let totalActionXp = 0;

    (eventsData || []).forEach((event) => {
      const type = event.event_type;
      if (!eventXp[type]) {
        eventXp[type] = { count: 0, xp: 0 };
      }
      eventXp[type].count += 1;
      eventXp[type].xp += event.xp_awarded || 0;
      totalActionXp += event.xp_awarded || 0;
    });

    // Calculate challenge XP
    const totalChallengeXp = (challengesData || []).reduce(
      (sum, c) => sum + (c.xp_awarded || 0),
      0
    );

    // Map event types to user-friendly labels
    const labelMap: Record<string, string> = {
      order_created: 'Orders Created',
      order_filled: 'Orders Filled (as buyer)',
      order_filled_as_maker: 'Orders Filled (as seller)',
      trade_completed: 'Volume Bonus',
      proceeds_claimed: 'Proceeds Claimed',
      order_cancelled: 'Orders Cancelled',
      wallet_connected: 'Wallet Connected',
    };

    const xpBreakdown = Object.entries(eventXp).map(([type, data]) => ({
      source: labelMap[type] || type,
      event_type: type,
      count: data.count,
      xp: data.xp,
    })).sort((a, b) => b.xp - a.xp);

    // If user doesn't exist yet, return empty/default data
    if (!userData) {
      return NextResponse.json({
        success: true,
        data: {
          stats: {
            wallet_address: normalizedWallet,
            total_xp: 0,
            current_prestige: 0,
            total_orders_created: 0,
            total_orders_filled: 0,
            total_orders_cancelled: 0,
            total_volume_usd: 0,
            total_trades: 0,
            unique_tokens_traded: 0,
            current_active_orders: 0,
            longest_streak_days: 0,
            current_streak_days: 0,
            last_trade_date: null,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          } as UserStats,
          completed_challenges: [],
          xp_breakdown: {
            total_xp: 0,
            action_xp: 0,
            challenge_xp: 0,
            by_source: [],
          },
        },
      });
    }

    return NextResponse.json({
      success: true,
      data: {
        stats: userData as UserStats,
        completed_challenges: challengesData || [],
        xp_breakdown: {
          total_xp: userData.total_xp || 0,
          action_xp: totalActionXp,
          challenge_xp: totalChallengeXp,
          by_source: xpBreakdown,
        },
      },
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
