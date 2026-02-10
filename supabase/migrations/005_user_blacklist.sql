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

-- Rename 'humiliation' category to 'wildcard' in existing completed challenges
UPDATE completed_challenges SET category = 'wildcard' WHERE category = 'humiliation';

-- Update can_advance_legion to exclude 'wildcard' instead of 'humiliation'
CREATE OR REPLACE FUNCTION can_advance_legion(
  p_wallet_address TEXT,
  p_current_legion INTEGER,
  p_required_xp INTEGER
)
RETURNS BOOLEAN AS $$
DECLARE
  v_normalized_wallet TEXT;
  v_user_xp INTEGER;
  v_challenges_complete INTEGER;
  v_required_challenges INTEGER;
BEGIN
  v_normalized_wallet := LOWER(p_wallet_address);

  -- Get user's total XP
  SELECT COALESCE(total_xp, 0) INTO v_user_xp
  FROM users WHERE wallet_address = v_normalized_wallet;

  -- Check XP requirement
  IF v_user_xp < p_required_xp THEN
    RETURN FALSE;
  END IF;

  -- Count completed required challenges for current legion (exclude wildcards)
  SELECT COUNT(*) INTO v_challenges_complete
  FROM completed_challenges
  WHERE wallet_address = v_normalized_wallet
    AND prestige_level = p_current_legion
    AND category != 'wildcard';

  -- For now, return true if XP is met (challenge check is done in frontend)
  RETURN TRUE;
END;
$$ LANGUAGE plpgsql;
