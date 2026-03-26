/**
 * Server-side Telegram notification utility.
 * Sends messages to a private Telegram chat via Bot API.
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
 * Send a Telegram message (Markdown V2 format).
 * Silently no-ops if env vars are missing.
 */
export async function sendTelegram(text: string): Promise<void> {
  if (!isConfigured()) return;
  try {
    await fetch(`https://api.telegram.org/bot${BOT_TOKEN()}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: CHAT_ID(),
        text,
        parse_mode: 'MarkdownV2',
        disable_web_page_preview: true,
      }),
    });
  } catch {
    // Fire-and-forget — never crash the caller
  }
}

/**
 * Escape special characters for Telegram MarkdownV2.
 */
export function esc(s: string): string {
  return s.replace(/([_*\[\]()~`>#+\-=|{}.!\\])/g, '\\$1');
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
        parse_mode: 'MarkdownV2',
        disable_web_page_preview: true,
      }),
    });
    return res.ok;
  } catch {
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
    `🆕 *New Order \\#${esc(String(order.orderId))}*`,
    ``,
    `*Maker:* \`${esc(order.maker)}\``,
    `*Selling:* ${esc(order.sellAmount)} ${esc(order.sellToken)}`,
  ];

  for (let i = 0; i < order.buyTokens.length; i++) {
    lines.push(`*Wants:* ${esc(order.buyAmounts[i] || '?')} ${esc(order.buyTokens[i] || '?')}`);
  }

  if (order.allOrNothing) lines.push(`⚠️ _All or nothing_`);
  const exp = Number(order.expiration);
  if (exp > 0) {
    const date = new Date(exp * 1000).toISOString().replace('T', ' ').slice(0, 19);
    lines.push(`⏰ _Expires: ${esc(date)} UTC_`);
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
  const lines = [
    `🔔 *New Fill on Order \\#${esc(String(fill.orderId))}*`,
    ``,
    `*Amount:* ${esc(fill.fillAmount)} ${esc(fill.fillToken)}`,
    `*By:* \`${esc(shortFiller)}\``,
    `*Total Filled So Far:* ${esc(totalPct)}`,
    ``,
    `[View Tx](https://otter.pulsechain.com/tx/${esc(fill.txHash)})`,
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
  const lines = [
    `✅ *New Fill on Order \\#${esc(String(fill.orderId))}*`,
    ``,
    `*Maker:* \`${esc(shortMaker)}\``,
    `*Filler:* \`${esc(shortFiller)}\``,
    `*Amount:* ${esc(fill.fillAmount)} ${esc(fill.fillToken)}`,
    `*Total Filled So Far:* ${esc(totalPct)}`,
    ``,
    `[View Tx](https://otter.pulsechain.com/tx/${esc(fill.txHash)})`,
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
    `💬 *New Feedback \\#${esc(String(post.id))}*`,
    ``,
    `*Category:* ${esc(cat)}`,
    `*Title:* ${esc(post.title)}`,
  ];

  if (post.description) {
    const desc = post.description.length > 200 ? post.description.slice(0, 200) + '...' : post.description;
    lines.push(`*Description:* ${esc(desc)}`);
  }

  if (post.tokenTicker) {
    lines.push(`*Token:* ${esc(post.tokenTicker)}${post.tokenContract ? ` \\(\`${esc(post.tokenContract)}\`\\)` : ''}`);
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
    `💬 *New Comment on \\#${esc(String(comment.postId))}*`,
    ``,
    `*Post:* ${esc(comment.postTitle)}`,
    `*By:* ${esc(comment.displayName)}`,
    `*Comment:* ${esc(content)}`,
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
    `👍 *Upvote on \\#${esc(String(vote.postId))}*`,
    ``,
    `*Post:* ${esc(vote.postTitle)}`,
    `*By:* ${esc(vote.displayName)}`,
    `*Total votes:* ${esc(String(vote.voteCount))}`,
  ];
  sendTelegram(lines.join('\n'));
}
