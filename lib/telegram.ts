/**
 * Server-side Telegram notification utility.
 * Sends messages to a private Telegram chat via Bot API (HTML parse mode).
 *
 * Required env vars:
 *   TELEGRAM_BOT_TOKEN  — from @BotFather
 *   TELEGRAM_CHAT_ID_BOT   — bot DM chat ID (fallback)
 *   TELEGRAM_CHAT_ID_GROUP — group chat ID (preferred)
 *
 * All sends are fire-and-forget (never block the caller).
 */

const BOT_TOKEN = () => process.env.TELEGRAM_BOT_TOKEN || '';
const CHAT_ID = () => process.env.TELEGRAM_CHAT_ID_GROUP || process.env.TELEGRAM_CHAT_ID_BOT || '';

function isConfigured(): boolean {
  return BOT_TOKEN().length > 0 && CHAT_ID().length > 0;
}

/**
 * Escape special characters for Telegram HTML mode.
 */
export function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/**
 * Send a Telegram message (HTML format).
 * Logs errors but never crashes the caller.
 */
export async function sendTelegram(text: string): Promise<void> {
  if (!isConfigured()) return;
  try {
    const res = await fetch(`https://api.telegram.org/bot${BOT_TOKEN()}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: CHAT_ID(),
        text,
        parse_mode: 'HTML',
        disable_web_page_preview: true,
      }),
    });
    if (!res.ok) {
      const body = await res.text();
      console.error(`[telegram] sendTelegram failed ${res.status}: ${body}`);
    }
  } catch (err) {
    console.error('[telegram] sendTelegram error:', err);
  }
}

/**
 * Send a Telegram message to a specific user's chat (by chat_id).
 * Used for per-user notifications (e.g. order fill alerts).
 */
export async function sendTelegramToUser(chatId: string, text: string): Promise<boolean> {
  const token = BOT_TOKEN();
  if (!token) return false;
  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: 'HTML',
        disable_web_page_preview: true,
      }),
    });
    if (!res.ok) {
      const body = await res.text();
      console.error(`[telegram] sendTelegramToUser failed ${res.status}: ${body}`);
    }
    return res.ok;
  } catch (err) {
    console.error('[telegram] sendTelegramToUser error:', err);
    return false;
  }
}

// ── Notification helpers ──────────────────────────────────────────────

export function notifyNewOrder(order: {
  orderId: string | number;
  maker: string;
  sellToken: string;
  sellAmount: string;
  buyTokens: string[];
  buyAmounts: string[];
  allOrNothing: boolean;
  expiration: string | number;
}) {
  const lines = [
    `🆕 <b>New Order #${esc(String(order.orderId))}</b>`,
    ``,
    `<b>Maker:</b> <code>${esc(order.maker)}</code>`,
    `<b>Selling:</b> ${esc(order.sellAmount)} ${esc(order.sellToken)}`,
  ];

  for (let i = 0; i < order.buyTokens.length; i++) {
    lines.push(`<b>Wants:</b> ${esc(order.buyAmounts[i] || '?')} ${esc(order.buyTokens[i] || '?')}`);
  }

  if (order.allOrNothing) lines.push(`⚠️ <i>All or nothing</i>`);
  const exp = Number(order.expiration);
  if (exp > 0) {
    const date = new Date(exp * 1000).toISOString().replace('T', ' ').slice(0, 19);
    lines.push(`⏰ <i>Expires: ${esc(date)} UTC</i>`);
  }

  sendTelegram(lines.join('\n'));
}

export function notifyOrderFilled(chatId: string, fill: {
  orderId: string | number;
  fillAmount: string;
  fillToken: string;
  fillerAddress: string;
  fillPercentage: number;
  txHash: string;
}) {
  const totalPct = fill.fillPercentage >= 100 ? '100%' : `${fill.fillPercentage.toFixed(1)}%`;
  const shortFiller = `${fill.fillerAddress.slice(0, 6)}...${fill.fillerAddress.slice(-4)}`;
  const txUrl = `https://otter.pulsechain.com/tx/${fill.txHash}`;
  const lines = [
    `🔔 <b>New Fill on Order #${esc(String(fill.orderId))}</b>`,
    ``,
    `<b>Amount:</b> ${esc(fill.fillAmount)} ${esc(fill.fillToken)}`,
    `<b>By:</b> <code>${esc(shortFiller)}</code>`,
    `<b>Total Filled So Far:</b> ${esc(totalPct)}`,
    ``,
    `<a href="${txUrl}">View Tx</a>`,
  ];

  sendTelegramToUser(chatId, lines.join('\n'));
}

export function notifyOrderFilledGroup(fill: {
  orderId: string | number;
  makerAddress: string;
  fillAmount: string;
  fillToken: string;
  fillerAddress: string;
  fillPercentage: number;
  txHash: string;
}) {
  const totalPct = fill.fillPercentage >= 100 ? '100%' : `${fill.fillPercentage.toFixed(1)}%`;
  const shortMaker = `${fill.makerAddress.slice(0, 6)}...${fill.makerAddress.slice(-4)}`;
  const shortFiller = `${fill.fillerAddress.slice(0, 6)}...${fill.fillerAddress.slice(-4)}`;
  const txUrl = `https://otter.pulsechain.com/tx/${fill.txHash}`;
  const lines = [
    `✅ <b>New Fill on Order #${esc(String(fill.orderId))}</b>`,
    ``,
    `<b>Maker:</b> <code>${esc(shortMaker)}</code>`,
    `<b>Filler:</b> <code>${esc(shortFiller)}</code>`,
    `<b>Amount:</b> ${esc(fill.fillAmount)} ${esc(fill.fillToken)}`,
    `<b>Total Filled So Far:</b> ${esc(totalPct)}`,
    ``,
    `<a href="${txUrl}">View Tx</a>`,
  ];

  sendTelegram(lines.join('\n'));
}

export function notifyNewFeedback(post: {
  id: number;
  title: string;
  category: string;
  description?: string | null;
  tokenTicker?: string | null;
  tokenContract?: string | null;
}) {
  const cat = post.category.toUpperCase();
  const lines = [
    `💬 <b>New Feedback #${esc(String(post.id))}</b>`,
    ``,
    `<b>Category:</b> ${esc(cat)}`,
    `<b>Title:</b> ${esc(post.title)}`,
  ];

  if (post.description) {
    const desc = post.description.length > 200 ? post.description.slice(0, 200) + '...' : post.description;
    lines.push(`<b>Description:</b> ${esc(desc)}`);
  }

  if (post.tokenTicker) {
    lines.push(`<b>Token:</b> ${esc(post.tokenTicker)}${post.tokenContract ? ` (<code>${esc(post.tokenContract)}</code>)` : ''}`);
  }

  sendTelegram(lines.join('\n'));
}

export function notifyNewComment(comment: {
  postId: number;
  postTitle: string;
  displayName: string;
  content: string;
}) {
  const content = comment.content.length > 200 ? comment.content.slice(0, 200) + '...' : comment.content;
  const lines = [
    `💬 <b>New Comment on #${esc(String(comment.postId))}</b>`,
    ``,
    `<b>Post:</b> ${esc(comment.postTitle)}`,
    `<b>By:</b> ${esc(comment.displayName)}`,
    `<b>Comment:</b> ${esc(content)}`,
  ];
  sendTelegram(lines.join('\n'));
}

export function notifyNewVote(vote: {
  postId: number;
  postTitle: string;
  voteCount: number;
  displayName: string;
}) {
  const lines = [
    `👍 <b>Upvote on #${esc(String(vote.postId))}</b>`,
    ``,
    `<b>Post:</b> ${esc(vote.postTitle)}`,
    `<b>By:</b> ${esc(vote.displayName)}`,
    `<b>Total votes:</b> ${esc(String(vote.voteCount))}`,
  ];
  sendTelegram(lines.join('\n'));
}
