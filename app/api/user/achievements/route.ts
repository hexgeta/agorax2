import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import type { UserAchievements, UserStats, LeaderboardEntry } from '@/types/events';

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY!;

const supabase = createClient(supabaseUrl, supabaseAnonKey);

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
      console.error('Error fetching user:', userError);
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
      console.error('Error fetching challenges:', challengesError);
    }

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
        } as UserAchievements,
      });
    }

    return NextResponse.json({
      success: true,
      data: {
        stats: userData as UserStats,
        completed_challenges: challengesData || [],
      } as UserAchievements,
    });
  } catch (error) {
    console.error('Error in achievements API:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
