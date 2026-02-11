import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

// Rate limiting
const RATE_LIMIT_WINDOW_MS = 60000;
const MAX_REQUESTS_PER_WINDOW = 30;
const rateLimitCache = new Map<string, { count: number; resetTime: number }>();

function checkRateLimit(key: string): boolean {
  const now = Date.now();
  const entry = rateLimitCache.get(key);

  if (!entry || now > entry.resetTime) {
    rateLimitCache.set(key, { count: 1, resetTime: now + RATE_LIMIT_WINDOW_MS });
    return true;
  }

  if (entry.count >= MAX_REQUESTS_PER_WINDOW) {
    return false;
  }

  entry.count++;
  return true;
}

function isValidWalletAddress(address: string): boolean {
  return /^0x[a-fA-F0-9]{40}$/.test(address);
}

// GET /api/favorites?wallet=0x...
// Returns all favorite order IDs for a wallet
export async function GET(request: NextRequest) {
  const wallet = request.nextUrl.searchParams.get('wallet');

  if (!wallet || !isValidWalletAddress(wallet)) {
    return NextResponse.json(
      { success: false, error: 'Valid wallet address required' },
      { status: 400 }
    );
  }

  if (!checkRateLimit(`get:${wallet.toLowerCase()}`)) {
    return NextResponse.json(
      { success: false, error: 'Rate limit exceeded' },
      { status: 429 }
    );
  }

  const { data, error } = await supabase
    .from('user_favorites')
    .select('order_id, created_at')
    .eq('wallet_address', wallet.toLowerCase())
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching favorites:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch favorites' },
      { status: 500 }
    );
  }

  return NextResponse.json({
    success: true,
    favorites: data.map((f: { order_id: number; created_at: string }) => f.order_id),
  });
}

// POST /api/favorites
// Body: { wallet_address: string, order_id: number }
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { wallet_address, order_id } = body;

    if (!wallet_address || !isValidWalletAddress(wallet_address)) {
      return NextResponse.json(
        { success: false, error: 'Valid wallet address required' },
        { status: 400 }
      );
    }

    if (order_id === undefined || order_id === null || typeof order_id !== 'number') {
      return NextResponse.json(
        { success: false, error: 'Valid order_id required' },
        { status: 400 }
      );
    }

    if (!checkRateLimit(`post:${wallet_address.toLowerCase()}`)) {
      return NextResponse.json(
        { success: false, error: 'Rate limit exceeded' },
        { status: 429 }
      );
    }

    const { error } = await supabase
      .from('user_favorites')
      .upsert(
        {
          wallet_address: wallet_address.toLowerCase(),
          order_id,
        },
        { onConflict: 'wallet_address,order_id' }
      );

    if (error) {
      console.error('Error adding favorite:', error);
      return NextResponse.json(
        { success: false, error: 'Failed to add favorite' },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json(
      { success: false, error: 'Invalid request body' },
      { status: 400 }
    );
  }
}

// DELETE /api/favorites
// Body: { wallet_address: string, order_id: number }
export async function DELETE(request: NextRequest) {
  try {
    const body = await request.json();
    const { wallet_address, order_id } = body;

    if (!wallet_address || !isValidWalletAddress(wallet_address)) {
      return NextResponse.json(
        { success: false, error: 'Valid wallet address required' },
        { status: 400 }
      );
    }

    if (order_id === undefined || order_id === null || typeof order_id !== 'number') {
      return NextResponse.json(
        { success: false, error: 'Valid order_id required' },
        { status: 400 }
      );
    }

    if (!checkRateLimit(`delete:${wallet_address.toLowerCase()}`)) {
      return NextResponse.json(
        { success: false, error: 'Rate limit exceeded' },
        { status: 429 }
      );
    }

    const { error } = await supabase
      .from('user_favorites')
      .delete()
      .eq('wallet_address', wallet_address.toLowerCase())
      .eq('order_id', order_id);

    if (error) {
      console.error('Error removing favorite:', error);
      return NextResponse.json(
        { success: false, error: 'Failed to remove favorite' },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json(
      { success: false, error: 'Invalid request body' },
      { status: 400 }
    );
  }
}
