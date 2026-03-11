-- Migration 007: Deduplicate order_fills and add unique constraint
-- The order_fills table had no unique constraint, allowing duplicate entries
-- when the sync cursor was reset or blocks were re-processed.

-- 1. Remove duplicate fills, keeping the earliest inserted row (smallest id)
DELETE FROM order_fills a
USING order_fills b
WHERE a.id > b.id
  AND a.tx_hash = b.tx_hash
  AND a.order_id = b.order_id
  AND a.buy_token_index = b.buy_token_index;

-- 2. Add unique constraint to prevent future duplicates
CREATE UNIQUE INDEX IF NOT EXISTS idx_fills_unique_tx
  ON order_fills(tx_hash, order_id, buy_token_index);
