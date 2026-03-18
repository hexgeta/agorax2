import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

const RATE_LIMIT_WINDOW_MS = 60000;
const MAX_REQUESTS_PER_WINDOW = 10;
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

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];

// POST /api/feedback/upload
// FormData: file (image), wallet_address
export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const walletAddress = formData.get('wallet_address') as string | null;

    if (!walletAddress || !/^0x[a-fA-F0-9]{40}$/.test(walletAddress)) {
      return NextResponse.json({ success: false, error: 'Valid wallet address required' }, { status: 400 });
    }
    if (!checkRateLimit(`upload:${walletAddress.toLowerCase()}`)) {
      return NextResponse.json({ success: false, error: 'Rate limit exceeded' }, { status: 429 });
    }
    if (!file) {
      return NextResponse.json({ success: false, error: 'No file provided' }, { status: 400 });
    }
    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json({ success: false, error: 'Only JPEG, PNG, GIF, and WebP images are allowed' }, { status: 400 });
    }
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json({ success: false, error: 'File size must be under 5MB' }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const ext = file.type.split('/')[1] === 'jpeg' ? 'jpg' : file.type.split('/')[1];
    const fileName = `feedback/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;

    const { error } = await supabase.storage
      .from('feedback-images')
      .upload(fileName, buffer, {
        contentType: file.type,
        cacheControl: '31536000',
      });

    if (error) {
      return NextResponse.json({ success: false, error: 'Failed to upload image' }, { status: 500 });
    }

    const { data: urlData } = supabase.storage
      .from('feedback-images')
      .getPublicUrl(fileName);

    return NextResponse.json({ success: true, url: urlData.publicUrl });
  } catch {
    return NextResponse.json({ success: false, error: 'Upload failed' }, { status: 400 });
  }
}
