-- Migration 004: Sync state table for tracking incremental blockchain sync
-- Tracks the last synced block number so the cron only fetches new events

CREATE TABLE IF NOT EXISTS sync_state (
  key TEXT PRIMARY KEY,
  value BIGINT NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Seed with the contract deployment block
INSERT INTO sync_state (key, value) VALUES ('last_synced_block', 21266815)
ON CONFLICT (key) DO NOTHING;

-- RLS: public read, service_role write
ALTER TABLE sync_state ENABLE ROW LEVEL SECURITY;

CREATE POLICY "sync_state_read" ON sync_state
  FOR SELECT USING (true);

CREATE POLICY "sync_state_write" ON sync_state
  FOR ALL USING (auth.role() = 'service_role');
