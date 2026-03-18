import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { verifySessionToken } from '@/lib/auth';
import { hashWallet, hashToDisplayName, isAdminWallet } from '@/lib/feedback-hash';
import { notifyNewFeedback } from '@/lib/telegram';

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

const RATE_LIMIT_WINDOW_MS = 60000;
const MAX_REQUESTS_PER_WINDOW = 20;
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

// GET /api/feedback?sort=popular|newest|oldest&category=feature|bug|improvement|question&status=open|...&wallet=0x...
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const sort = searchParams.get('sort') || 'popular';
  const category = searchParams.get('category');
  const status = searchParams.get('status');
  const wallet = searchParams.get('wallet');
  const page = parseInt(searchParams.get('page') || '1');
  const limit = Math.min(parseInt(searchParams.get('limit') || '20'), 50);
  const offset = (page - 1) * limit;

  let query = supabase
    .from('feedback_posts')
    .select('*', { count: 'exact' });

  if (category) query = query.eq('category', category);
  if (status) query = query.eq('status', status);

  if (sort === 'newest') {
    query = query.order('created_at', { ascending: false });
  } else if (sort === 'oldest') {
    query = query.order('created_at', { ascending: true });
  } else {
    // popular (default)
    query = query.order('vote_count', { ascending: false }).order('created_at', { ascending: false });
  }

  query = query.range(offset, offset + limit - 1);

  const { data: posts, error, count } = await query;

  if (error) {
    return NextResponse.json({ success: false, error: 'Failed to fetch feedback' }, { status: 500 });
  }

  // If wallet provided, hash it and fetch which posts user has voted on
  // DB stores hashed wallets, so we hash the incoming wallet to match
  let userVotes: number[] = [];
  if (wallet) {
    const walletHash = hashWallet(wallet);
    const postIds = (posts || []).map((p: { id: number }) => p.id);
    if (postIds.length > 0) {
      const { data: votes } = await supabase
        .from('feedback_votes')
        .select('post_id')
        .eq('wallet_address', walletHash)
        .in('post_id', postIds);
      userVotes = (votes || []).map((v: { post_id: number }) => v.post_id);
    }
  }

  // Fetch original post titles for any duplicate posts
  const duplicateOfIds = (posts || [])
    .filter((p: { duplicate_of: number | null }) => p.duplicate_of)
    .map((p: { duplicate_of: number }) => p.duplicate_of);
  let duplicateOriginals: Record<number, { id: number; title: string }> = {};
  if (duplicateOfIds.length > 0) {
    const { data: originals } = await supabase
      .from('feedback_posts')
      .select('id, title')
      .in('id', duplicateOfIds);
    if (originals) {
      duplicateOriginals = Object.fromEntries(originals.map((o: { id: number; title: string }) => [o.id, o]));
    }
  }

  // Convert stored hashes to display names; admins get labeled "Admin"
  const sanitizedPosts = (posts || []).map((p: Record<string, unknown>) => ({
    ...p,
    wallet_address: p.is_admin ? 'Admin' : hashToDisplayName(p.wallet_address as string),
  }));

  return NextResponse.json({
    success: true,
    posts: sanitizedPosts,
    userVotes,
    duplicateOriginals,
    pagination: { page, limit, total: count || 0 },
  });
}

// POST /api/feedback
// Body: { title, description?, category?, token_ticker?, token_contract_address?, is_tax_token? }
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

    // Hash immediately — raw wallet never touches the database
    const walletHash = hashWallet(verifiedWallet);

    const body = await request.json();
    const { title, description, category, token_ticker, token_contract_address, is_tax_token } = body;

    if (!title || typeof title !== 'string' || title.trim().length < 3 || title.trim().length > 200) {
      return NextResponse.json({ success: false, error: 'Title must be 3-200 characters' }, { status: 400 });
    }
    if (description && typeof description === 'string' && description.length > 5000) {
      return NextResponse.json({ success: false, error: 'Description must be under 5000 characters' }, { status: 400 });
    }

    const validCategories = ['feature', 'bug', 'improvement', 'question', 'whitelist'];
    const postCategory = category && validCategories.includes(category) ? category : 'feature';

    // Validate whitelist-specific fields
    if (postCategory === 'whitelist') {
      if (!token_ticker || typeof token_ticker !== 'string' || token_ticker.trim().length === 0 || token_ticker.trim().length > 20) {
        return NextResponse.json({ success: false, error: 'Token ticker is required (max 20 characters)' }, { status: 400 });
      }
      if (!token_contract_address || !/^0x[a-fA-F0-9]{40}$/.test(token_contract_address)) {
        return NextResponse.json({ success: false, error: 'Valid contract address required' }, { status: 400 });
      }
    }

    if (!checkRateLimit(`feedback:${walletHash}`)) {
      return NextResponse.json({ success: false, error: 'Rate limit exceeded. Try again later.' }, { status: 429 });
    }

    const admin = isAdminWallet(verifiedWallet);

    const insertData: Record<string, unknown> = {
      title: title.trim(),
      description: description?.trim() || null,
      category: postCategory,
      wallet_address: walletHash,
      is_admin: admin,
      vote_count: 1, // Auto-upvote by creator
    };

    if (postCategory === 'whitelist') {
      insertData.token_ticker = token_ticker.trim().toUpperCase();
      insertData.token_contract_address = token_contract_address.toLowerCase();
      insertData.is_tax_token = is_tax_token === true;
    }

    const { data, error } = await supabase
      .from('feedback_posts')
      .insert(insertData)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ success: false, error: 'Failed to create feedback post' }, { status: 500 });
    }

    // Auto-vote for the creator
    await supabase.from('feedback_votes').insert({
      post_id: data.id,
      wallet_address: walletHash,
    });

    // Fire-and-forget Telegram notification
    notifyNewFeedback({
      id: data.id,
      title: data.title,
      category: data.category,
      description: data.description,
      tokenTicker: data.token_ticker,
      tokenContract: data.token_contract_address,
    });

    return NextResponse.json({ success: true, post: { ...data, wallet_address: admin ? 'Admin' : hashToDisplayName(walletHash) } });
  } catch {
    return NextResponse.json({ success: false, error: 'Invalid request body' }, { status: 400 });
  }
}
