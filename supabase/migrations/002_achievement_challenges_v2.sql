-- Migration 002: Support for new achievement challenges (v2)
-- Run this in your Supabase SQL Editor AFTER 001_user_events_schema.sql

-- ============================================
-- 1. GIN index on event_data JSONB for fast contains() queries
--    Used by: backfill dedup (tx_hash), Iron/Diamond Hands (order_id lookup),
--    Deja Vu (duplicate order detection)
-- ============================================
CREATE INDEX IF NOT EXISTS idx_events_event_data ON user_events USING GIN (event_data);

-- ============================================
-- 2. Composite index for date-range event queries
--    Used by: Both Sides (same-day check), Arbitrage Artist (2-min window),
--    Indecisive/Total Chaos (cancels today), Ghost Town (expired events)
-- ============================================
CREATE INDEX IF NOT EXISTS idx_events_wallet_type_created
  ON user_events(wallet_address, event_type, created_at DESC);

-- ============================================
-- 3. Add total_proceeds_claimed to users table
--    Used by: The Collector, Claim Machine, Profit Master
-- ============================================
ALTER TABLE users ADD COLUMN IF NOT EXISTS total_proceeds_claimed INTEGER DEFAULT 0;

-- ============================================
-- 4. Update record_user_event function to track proceeds_claimed count
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

  -- Update user's total XP
  IF p_xp_awarded > 0 THEN
    UPDATE users
    SET total_xp = total_xp + p_xp_awarded,
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
