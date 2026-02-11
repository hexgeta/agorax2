-- User Favorites Schema for AgoraX
-- Allows users to bookmark/star orders they're interested in

-- ============================================
-- 1. User Favorites table
-- ============================================
CREATE TABLE IF NOT EXISTS user_favorites (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  wallet_address TEXT NOT NULL,
  order_id BIGINT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  -- Each wallet can only favorite an order once
  UNIQUE(wallet_address, order_id),

  -- Validate wallet address format
  CONSTRAINT wallet_address_format CHECK (wallet_address ~ '^0x[a-fA-F0-9]{40}$')
);

-- Indexes for fast lookups
CREATE INDEX IF NOT EXISTS idx_favorites_wallet ON user_favorites(wallet_address);
CREATE INDEX IF NOT EXISTS idx_favorites_order ON user_favorites(order_id);
CREATE INDEX IF NOT EXISTS idx_favorites_wallet_created ON user_favorites(wallet_address, created_at DESC);

-- ============================================
-- 2. Row Level Security
-- ============================================
ALTER TABLE user_favorites ENABLE ROW LEVEL SECURITY;

-- Allow anyone to read favorites (needed for public display)
CREATE POLICY "Allow public read access to favorites"
  ON user_favorites FOR SELECT
  USING (true);

-- Only service role can insert/delete (API handles auth)
CREATE POLICY "Allow service role to insert favorites"
  ON user_favorites FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Allow service role to delete favorites"
  ON user_favorites FOR DELETE
  USING (true);
