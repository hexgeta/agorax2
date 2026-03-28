const BOT_TOKEN = () => process.env.TELEGRAM_BOT_TOKEN ?? '';
const CHAT_ID = () => process.env.TELEGRAM_CHAT_ID ?? '';

export async function sendTelegram(text: string): Promise<boolean> {
  const token = BOT_TOKEN();
  const chatId = CHAT_ID();
  if (!token || !chatId) {
    console.warn('[telegram] Missing TELEGRAM_BOT_TOKEN or TELEGRAM_CHAT_ID');
    return false;
  }

  try {
    const res = await fetch(
      `https://api.telegram.org/bot${token}/sendMessage`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: chatId,
          text,
          disable_web_page_preview: true,
        }),
      }
    );
    if (!res.ok) {
      const body = await res.text();
      console.error(`[telegram] ${res.status}: ${body}`);
    }
    return res.ok;
  } catch (err) {
    console.error('[telegram] Send failed:', err);
    return false;
  }
}
