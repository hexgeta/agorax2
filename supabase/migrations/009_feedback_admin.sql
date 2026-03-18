-- Add duplicate post linking and admin management support

-- Add duplicate_of column to link duplicate posts to their original
ALTER TABLE feedback_posts ADD COLUMN IF NOT EXISTS duplicate_of INTEGER REFERENCES feedback_posts(id) ON DELETE SET NULL;

-- Update status check constraint to include 'duplicate'
ALTER TABLE feedback_posts DROP CONSTRAINT IF EXISTS feedback_posts_status_check;
ALTER TABLE feedback_posts ADD CONSTRAINT feedback_posts_status_check
  CHECK (status IN ('open', 'under_review', 'planned', 'in_progress', 'completed', 'declined', 'duplicate'));

-- Index for finding duplicates of a post
CREATE INDEX IF NOT EXISTS idx_feedback_posts_duplicate_of ON feedback_posts(duplicate_of) WHERE duplicate_of IS NOT NULL;
