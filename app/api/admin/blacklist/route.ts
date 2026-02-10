import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

function isAuthorized(request: NextRequest): boolean {
  const authHeader = request.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) return false;
  const token = authHeader.slice(7);
  const secret = process.env.ADMIN_SECRET;
  if (!secret) return false;
  return token === secret;
}

/**
 * POST /api/admin/blacklist
 * Body: { wallet_address: string, reason?: string }
 *
 * Blacklists a wallet — stops all XP accrual and hides from leaderboard.
 * Also zeroes out their XP and prestige so they can't sit on ill-gotten gains.
 */
export async function POST(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  const { wallet_address, reason } = await request.json();

  if (!wallet_address || !/^0x[a-fA-F0-9]{40}$/.test(wallet_address)) {
    return NextResponse.json({ success: false, error: 'Invalid wallet address' }, { status: 400 });
  }

  const normalized = wallet_address.toLowerCase();

  const { error } = await supabase
    .from('users')
    .update({
      is_blacklisted: true,
      blacklist_reason: reason || null,
      blacklisted_at: new Date().toISOString(),
      total_xp: 0,
      action_xp: 0,
      current_prestige: 0,
    })
    .eq('wallet_address', normalized);

  if (error) {
    console.error('Blacklist error:', error);
    return NextResponse.json({ success: false, error: 'Database error' }, { status: 500 });
  }

  return NextResponse.json({ success: true, wallet_address: normalized, action: 'blacklisted' });
}

/**
 * DELETE /api/admin/blacklist?wallet_address=0x...
 *
 * Removes the blacklist flag. XP stays at 0 — they start over.
 */
export async function DELETE(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const wallet_address = searchParams.get('wallet_address');

  if (!wallet_address || !/^0x[a-fA-F0-9]{40}$/.test(wallet_address)) {
    return NextResponse.json({ success: false, error: 'Invalid wallet address' }, { status: 400 });
  }

  const normalized = wallet_address.toLowerCase();

  const { error } = await supabase
    .from('users')
    .update({
      is_blacklisted: false,
      blacklist_reason: null,
      blacklisted_at: null,
    })
    .eq('wallet_address', normalized);

  if (error) {
    console.error('Unblacklist error:', error);
    return NextResponse.json({ success: false, error: 'Database error' }, { status: 500 });
  }

  return NextResponse.json({ success: true, wallet_address: normalized, action: 'unblacklisted' });
}

/**
 * GET /api/admin/blacklist
 *
 * Lists all currently blacklisted wallets.
 */
export async function GET(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  const { data, error } = await supabase
    .from('users')
    .select('wallet_address, blacklist_reason, blacklisted_at')
    .eq('is_blacklisted', true)
    .order('blacklisted_at', { ascending: false });

  if (error) {
    console.error('Blacklist list error:', error);
    return NextResponse.json({ success: false, error: 'Database error' }, { status: 500 });
  }

  return NextResponse.json({ success: true, data });
}
