-- Telegram notification subscriptions
-- Stores wallet_address -> telegram chat_id mapping
-- Privacy note: wallet addresses are already public on-chain,
-- and Telegram chat_ids are opaque numbers that don't reveal identity.

CREATE TABLE IF NOT EXISTS telegram_subscriptions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  wallet_address TEXT NOT NULL,
  telegram_chat_id TEXT NOT NULL,
  is_active BOOLEAN DEFAULT true,
  notify_fills BOOLEAN DEFAULT true,
  notify_cancellations BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(wallet_address)
);

-- Index for looking up subscriptions by wallet (used by cron on fill)
CREATE INDEX IF NOT EXISTS idx_telegram_subs_wallet ON telegram_subscriptions(wallet_address) WHERE is_active = true;
