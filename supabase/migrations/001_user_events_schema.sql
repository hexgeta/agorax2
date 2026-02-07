-- User Events & Points Schema for AgoraX Prestige System
-- Run this in your Supabase SQL Editor

-- ============================================
-- 1. Users table - stores wallet addresses and aggregated stats
-- ============================================
CREATE TABLE IF NOT EXISTS users (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  wallet_address TEXT UNIQUE NOT NULL,
  total_xp INTEGER DEFAULT 0,
  current_prestige INTEGER DEFAULT 0, -- 0=Alpha, 1=Beta, ..., 8=Omega
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  -- Aggregated stats (updated via triggers or API)
  total_orders_created INTEGER DEFAULT 0,
  total_orders_filled INTEGER DEFAULT 0,
  total_orders_cancelled INTEGER DEFAULT 0,
  total_volume_usd DECIMAL(20, 2) DEFAULT 0,
  total_trades INTEGER DEFAULT 0,
  unique_tokens_traded INTEGER DEFAULT 0,
  current_active_orders INTEGER DEFAULT 0,
  longest_streak_days INTEGER DEFAULT 0,
  current_streak_days INTEGER DEFAULT 0,
  last_trade_date DATE,

  -- Constraints
  CONSTRAINT wallet_address_format CHECK (wallet_address ~ '^0x[a-fA-F0-9]{40}$')
);

-- Index for fast lookups by wallet
CREATE INDEX IF NOT EXISTS idx_users_wallet ON users(wallet_address);
CREATE INDEX IF NOT EXISTS idx_users_xp ON users(total_xp DESC);

-- ============================================
-- 2. User Events table - stores all trackable events
-- ============================================
CREATE TYPE event_type AS ENUM (
  -- Wallet/Connection Events
  'wallet_connected',

  -- Order Events
  'order_created',
  'order_filled',
  'order_cancelled',
  'order_expired',
  'proceeds_claimed',

  -- View/Interaction Events
  'order_viewed',
  'chart_viewed',
  'marketplace_visited',

  -- Trade Events (when order is filled by someone)
  'trade_completed',

  -- Special Events
  'streak_updated',
  'prestige_unlocked'
);

CREATE TABLE IF NOT EXISTS user_events (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  wallet_address TEXT NOT NULL,
  event_type event_type NOT NULL,
  event_data JSONB DEFAULT '{}', -- Flexible data storage for event-specific info
  xp_awarded INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  -- Foreign key (optional, allows events without user record)
  CONSTRAINT fk_user FOREIGN KEY (wallet_address)
    REFERENCES users(wallet_address) ON DELETE CASCADE
);

-- Indexes for event queries
CREATE INDEX IF NOT EXISTS idx_events_wallet ON user_events(wallet_address);
CREATE INDEX IF NOT EXISTS idx_events_type ON user_events(event_type);
CREATE INDEX IF NOT EXISTS idx_events_created ON user_events(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_events_wallet_type ON user_events(wallet_address, event_type);

-- ============================================
-- 3. Completed Challenges table - tracks which challenges users have completed
-- ============================================
CREATE TABLE IF NOT EXISTS completed_challenges (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  wallet_address TEXT NOT NULL,
  prestige_level INTEGER NOT NULL, -- 0-8
  challenge_name TEXT NOT NULL,
  category TEXT NOT NULL, -- 'bootcamp', 'operations', 'elite', 'humiliation'
  xp_awarded INTEGER NOT NULL,
  completed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  -- Prevent duplicate completions
  UNIQUE(wallet_address, prestige_level, challenge_name),

  CONSTRAINT fk_user_challenge FOREIGN KEY (wallet_address)
    REFERENCES users(wallet_address) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_challenges_wallet ON completed_challenges(wallet_address);
CREATE INDEX IF NOT EXISTS idx_challenges_prestige ON completed_challenges(prestige_level);

-- ============================================
-- 4. Daily Activity table - for streak tracking
-- ============================================
CREATE TABLE IF NOT EXISTS daily_activity (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  wallet_address TEXT NOT NULL,
  activity_date DATE NOT NULL,
  trades_count INTEGER DEFAULT 0,
  orders_created INTEGER DEFAULT 0,
  orders_filled INTEGER DEFAULT 0,
  volume_usd DECIMAL(20, 2) DEFAULT 0,

  UNIQUE(wallet_address, activity_date),

  CONSTRAINT fk_user_activity FOREIGN KEY (wallet_address)
    REFERENCES users(wallet_address) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_activity_wallet_date ON daily_activity(wallet_address, activity_date DESC);

-- ============================================
-- 5. Helper function to get or create user
-- ============================================
CREATE OR REPLACE FUNCTION get_or_create_user(p_wallet_address TEXT)
RETURNS UUID AS $$
DECLARE
  v_user_id UUID;
BEGIN
  -- Try to get existing user
  SELECT id INTO v_user_id FROM users WHERE wallet_address = LOWER(p_wallet_address);

  -- Create if doesn't exist
  IF v_user_id IS NULL THEN
    INSERT INTO users (wallet_address)
    VALUES (LOWER(p_wallet_address))
    RETURNING id INTO v_user_id;
  END IF;

  RETURN v_user_id;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- 6. Function to record an event and update user stats
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

    ELSE
      -- Just update timestamp for other events
      UPDATE users SET updated_at = NOW() WHERE wallet_address = v_normalized_wallet;
  END CASE;

  RETURN v_event_id;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- 7. Function to complete a challenge
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

  -- Update user XP
  UPDATE users
  SET total_xp = total_xp + p_xp_awarded,
      updated_at = NOW()
  WHERE wallet_address = v_normalized_wallet;

  RETURN TRUE;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- 8. View for leaderboard
-- ============================================
CREATE OR REPLACE VIEW leaderboard AS
SELECT
  wallet_address,
  total_xp,
  current_prestige,
  total_orders_created,
  total_orders_filled,
  total_trades,
  total_volume_usd,
  RANK() OVER (ORDER BY total_xp DESC) as rank
FROM users
ORDER BY total_xp DESC;

-- ============================================
-- 9. RLS Policies (Row Level Security)
-- ============================================

-- Enable RLS
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE completed_challenges ENABLE ROW LEVEL SECURITY;
ALTER TABLE daily_activity ENABLE ROW LEVEL SECURITY;

-- Allow read access to all for leaderboard
CREATE POLICY "Users are viewable by everyone" ON users
  FOR SELECT USING (true);

-- Allow insert/update via service role (API routes)
CREATE POLICY "Service role can manage users" ON users
  FOR ALL USING (auth.role() = 'service_role');

-- Events: readable by owner, writable by service role
CREATE POLICY "Events viewable by owner" ON user_events
  FOR SELECT USING (true);

CREATE POLICY "Service role can manage events" ON user_events
  FOR ALL USING (auth.role() = 'service_role');

-- Challenges: readable by everyone, writable by service role
CREATE POLICY "Challenges viewable by everyone" ON completed_challenges
  FOR SELECT USING (true);

CREATE POLICY "Service role can manage challenges" ON completed_challenges
  FOR ALL USING (auth.role() = 'service_role');

-- Daily activity: readable by owner, writable by service role
CREATE POLICY "Activity viewable by owner" ON daily_activity
  FOR SELECT USING (true);

CREATE POLICY "Service role can manage activity" ON daily_activity
  FOR ALL USING (auth.role() = 'service_role');
