-- Add blacklist columns to users table
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS is_blacklisted BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS blacklist_reason TEXT,
  ADD COLUMN IF NOT EXISTS blacklisted_at TIMESTAMP WITH TIME ZONE;

-- Index for fast blacklist lookups
CREATE INDEX IF NOT EXISTS idx_users_blacklisted
  ON users(wallet_address) WHERE is_blacklisted = TRUE;

-- Recreate leaderboard view to exclude blacklisted users
CREATE OR REPLACE VIEW leaderboard AS
SELECT
  wallet_address,
  total_xp,
  action_xp,
  current_prestige,
  total_orders_created,
  total_orders_filled,
  total_trades,
  total_volume_usd,
  RANK() OVER (ORDER BY total_xp DESC) as rank
FROM users
WHERE is_blacklisted = FALSE
ORDER BY total_xp DESC;
