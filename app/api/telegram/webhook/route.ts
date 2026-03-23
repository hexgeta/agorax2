import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || '';

async function sendMessage(chatId: string | number, text: string) {
  await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text }),
  });
}

/**
 * Telegram Bot Webhook - handles /start commands with deep link codes.
 * Flow: User clicks link with start code -> bot receives this webhook ->
 * we look up the pending subscription and activate it with the user's chat_id.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const message = body?.message;
    if (!message?.text || !message?.chat?.id) {
      return NextResponse.json({ ok: true });
    }

    const chatId = String(message.chat.id);
    const text = message.text.trim();

    // Handle /start with deep link code: /start <code>
    if (text.startsWith('/start')) {
      const parts = text.split(' ');
      const linkCode = parts[1];

      if (!linkCode) {
        await sendMessage(chatId, 'Welcome to AgoraX Notifications Bot! To subscribe, use the link from the AgoraX notifications page.');
        return NextResponse.json({ ok: true });
      }

      // Look up the pending subscription by link code
      const { data: sub, error } = await supabase
        .from('telegram_subscriptions')
        .select('*')
        .eq('telegram_chat_id', `pending:${linkCode}`)
        .single();

      if (error || !sub) {
        await sendMessage(chatId, 'This link code is invalid or has expired. Please generate a new one from the AgoraX notifications page.');
        return NextResponse.json({ ok: true });
      }

      // Activate the subscription with the real chat_id
      const { error: updateError } = await supabase
        .from('telegram_subscriptions')
        .update({
          telegram_chat_id: chatId,
          is_active: true,
          updated_at: new Date().toISOString(),
        })
        .eq('id', sub.id);

      if (updateError) {
        await sendMessage(chatId, 'Something went wrong activating your notifications. Please try again.');
        return NextResponse.json({ ok: true });
      }

      const shortWallet = `${sub.wallet_address.slice(0, 6)}...${sub.wallet_address.slice(-4)}`;
      await sendMessage(chatId, `Notifications activated for wallet ${shortWallet}! You'll receive alerts when your orders are filled.`);
      return NextResponse.json({ ok: true });
    }

    // Handle /stop - unsubscribe
    if (text === '/stop') {
      const { error } = await supabase
        .from('telegram_subscriptions')
        .update({ is_active: false, updated_at: new Date().toISOString() })
        .eq('telegram_chat_id', chatId);

      if (error) {
        await sendMessage(chatId, 'Something went wrong. Please try again.');
      } else {
        await sendMessage(chatId, 'Notifications disabled. You can re-enable them from the AgoraX notifications page.');
      }
      return NextResponse.json({ ok: true });
    }

    // Default response
    await sendMessage(chatId, 'Commands:\n/stop - Disable notifications\n\nTo subscribe, use the link from the AgoraX notifications page.');
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: true });
  }
}
