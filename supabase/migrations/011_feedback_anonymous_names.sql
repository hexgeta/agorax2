-- Add is_admin flag to feedback_posts and feedback_comments.
-- This lets the API label admin posts/comments as "Admin" at read time
-- without needing the raw wallet (which is no longer stored).

ALTER TABLE feedback_posts
  ADD COLUMN IF NOT EXISTS is_admin BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE feedback_comments
  ADD COLUMN IF NOT EXISTS is_admin BOOLEAN NOT NULL DEFAULT FALSE;
