-- Feedback system tables (inspired by Fider)
-- Supports feature requests, bug reports, voting, comments, and image attachments

-- Main feedback posts table
CREATE TABLE IF NOT EXISTS feedback_posts (
  id SERIAL PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  category TEXT NOT NULL DEFAULT 'feature' CHECK (category IN ('feature', 'bug', 'improvement', 'question')),
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'under_review', 'planned', 'in_progress', 'completed', 'declined')),
  wallet_address TEXT NOT NULL,
  vote_count INTEGER NOT NULL DEFAULT 0,
  comment_count INTEGER NOT NULL DEFAULT 0,
  images TEXT[] DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Votes table (one vote per wallet per post)
CREATE TABLE IF NOT EXISTS feedback_votes (
  id SERIAL PRIMARY KEY,
  post_id INTEGER NOT NULL REFERENCES feedback_posts(id) ON DELETE CASCADE,
  wallet_address TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(post_id, wallet_address)
);

-- Comments table
CREATE TABLE IF NOT EXISTS feedback_comments (
  id SERIAL PRIMARY KEY,
  post_id INTEGER NOT NULL REFERENCES feedback_posts(id) ON DELETE CASCADE,
  wallet_address TEXT NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_feedback_posts_vote_count ON feedback_posts(vote_count DESC);
CREATE INDEX IF NOT EXISTS idx_feedback_posts_created_at ON feedback_posts(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_feedback_posts_category ON feedback_posts(category);
CREATE INDEX IF NOT EXISTS idx_feedback_posts_status ON feedback_posts(status);
CREATE INDEX IF NOT EXISTS idx_feedback_votes_post_id ON feedback_votes(post_id);
CREATE INDEX IF NOT EXISTS idx_feedback_votes_wallet ON feedback_votes(wallet_address);
CREATE INDEX IF NOT EXISTS idx_feedback_comments_post_id ON feedback_comments(post_id);
