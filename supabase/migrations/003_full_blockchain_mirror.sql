-- Migration 003: Full Blockchain Mirror
-- Adds orders table, order_fills table, and missing user stats
-- to fully mirror all on-chain data in Supabase.

-- ============================================================
-- 1. Add 'order_updated' to event_type enum
-- ============================================================
ALTER TYPE event_type ADD VALUE IF NOT EXISTS 'order_updated';

-- ============================================================
-- 2. Orders table - mirrors every on-chain order
-- ============================================================
CREATE TABLE IF NOT EXISTS orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id BIGINT UNIQUE NOT NULL,                        -- on-chain order ID
  maker_address TEXT NOT NULL REFERENCES users(wallet_address) ON DELETE CASCADE,
  sell_token_address TEXT NOT NULL,                        -- token contract address
  sell_token_ticker TEXT NOT NULL DEFAULT 'UNKNOWN',       -- resolved ticker symbol
  sell_amount_raw TEXT NOT NULL DEFAULT '0',               -- raw bigint as string (no precision loss)
  sell_amount_formatted DECIMAL(38, 18) NOT NULL DEFAULT 0, -- human-readable amount
  buy_tokens_addresses TEXT[] NOT NULL DEFAULT '{}',       -- array of token addresses
  buy_tokens_tickers TEXT[] NOT NULL DEFAULT '{}',         -- array of resolved tickers
  buy_amounts_raw TEXT[] NOT NULL DEFAULT '{}',            -- raw bigint amounts as strings
  buy_amounts_formatted DECIMAL(38, 18)[] NOT NULL DEFAULT '{}', -- human-readable amounts
  status SMALLINT NOT NULL DEFAULT 0,                      -- 0=active, 1=cancelled, 2=completed
  fill_percentage DECIMAL(5, 2) NOT NULL DEFAULT 0,        -- 0.00 to 100.00
  remaining_sell_amount TEXT NOT NULL DEFAULT '0',          -- raw remaining
  redeemed_sell_amount TEXT NOT NULL DEFAULT '0',           -- raw redeemed (filled)
  is_all_or_nothing BOOLEAN NOT NULL DEFAULT false,
  expiration BIGINT DEFAULT 0,                             -- unix timestamp, 0 = no expiry
  total_fills INTEGER NOT NULL DEFAULT 0,                  -- number of fill events
  unique_fillers INTEGER NOT NULL DEFAULT 0,               -- distinct filler wallets
  creation_tx_hash TEXT,                                   -- transaction that created the order
  creation_block_number BIGINT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Indexes for orders
CREATE INDEX IF NOT EXISTS idx_orders_maker ON orders(maker_address);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_sell_token ON orders(sell_token_address);
CREATE INDEX IF NOT EXISTS idx_orders_created ON orders(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_orders_order_id ON orders(order_id);
CREATE INDEX IF NOT EXISTS idx_orders_maker_status ON orders(maker_address, status);

-- ============================================================
-- 3. Order fills table - every individual fill event
-- ============================================================
CREATE TABLE IF NOT EXISTS order_fills (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id BIGINT NOT NULL REFERENCES orders(order_id) ON DELETE CASCADE,
  filler_address TEXT NOT NULL,                            -- wallet that filled
  buy_token_index INTEGER NOT NULL DEFAULT 0,              -- index into order's buy tokens array
  buy_token_address TEXT NOT NULL DEFAULT '',               -- resolved token address
  buy_token_ticker TEXT NOT NULL DEFAULT 'UNKNOWN',        -- resolved ticker
  buy_amount_raw TEXT NOT NULL DEFAULT '0',                 -- raw bigint as string
  buy_amount_formatted DECIMAL(38, 18) NOT NULL DEFAULT 0, -- human-readable
  sell_amount_released_raw TEXT NOT NULL DEFAULT '0',       -- sell tokens released to filler
  sell_amount_released_formatted DECIMAL(38, 18) NOT NULL DEFAULT 0,
  volume_usd DECIMAL(20, 2) NOT NULL DEFAULT 0,            -- USD value of fill
  tx_hash TEXT,
  block_number BIGINT,
  filled_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Indexes for order_fills
CREATE INDEX IF NOT EXISTS idx_fills_order_id ON order_fills(order_id);
CREATE INDEX IF NOT EXISTS idx_fills_filler ON order_fills(filler_address);
CREATE INDEX IF NOT EXISTS idx_fills_filled_at ON order_fills(filled_at DESC);
CREATE INDEX IF NOT EXISTS idx_fills_tx_hash ON order_fills(tx_hash);

-- ============================================================
-- 4. Order cancellations table
-- ============================================================
CREATE TABLE IF NOT EXISTS order_cancellations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id BIGINT NOT NULL REFERENCES orders(order_id) ON DELETE CASCADE,
  cancelled_by TEXT NOT NULL,
  fill_percentage_at_cancel DECIMAL(5, 2) NOT NULL DEFAULT 0,
  time_since_creation_seconds BIGINT DEFAULT 0,
  tx_hash TEXT,
  block_number BIGINT,
  cancelled_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_cancellations_order_id ON order_cancellations(order_id);
CREATE INDEX IF NOT EXISTS idx_cancellations_cancelled_by ON order_cancellations(cancelled_by);

-- ============================================================
-- 5. Proceeds claims table
-- ============================================================
CREATE TABLE IF NOT EXISTS order_proceeds (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id BIGINT NOT NULL REFERENCES orders(order_id) ON DELETE CASCADE,
  claimed_by TEXT NOT NULL,
  tx_hash TEXT,
  block_number BIGINT,
  claimed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_proceeds_order_id ON order_proceeds(order_id);
CREATE INDEX IF NOT EXISTS idx_proceeds_claimed_by ON order_proceeds(claimed_by);

-- ============================================================
-- 6. Add missing columns to users table
-- ============================================================
ALTER TABLE users ADD COLUMN IF NOT EXISTS total_orders_expired INTEGER DEFAULT 0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS total_volume_as_maker_usd DECIMAL(20, 2) DEFAULT 0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS total_volume_as_taker_usd DECIMAL(20, 2) DEFAULT 0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS total_fills_given INTEGER DEFAULT 0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS total_fills_received INTEGER DEFAULT 0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS first_trade_date DATE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS total_unique_tokens_traded INTEGER DEFAULT 0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS total_proceeds_claims INTEGER DEFAULT 0;

-- ============================================================
-- 7. RLS policies for new tables
-- ============================================================
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_fills ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_cancellations ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_proceeds ENABLE ROW LEVEL SECURITY;

-- Orders: readable by everyone, writable by service role
CREATE POLICY "Orders viewable by everyone" ON orders FOR SELECT USING (true);
CREATE POLICY "Service role manages orders" ON orders FOR ALL USING (
  (current_setting('request.jwt.claims', true)::json->>'role') = 'service_role'
);

-- Order fills: readable by everyone, writable by service role
CREATE POLICY "Fills viewable by everyone" ON order_fills FOR SELECT USING (true);
CREATE POLICY "Service role manages fills" ON order_fills FOR ALL USING (
  (current_setting('request.jwt.claims', true)::json->>'role') = 'service_role'
);

-- Cancellations: readable by everyone, writable by service role
CREATE POLICY "Cancellations viewable by everyone" ON order_cancellations FOR SELECT USING (true);
CREATE POLICY "Service role manages cancellations" ON order_cancellations FOR ALL USING (
  (current_setting('request.jwt.claims', true)::json->>'role') = 'service_role'
);

-- Proceeds: readable by everyone, writable by service role
CREATE POLICY "Proceeds viewable by everyone" ON order_proceeds FOR SELECT USING (true);
CREATE POLICY "Service role manages proceeds" ON order_proceeds FOR ALL USING (
  (current_setting('request.jwt.claims', true)::json->>'role') = 'service_role'
);

-- ============================================================
-- 8. Upsert function for orders (used by backfill + tracking)
-- ============================================================
CREATE OR REPLACE FUNCTION upsert_order(
  p_order_id BIGINT,
  p_maker_address TEXT,
  p_sell_token_address TEXT,
  p_sell_token_ticker TEXT,
  p_sell_amount_raw TEXT,
  p_sell_amount_formatted DECIMAL(38, 18),
  p_buy_tokens_addresses TEXT[],
  p_buy_tokens_tickers TEXT[],
  p_buy_amounts_raw TEXT[],
  p_buy_amounts_formatted DECIMAL(38, 18)[],
  p_status SMALLINT DEFAULT 0,
  p_is_all_or_nothing BOOLEAN DEFAULT false,
  p_expiration BIGINT DEFAULT 0,
  p_tx_hash TEXT DEFAULT NULL,
  p_block_number BIGINT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE
  result_id UUID;
BEGIN
  INSERT INTO orders (
    order_id, maker_address, sell_token_address, sell_token_ticker,
    sell_amount_raw, sell_amount_formatted,
    buy_tokens_addresses, buy_tokens_tickers,
    buy_amounts_raw, buy_amounts_formatted,
    status, remaining_sell_amount, is_all_or_nothing,
    expiration, creation_tx_hash, creation_block_number
  ) VALUES (
    p_order_id, LOWER(p_maker_address), LOWER(p_sell_token_address), p_sell_token_ticker,
    p_sell_amount_raw, p_sell_amount_formatted,
    p_buy_tokens_addresses, p_buy_tokens_tickers,
    p_buy_amounts_raw, p_buy_amounts_formatted,
    p_status, p_sell_amount_raw, p_is_all_or_nothing,
    p_expiration, p_tx_hash, p_block_number
  )
  ON CONFLICT (order_id) DO UPDATE SET
    status = EXCLUDED.status,
    updated_at = NOW()
  RETURNING id INTO result_id;

  RETURN result_id;
END;
$$;

-- ============================================================
-- 9. Function to record a fill and update order stats
-- ============================================================
CREATE OR REPLACE FUNCTION record_order_fill(
  p_order_id BIGINT,
  p_filler_address TEXT,
  p_buy_token_index INTEGER,
  p_buy_token_address TEXT,
  p_buy_token_ticker TEXT,
  p_buy_amount_raw TEXT,
  p_buy_amount_formatted DECIMAL(38, 18),
  p_sell_amount_released_raw TEXT DEFAULT '0',
  p_sell_amount_released_formatted DECIMAL(38, 18) DEFAULT 0,
  p_volume_usd DECIMAL(20, 2) DEFAULT 0,
  p_tx_hash TEXT DEFAULT NULL,
  p_block_number BIGINT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE
  result_id UUID;
  filler_count INTEGER;
BEGIN
  -- Insert fill record
  INSERT INTO order_fills (
    order_id, filler_address, buy_token_index,
    buy_token_address, buy_token_ticker,
    buy_amount_raw, buy_amount_formatted,
    sell_amount_released_raw, sell_amount_released_formatted,
    volume_usd, tx_hash, block_number
  ) VALUES (
    p_order_id, LOWER(p_filler_address), p_buy_token_index,
    LOWER(p_buy_token_address), p_buy_token_ticker,
    p_buy_amount_raw, p_buy_amount_formatted,
    p_sell_amount_released_raw, p_sell_amount_released_formatted,
    p_volume_usd, p_tx_hash, p_block_number
  )
  RETURNING id INTO result_id;

  -- Update order fill stats
  SELECT COUNT(DISTINCT filler_address) INTO filler_count
  FROM order_fills WHERE order_id = p_order_id;

  UPDATE orders SET
    total_fills = total_fills + 1,
    unique_fillers = filler_count,
    updated_at = NOW()
  WHERE order_id = p_order_id;

  RETURN result_id;
END;
$$;

-- ============================================================
-- 10. Views for common API queries
-- ============================================================

-- User summary view (enriched leaderboard)
CREATE OR REPLACE VIEW user_summary AS
SELECT
  u.wallet_address,
  u.total_xp,
  u.current_prestige,
  u.total_orders_created,
  u.total_orders_filled,
  u.total_orders_cancelled,
  COALESCE(u.total_orders_expired, 0) as total_orders_expired,
  u.total_trades,
  u.total_volume_usd,
  COALESCE(u.total_volume_as_maker_usd, 0) as total_volume_as_maker_usd,
  COALESCE(u.total_volume_as_taker_usd, 0) as total_volume_as_taker_usd,
  COALESCE(u.total_fills_given, 0) as total_fills_given,
  COALESCE(u.total_fills_received, 0) as total_fills_received,
  u.unique_tokens_traded,
  u.current_active_orders,
  u.longest_streak_days,
  u.current_streak_days,
  u.last_trade_date,
  u.first_trade_date,
  COALESCE(u.total_proceeds_claimed, 0) as total_proceeds_claimed,
  u.created_at,
  u.updated_at,
  (SELECT COUNT(*) FROM completed_challenges cc WHERE cc.wallet_address = u.wallet_address) as total_challenges_completed,
  CASE WHEN u.total_orders_created > 0
    THEN ROUND((u.total_orders_filled::DECIMAL / u.total_orders_created) * 100, 1)
    ELSE 0
  END as fill_rate_percent,
  RANK() OVER (ORDER BY u.total_xp DESC) as rank
FROM users u;

-- Order detail view with fill summary
CREATE OR REPLACE VIEW order_details_view AS
SELECT
  o.*,
  (SELECT COUNT(*) FROM order_fills f WHERE f.order_id = o.order_id) as fill_count,
  (SELECT COUNT(DISTINCT f.filler_address) FROM order_fills f WHERE f.order_id = o.order_id) as unique_filler_count,
  (SELECT COALESCE(SUM(f.volume_usd), 0) FROM order_fills f WHERE f.order_id = o.order_id) as total_fill_volume_usd
FROM orders o;
