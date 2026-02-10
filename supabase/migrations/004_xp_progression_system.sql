-- Migration 004: XP Progression System
-- Run this in your Supabase SQL Editor AFTER previous migrations
-- This migration adds action XP tracking and updates the progression system

-- ============================================
-- 1. Add action_xp column to users table (separate from challenge XP)
-- ============================================
ALTER TABLE users ADD COLUMN IF NOT EXISTS action_xp INTEGER DEFAULT 0;

-- ============================================
-- 2. Create index for XP-based queries
-- ============================================
CREATE INDEX IF NOT EXISTS idx_users_action_xp ON users(action_xp DESC);

-- ============================================
-- 3. Add additional stats columns if not present
-- ============================================
ALTER TABLE users ADD COLUMN IF NOT EXISTS total_volume_as_maker_usd DECIMAL(20, 2) DEFAULT 0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS total_volume_as_taker_usd DECIMAL(20, 2) DEFAULT 0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS total_fills_given INTEGER DEFAULT 0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS total_fills_received INTEGER DEFAULT 0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS total_unique_tokens_traded INTEGER DEFAULT 0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS first_trade_date DATE;

-- ============================================
-- 4. CLEAR EXISTING DATA (as requested by user)
-- This resets all XP and events to start fresh with the new system
-- ============================================

-- Clear all user events
TRUNCATE TABLE user_events CASCADE;

-- Clear all completed challenges
TRUNCATE TABLE completed_challenges CASCADE;

-- Clear daily activity
TRUNCATE TABLE daily_activity CASCADE;

-- Reset all user stats to zero
UPDATE users SET
  total_xp = 0,
  action_xp = 0,
  current_prestige = 0,
  total_orders_created = 0,
  total_orders_filled = 0,
  total_orders_cancelled = 0,
  total_volume_usd = 0,
  total_trades = 0,
  unique_tokens_traded = 0,
  total_unique_tokens_traded = 0,
  current_active_orders = 0,
  longest_streak_days = 0,
  current_streak_days = 0,
  last_trade_date = NULL,
  total_proceeds_claimed = 0,
  total_volume_as_maker_usd = 0,
  total_volume_as_taker_usd = 0,
  total_fills_given = 0,
  total_fills_received = 0,
  first_trade_date = NULL,
  updated_at = NOW();

-- ============================================
-- 5. Reset sync state to re-process all blockchain events
-- ============================================
DELETE FROM sync_state WHERE key = 'last_synced_block';

-- ============================================
-- 6. Updated record_user_event function with new XP logic
-- ============================================
CREATE OR REPLACE FUNCTION record_user_event(
  p_wallet_address TEXT,
  p_event_type event_type,
  p_event_data JSONB DEFAULT '{}',
  p_xp_awarded INTEGER DEFAULT 0
)
RETURNS UUID AS $$
DECLARE
  v_event_id UUID;
  v_normalized_wallet TEXT;
BEGIN
  v_normalized_wallet := LOWER(p_wallet_address);

  -- Ensure user exists
  PERFORM get_or_create_user(v_normalized_wallet);

  -- Insert event
  INSERT INTO user_events (wallet_address, event_type, event_data, xp_awarded)
  VALUES (v_normalized_wallet, p_event_type, p_event_data, p_xp_awarded)
  RETURNING id INTO v_event_id;

  -- Update user's action XP (separate from challenge XP)
  -- Also update total_xp which is action_xp + challenge_xp
  IF p_xp_awarded > 0 THEN
    UPDATE users
    SET action_xp = action_xp + p_xp_awarded,
        total_xp = action_xp + p_xp_awarded + COALESCE((
          SELECT SUM(xp_awarded) FROM completed_challenges WHERE wallet_address = v_normalized_wallet
        ), 0),
        updated_at = NOW()
    WHERE wallet_address = v_normalized_wallet;
  END IF;

  -- Update specific stats based on event type
  CASE p_event_type
    WHEN 'order_created' THEN
      UPDATE users
      SET total_orders_created = total_orders_created + 1,
          current_active_orders = current_active_orders + 1,
          updated_at = NOW()
      WHERE wallet_address = v_normalized_wallet;

    WHEN 'order_filled' THEN
      UPDATE users
      SET total_orders_filled = total_orders_filled + 1,
          total_fills_given = total_fills_given + 1,
          updated_at = NOW()
      WHERE wallet_address = v_normalized_wallet;

    WHEN 'order_cancelled' THEN
      UPDATE users
      SET total_orders_cancelled = total_orders_cancelled + 1,
          current_active_orders = GREATEST(0, current_active_orders - 1),
          updated_at = NOW()
      WHERE wallet_address = v_normalized_wallet;

    WHEN 'trade_completed' THEN
      UPDATE users
      SET total_trades = total_trades + 1,
          total_volume_usd = total_volume_usd + COALESCE((p_event_data->>'volume_usd')::DECIMAL, 0),
          last_trade_date = CURRENT_DATE,
          updated_at = NOW()
      WHERE wallet_address = v_normalized_wallet;

      -- Update maker/taker specific volume
      IF (p_event_data->>'is_maker')::BOOLEAN = true THEN
        UPDATE users
        SET total_volume_as_maker_usd = total_volume_as_maker_usd + COALESCE((p_event_data->>'volume_usd')::DECIMAL, 0),
            total_fills_received = total_fills_received + 1
        WHERE wallet_address = v_normalized_wallet;
      ELSE
        UPDATE users
        SET total_volume_as_taker_usd = total_volume_as_taker_usd + COALESCE((p_event_data->>'volume_usd')::DECIMAL, 0)
        WHERE wallet_address = v_normalized_wallet;
      END IF;

    WHEN 'proceeds_claimed' THEN
      UPDATE users
      SET total_proceeds_claimed = total_proceeds_claimed + 1,
          updated_at = NOW()
      WHERE wallet_address = v_normalized_wallet;

    WHEN 'order_expired' THEN
      UPDATE users
      SET current_active_orders = GREATEST(0, current_active_orders - 1),
          updated_at = NOW()
      WHERE wallet_address = v_normalized_wallet;

    ELSE
      -- Just update timestamp for other events
      UPDATE users SET updated_at = NOW() WHERE wallet_address = v_normalized_wallet;
  END CASE;

  RETURN v_event_id;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- 7. Updated complete_challenge function
-- ============================================
CREATE OR REPLACE FUNCTION complete_challenge(
  p_wallet_address TEXT,
  p_prestige_level INTEGER,
  p_challenge_name TEXT,
  p_category TEXT,
  p_xp_awarded INTEGER
)
RETURNS BOOLEAN AS $$
DECLARE
  v_normalized_wallet TEXT;
  v_already_completed BOOLEAN;
  v_action_xp INTEGER;
BEGIN
  v_normalized_wallet := LOWER(p_wallet_address);

  -- Check if already completed
  SELECT EXISTS(
    SELECT 1 FROM completed_challenges
    WHERE wallet_address = v_normalized_wallet
    AND prestige_level = p_prestige_level
    AND challenge_name = p_challenge_name
  ) INTO v_already_completed;

  IF v_already_completed THEN
    RETURN FALSE;
  END IF;

  -- Ensure user exists
  PERFORM get_or_create_user(v_normalized_wallet);

  -- Record completion
  INSERT INTO completed_challenges (wallet_address, prestige_level, challenge_name, category, xp_awarded)
  VALUES (v_normalized_wallet, p_prestige_level, p_challenge_name, p_category, p_xp_awarded);

  -- Get current action XP
  SELECT COALESCE(action_xp, 0) INTO v_action_xp FROM users WHERE wallet_address = v_normalized_wallet;

  -- Update user total XP (action XP + all challenge XP)
  UPDATE users
  SET total_xp = v_action_xp + COALESCE((
        SELECT SUM(xp_awarded) FROM completed_challenges WHERE wallet_address = v_normalized_wallet
      ), 0),
      updated_at = NOW()
  WHERE wallet_address = v_normalized_wallet;

  RETURN TRUE;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- 8. Function to recalculate user's total XP
-- ============================================
CREATE OR REPLACE FUNCTION recalculate_user_xp(p_wallet_address TEXT)
RETURNS INTEGER AS $$
DECLARE
  v_normalized_wallet TEXT;
  v_action_xp INTEGER;
  v_challenge_xp INTEGER;
  v_total_xp INTEGER;
BEGIN
  v_normalized_wallet := LOWER(p_wallet_address);

  -- Get action XP from users table
  SELECT COALESCE(action_xp, 0) INTO v_action_xp
  FROM users WHERE wallet_address = v_normalized_wallet;

  -- Get challenge XP from completed_challenges
  SELECT COALESCE(SUM(xp_awarded), 0) INTO v_challenge_xp
  FROM completed_challenges WHERE wallet_address = v_normalized_wallet;

  v_total_xp := v_action_xp + v_challenge_xp;

  -- Update user's total XP
  UPDATE users
  SET total_xp = v_total_xp,
      updated_at = NOW()
  WHERE wallet_address = v_normalized_wallet;

  RETURN v_total_xp;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- 9. Update leaderboard view to include action_xp
-- ============================================
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
ORDER BY total_xp DESC;

-- ============================================
-- 10. Function to check if user can advance legion
-- ============================================
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

  -- Count completed required challenges for current legion (exclude humiliation)
  SELECT COUNT(*) INTO v_challenges_complete
  FROM completed_challenges
  WHERE wallet_address = v_normalized_wallet
    AND prestige_level = p_current_legion
    AND category != 'humiliation';

  -- For now, return true if XP is met (challenge check is done in frontend)
  RETURN TRUE;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- NOTE: After running this migration, the blockchain sync cron
-- will re-process all events from the deployment block and
-- award XP using the new values defined in constants/xp.ts
-- ============================================
