ALTER TABLE ai_trades 
ADD COLUMN IF NOT EXISTS duration INTEGER DEFAULT 60,
ADD COLUMN IF NOT EXISTS resolves_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS entry_price NUMERIC;

-- Update existing trades
UPDATE ai_trades 
SET duration = 60, resolves_at = created_at + interval '60 seconds', entry_price = 0
WHERE resolves_at IS NULL;
