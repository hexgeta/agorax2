import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createHash } from 'crypto';
import { verifySessionToken } from '@/lib/auth';

function hashWalletToUserId(wallet: string): string {
  const hash = createHash('sha256').update(wallet.toLowerCase()).digest('hex');
  const num = parseInt(hash.slice(0, 8), 16) % 10000;
  return `User #${num}`;
}

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

const RATE_LIMIT_WINDOW_MS = 60000;
const MAX_REQUESTS_PER_WINDOW = 15;
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

// GET /api/feedback/comment?post_id=123
export async function GET(request: NextRequest) {
  const postId = request.nextUrl.searchParams.get('post_id');
  if (!postId) {
    return NextResponse.json({ success: false, error: 'post_id required' }, { status: 400 });
  }

  const { data, error } = await supabase
    .from('feedback_comments')
    .select('*')
    .eq('post_id', parseInt(postId))
    .order('created_at', { ascending: true });

  if (error) {
    return NextResponse.json({ success: false, error: 'Failed to fetch comments' }, { status: 500 });
  }

  // Hash wallet addresses for privacy
  const sanitizedComments = (data || []).map((c: Record<string, unknown>) => ({
    ...c,
    wallet_address: hashWalletToUserId(c.wallet_address as string),
  }));

  return NextResponse.json({ success: true, comments: sanitizedComments });
}

// POST /api/feedback/comment
// Body: { post_id, content }
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

    const body = await request.json();
    const { post_id, content } = body;

    if (!post_id || typeof post_id !== 'number') {
      return NextResponse.json({ success: false, error: 'Valid post_id required' }, { status: 400 });
    }
    if (!content || typeof content !== 'string' || content.trim().length < 1 || content.trim().length > 2000) {
      return NextResponse.json({ success: false, error: 'Comment must be 1-2000 characters' }, { status: 400 });
    }
    if (!checkRateLimit(`comment:${verifiedWallet}`)) {
      return NextResponse.json({ success: false, error: 'Rate limit exceeded' }, { status: 429 });
    }

    const { data, error } = await supabase
      .from('feedback_comments')
      .insert({
        post_id,
        wallet_address: verifiedWallet,
        content: content.trim(),
      })
      .select()
      .single();

    if (error) {
      return NextResponse.json({ success: false, error: 'Failed to add comment' }, { status: 500 });
    }

    // Update comment count on post
    const { data: post } = await supabase.from('feedback_posts').select('comment_count').eq('id', post_id).single();
    if (post) {
      await supabase.from('feedback_posts').update({ comment_count: post.comment_count + 1 }).eq('id', post_id);
    }

    return NextResponse.json({ success: true, comment: { ...data, wallet_address: hashWalletToUserId(data.wallet_address) } });
  } catch {
    return NextResponse.json({ success: false, error: 'Invalid request body' }, { status: 400 });
  }
}
