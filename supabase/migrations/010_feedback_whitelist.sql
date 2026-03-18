-- Add whitelist category and fields for token whitelist requests

-- Update category check constraint to include 'whitelist'
ALTER TABLE feedback_posts DROP CONSTRAINT IF EXISTS feedback_posts_category_check;
ALTER TABLE feedback_posts ADD CONSTRAINT feedback_posts_category_check
  CHECK (category IN ('feature', 'bug', 'improvement', 'question', 'whitelist'));

-- Add whitelist-specific fields
ALTER TABLE feedback_posts ADD COLUMN IF NOT EXISTS token_ticker TEXT;
ALTER TABLE feedback_posts ADD COLUMN IF NOT EXISTS token_contract_address TEXT;
ALTER TABLE feedback_posts ADD COLUMN IF NOT EXISTS is_tax_token BOOLEAN;
