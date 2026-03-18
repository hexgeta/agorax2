import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { verifySessionToken } from '@/lib/auth';
import { hashWallet, isAdminWallet } from '@/lib/feedback-hash';

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

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
  if (entry.count >= MAX_REQUESTS_PER_WINDOW) return false;
  entry.count++;
  return true;
}

// POST /api/feedback/vote - Toggle vote
// Body: { post_id }
// Requires: Authorization: Bearer <token>
export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ success: false, error: 'Authentication required' }, { status: 401 });
    }
    const verifiedWallet = verifySessionToken(authHeader.slice(7));
    if (!verifiedWallet) {
      return NextResponse.json({ success: false, error: 'Invalid session token' }, { status: 401 });
    }

    // Admins cannot vote
    if (isAdminWallet(verifiedWallet)) {
      return NextResponse.json({ success: false, error: 'Admins cannot vote' }, { status: 403 });
    }

    // Hash immediately — raw wallet never touches the database
    const walletHash = hashWallet(verifiedWallet);

    const body = await request.json();
    const { post_id } = body;

    if (!post_id || typeof post_id !== 'number') {
      return NextResponse.json({ success: false, error: 'Valid post_id required' }, { status: 400 });
    }
    if (!checkRateLimit(`vote:${walletHash}`)) {
      return NextResponse.json({ success: false, error: 'Rate limit exceeded' }, { status: 429 });
    }

    // Check if already voted
    const { data: existing } = await supabase
      .from('feedback_votes')
      .select('id')
      .eq('post_id', post_id)
      .eq('wallet_address', walletHash)
      .single();

    if (existing) {
      // Check if user is the post author — authors can't remove their own vote
      const { data: postData } = await supabase
        .from('feedback_posts')
        .select('wallet_address')
        .eq('id', post_id)
        .single();
      if (postData && postData.wallet_address === walletHash) {
        return NextResponse.json({ success: false, error: 'You cannot remove your vote from your own post' }, { status: 403 });
      }

      // Remove vote
      await supabase.from('feedback_votes').delete().eq('id', existing.id);
      const { data: post } = await supabase.from('feedback_posts').select('vote_count').eq('id', post_id).single();
      if (post) {
        await supabase.from('feedback_posts').update({ vote_count: Math.max(0, post.vote_count - 1) }).eq('id', post_id);
      }

      return NextResponse.json({ success: true, voted: false });
    } else {
      // Add vote
      const { error } = await supabase.from('feedback_votes').insert({
        post_id,
        wallet_address: walletHash,
      });

      if (error) {
        return NextResponse.json({ success: false, error: 'Failed to vote' }, { status: 500 });
      }

      // Increment count
      const { data: post } = await supabase.from('feedback_posts').select('vote_count').eq('id', post_id).single();
      if (post) {
        await supabase.from('feedback_posts').update({ vote_count: post.vote_count + 1 }).eq('id', post_id);
      }

      return NextResponse.json({ success: true, voted: true });
    }
  } catch {
    return NextResponse.json({ success: false, error: 'Invalid request body' }, { status: 400 });
  }
}
