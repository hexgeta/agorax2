import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import {
  LEGION_XP_THRESHOLDS,
  LEGIONS,
  calculateLegionProgress,
  getXpForNextLevel,
  getXpFloor,
} from '@/constants/xp';

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

// Order-related event types for activity history
const ORDER_EVENT_TYPES = [
  'order_created',
  'order_filled',
  'order_cancelled',
  'order_expired',
  'proceeds_claimed',
  'trade_completed',
];

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
      return NextResponse.json(
        { success: false, error: 'Failed to fetch user data' },
        { status: 500 }
      );
    }

    // Fetch order activity history
    const { data: activityData, error: activityError } = await supabase
      .from('user_events')
      .select('id, event_type, event_data, xp_awarded, created_at')
      .eq('wallet_address', normalizedWallet)
      .in('event_type', ORDER_EVENT_TYPES)
      .order('created_at', { ascending: false })
      .limit(100);

    if (activityError) {
    }

    // Default stats for new users
    const defaultStats = {
      wallet_address: normalizedWallet,
      total_xp: 0,
      action_xp: 0,
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
    };

    const stats = userData || defaultStats;
    const currentLegion = stats.current_prestige || 0;

    // Calculate XP progression data
    const xpFloor = getXpFloor(currentLegion);
    const xpCeiling = getXpForNextLevel(currentLegion);
    const xpProgress = calculateLegionProgress(stats.total_xp || 0, currentLegion);
    const xpNeeded = xpCeiling === Infinity ? 0 : xpCeiling - (stats.total_xp || 0);

    // Get legion info
    const currentLegionInfo = LEGIONS[currentLegion] || LEGIONS[0];
    const nextLegionInfo = currentLegion < 8 ? LEGIONS[currentLegion + 1] : null;

    // Fetch completed challenges count for current legion
    const { count: completedChallengesCount } = await supabase
      .from('completed_challenges')
      .select('*', { count: 'exact', head: true })
      .eq('wallet_address', normalizedWallet)
      .eq('prestige_level', currentLegion)
      .neq('category', 'wildcard');

    return NextResponse.json({
      success: true,
      data: {
        stats,
        activity: activityData || [],
        progression: {
          currentLegion: currentLegionInfo,
          nextLegion: nextLegionInfo,
          totalXp: stats.total_xp || 0,
          actionXp: stats.action_xp || 0,
          xpFloor,
          xpCeiling: xpCeiling === Infinity ? null : xpCeiling,
          xpProgress: Math.round(xpProgress * 100) / 100, // Round to 2 decimals
          xpNeeded: xpNeeded > 0 ? xpNeeded : 0,
          challengesCompleted: completedChallengesCount || 0,
          isMaxLevel: currentLegion >= 8,
        },
      },
    });
  } catch {
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
