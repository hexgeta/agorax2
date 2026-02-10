import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { checkRateLimit, RATE_LIMITS } from '@/lib/rate-limit';

// We need dynamic for query params
export const dynamic = 'force-dynamic';

// Initialize Supabase client
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export async function GET(request: NextRequest) {
  // Apply rate limiting
  const rateLimitResponse = await checkRateLimit(request, RATE_LIMITS.data);
  if (rateLimitResponse) {
    return rateLimitResponse;
  }

  try {
    // Check if Supabase is configured
    if (!supabaseUrl || !supabaseKey) {
      return NextResponse.json(
        { error: 'Supabase not configured' },
        { status: 500 }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get query parameters
    const searchParams = request.nextUrl.searchParams;
    const tokenAddress = searchParams.get('token');
    const limit = parseInt(searchParams.get('limit') || '100');

    if (!tokenAddress) {
      return NextResponse.json(
        { error: 'Token address is required' },
        { status: 400 }
      );
    }

    // Validate token address format
    if (!/^0x[a-fA-F0-9]{40}$/.test(tokenAddress)) {
      return NextResponse.json(
        { error: 'Invalid token address format' },
        { status: 400 }
      );
    }

    // Validate limit
    if (limit < 1 || limit > 1000) {
      return NextResponse.json(
        { error: 'Limit must be between 1 and 1000' },
        { status: 400 }
      );
    }

    // Fetch historic prices from Supabase
    const { data, error } = await supabase
      .from('token_prices_historic')
      .select('*')
      .eq('token_address', tokenAddress.toLowerCase())
      .order('timestamp', { ascending: false })
      .limit(limit);

    if (error) {
      throw error;
    }

    return NextResponse.json({
      success: true,
      data: data || [],
      count: data?.length || 0,
    });

  } catch (error) {
    return NextResponse.json(
      {
        error: 'Failed to fetch historic prices',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
