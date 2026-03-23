import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { randomBytes } from 'crypto';

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

const BOT_USERNAME = process.env.TELEGRAM_BOT_USERNAME || 'AgoraXBot';

/**
 * POST /api/telegram/subscribe
 * Body: { walletAddress: string }
 *
 * Creates a pending subscription with a short link code.
 * User messages the bot with /start <code> to activate.
 */
export async function POST(req: NextRequest) {
  try {
    const { walletAddress } = await req.json();
    if (!walletAddress || typeof walletAddress !== 'string') {
      return NextResponse.json({ error: 'Missing walletAddress' }, { status: 400 });
    }

    const wallet = walletAddress.toLowerCase();
    const linkCode = randomBytes(4).toString('hex'); // short 8-char code

    const { error } = await supabase
      .from('telegram_subscriptions')
      .upsert({
        wallet_address: wallet,
        telegram_chat_id: `pending:${linkCode}`,
        is_active: false,
        updated_at: new Date().toISOString(),
      }, {
        onConflict: 'wallet_address',
      });

    if (error) {
      console.error('Telegram subscribe error:', error);
      return NextResponse.json({ error: `Failed to create subscription: ${error.message}` }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      linkCode,
      botUsername: BOT_USERNAME,
    });
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * DELETE /api/telegram/subscribe
 * Body: { walletAddress: string }
 *
 * Deactivates a subscription.
 */
export async function DELETE(req: NextRequest) {
  try {
    const { walletAddress } = await req.json();
    if (!walletAddress || typeof walletAddress !== 'string') {
      return NextResponse.json({ error: 'Missing walletAddress' }, { status: 400 });
    }

    const wallet = walletAddress.toLowerCase();

    const { error } = await supabase
      .from('telegram_subscriptions')
      .update({ is_active: false, updated_at: new Date().toISOString() })
      .eq('wallet_address', wallet);

    if (error) {
      return NextResponse.json({ error: 'Failed to unsubscribe' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
