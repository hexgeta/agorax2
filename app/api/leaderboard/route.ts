import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import type { LeaderboardEntry } from '@/types/events';

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY!;

const supabase = createClient(supabaseUrl, supabaseAnonKey);

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const { searchParams } = new URL(request.url);
    const limit = Math.min(parseInt(searchParams.get('limit') || '100', 10), 500);
    const offset = parseInt(searchParams.get('offset') || '0', 10);

    // Try to use the leaderboard view first
    const { data: leaderboardData, error } = await supabase
      .from('leaderboard')
      .select('*')
      .range(offset, offset + limit - 1);

    if (error) {
      // Fallback to direct query if view doesn't exist
      console.log('Leaderboard view not available, using direct query');

      const { data: fallbackData, error: fallbackError } = await supabase
        .from('users')
        .select(
          'wallet_address, total_xp, current_prestige, total_orders_created, total_orders_filled, total_trades, total_volume_usd'
        )
        .neq('is_blacklisted', true)
        .order('total_xp', { ascending: false })
        .range(offset, offset + limit - 1);

      if (fallbackError) {
        console.error('Error fetching leaderboard:', fallbackError);
        return NextResponse.json(
          { success: false, error: 'Failed to fetch leaderboard' },
          { status: 500 }
        );
      }

      // Add rank manually
      const rankedData: LeaderboardEntry[] = (fallbackData || []).map((user, index) => ({
        ...user,
        rank: offset + index + 1,
      }));

      return NextResponse.json({
        success: true,
        data: rankedData,
      });
    }

    return NextResponse.json({
      success: true,
      data: leaderboardData as LeaderboardEntry[],
    });
  } catch (error) {
    console.error('Error in leaderboard API:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
