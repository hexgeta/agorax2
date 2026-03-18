import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

function getAdminWallets(): string[] {
  const raw = process.env.ADMIN_WALLETS || '';
  return raw.split(',').map((w: string) => w.trim().toLowerCase()).filter(Boolean);
}

function isAdminWallet(wallet: string): boolean {
  return getAdminWallets().includes(wallet.toLowerCase());
}

function isValidWalletAddress(address: string): boolean {
  return /^0x[a-fA-F0-9]{40}$/.test(address);
}

/**
 * PATCH /api/admin/feedback
 * Admin actions: update status, mark as duplicate, link duplicate
 *
 * Body: { wallet_address, post_id, action, ... }
 *   action: 'update_status' => { status }
 *   action: 'mark_duplicate' => { duplicate_of } (original post id)
 */
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const { wallet_address, post_id, action } = body;

    if (!wallet_address || !isValidWalletAddress(wallet_address)) {
      return NextResponse.json({ success: false, error: 'Valid wallet address required' }, { status: 400 });
    }
    if (!isAdminWallet(wallet_address)) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 403 });
    }
    if (!post_id || typeof post_id !== 'number') {
      return NextResponse.json({ success: false, error: 'Valid post_id required' }, { status: 400 });
    }

    if (action === 'update_status') {
      const validStatuses = ['open', 'under_review', 'planned', 'in_progress', 'completed', 'declined'];
      if (!validStatuses.includes(body.status)) {
        return NextResponse.json({ success: false, error: 'Invalid status' }, { status: 400 });
      }

      const { data, error } = await supabase
        .from('feedback_posts')
        .update({ status: body.status, duplicate_of: null, updated_at: new Date().toISOString() })
        .eq('id', post_id)
        .select()
        .single();

      if (error) {
        return NextResponse.json({ success: false, error: 'Failed to update status' }, { status: 500 });
      }
      return NextResponse.json({ success: true, post: data });
    }

    if (action === 'mark_duplicate') {
      const { duplicate_of } = body;
      if (!duplicate_of || typeof duplicate_of !== 'number') {
        return NextResponse.json({ success: false, error: 'Valid duplicate_of post id required' }, { status: 400 });
      }
      if (duplicate_of === post_id) {
        return NextResponse.json({ success: false, error: 'A post cannot be a duplicate of itself' }, { status: 400 });
      }

      // Verify original post exists
      const { data: original } = await supabase
        .from('feedback_posts')
        .select('id, title')
        .eq('id', duplicate_of)
        .single();

      if (!original) {
        return NextResponse.json({ success: false, error: 'Original post not found' }, { status: 404 });
      }

      const { data, error } = await supabase
        .from('feedback_posts')
        .update({ status: 'duplicate', duplicate_of, updated_at: new Date().toISOString() })
        .eq('id', post_id)
        .select()
        .single();

      if (error) {
        return NextResponse.json({ success: false, error: 'Failed to mark as duplicate' }, { status: 500 });
      }
      return NextResponse.json({ success: true, post: data, original_post: original });
    }

    return NextResponse.json({ success: false, error: 'Invalid action' }, { status: 400 });
  } catch {
    return NextResponse.json({ success: false, error: 'Invalid request body' }, { status: 400 });
  }
}

/**
 * DELETE /api/admin/feedback
 * Body: { wallet_address, post_id }
 * Permanently deletes a feedback post and its votes/comments (cascade).
 */
export async function DELETE(request: NextRequest) {
  try {
    const body = await request.json();
    const { wallet_address, post_id } = body;

    if (!wallet_address || !isValidWalletAddress(wallet_address)) {
      return NextResponse.json({ success: false, error: 'Valid wallet address required' }, { status: 400 });
    }
    if (!isAdminWallet(wallet_address)) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 403 });
    }
    if (!post_id || typeof post_id !== 'number') {
      return NextResponse.json({ success: false, error: 'Valid post_id required' }, { status: 400 });
    }

    // Clear duplicate_of references pointing to this post first
    await supabase
      .from('feedback_posts')
      .update({ duplicate_of: null, status: 'open' })
      .eq('duplicate_of', post_id);

    const { error } = await supabase
      .from('feedback_posts')
      .delete()
      .eq('id', post_id);

    if (error) {
      return NextResponse.json({ success: false, error: 'Failed to delete post' }, { status: 500 });
    }
    return NextResponse.json({ success: true, deleted: post_id });
  } catch {
    return NextResponse.json({ success: false, error: 'Invalid request body' }, { status: 400 });
  }
}

/**
 * GET /api/admin/feedback/check?wallet=0x...
 * Check if a wallet is an admin.
 */
export async function GET(request: NextRequest) {
  const wallet = request.nextUrl.searchParams.get('wallet');
  if (!wallet || !isValidWalletAddress(wallet)) {
    return NextResponse.json({ isAdmin: false });
  }
  return NextResponse.json({ isAdmin: isAdminWallet(wallet) });
}
