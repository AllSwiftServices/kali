-- AI Trading tables
-- This table tracks simulated AI trades with server-side outcome determination
CREATE TABLE IF NOT EXISTS ai_trades (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    stake NUMERIC NOT NULL CHECK (stake > 0),
    direction TEXT NOT NULL CHECK (direction IN ('UP', 'DOWN')),
    outcome TEXT NOT NULL CHECK (outcome IN ('WIN', 'LOSS')),
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'resolved', 'expired')),
    profit NUMERIC DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    resolved_at TIMESTAMPTZ
);

-- Indexes for performance and uniqueness
CREATE INDEX IF NOT EXISTS idx_ai_trades_user_status ON ai_trades(user_id, status);
CREATE INDEX IF NOT EXISTS idx_ai_trades_created ON ai_trades(created_at);

-- Ensure only one pending trade per user at a time
CREATE UNIQUE INDEX IF NOT EXISTS idx_ai_trades_one_pending 
ON ai_trades(user_id) WHERE status = 'pending';

-- Enable Row Level Security
ALTER TABLE ai_trades ENABLE ROW LEVEL SECURITY;

-- Users can only see their own AI trades
CREATE POLICY "Users view own ai trades" ON ai_trades 
FOR SELECT USING (auth.uid() = user_id);

-- Admins (or service role) have full access
CREATE POLICY "Admins full ai trades access" ON ai_trades 
FOR ALL USING (
    EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin')
);

-- Note: Transaction logic remains the same, but we will use specific 'type' values:
-- 'trade_entry', 'trade_win', 'trade_loss'
