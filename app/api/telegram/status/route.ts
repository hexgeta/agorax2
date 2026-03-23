import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

/**
 * GET /api/telegram/status?wallet=0x...
 * Returns the subscription status for a wallet.
 */
export async function GET(req: NextRequest) {
  const wallet = req.nextUrl.searchParams.get('wallet')?.toLowerCase();
  if (!wallet) {
    return NextResponse.json({ error: 'Missing wallet parameter' }, { status: 400 });
  }

  const { data, error } = await supabase
    .from('telegram_subscriptions')
    .select('is_active, telegram_chat_id, notify_fills, notify_cancellations, updated_at')
    .eq('wallet_address', wallet)
    .single();

  if (error || !data) {
    return NextResponse.json({ subscribed: false });
  }

  const isPending = data.telegram_chat_id.startsWith('pending:');

  return NextResponse.json({
    subscribed: data.is_active && !isPending,
    pending: isPending,
    notifyFills: data.notify_fills,
    notifyCancellations: data.notify_cancellations,
    updatedAt: data.updated_at,
  });
}
