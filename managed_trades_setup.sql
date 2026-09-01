-- Managed trades created by admin
CREATE TABLE IF NOT EXISTS managed_trades (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  asset_symbol TEXT NOT NULL,
  asset_name TEXT NOT NULL,
  asset_type TEXT NOT NULL,
  profit_percent NUMERIC NOT NULL,       -- e.g. 35 = 35% profit
  min_stake NUMERIC NOT NULL DEFAULT 10,
  starts_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ends_at TIMESTAMPTZ NOT NULL,          -- when trade auto-completes
  scope TEXT NOT NULL DEFAULT 'all',     -- 'all' | 'user'
  target_user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'active', -- 'active' | 'completed' | 'cancelled'
  signal_type TEXT,                      -- 'call' | 'put'
  entry_price NUMERIC,
  duration TEXT,                         -- e.g. '5m', '1h'
  outcome TEXT DEFAULT 'win',            -- 'win' | 'loss'
  created_by UUID REFERENCES auth.users(id) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Users can only see trades scoped to them or all users
ALTER TABLE managed_trades ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view relevant trades" ON managed_trades
  FOR SELECT USING (true);

CREATE POLICY "Admins full access to managed_trades" ON managed_trades
  FOR ALL USING (
    EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin')
  );

-- User stakes in a managed trade
CREATE TABLE IF NOT EXISTS managed_trade_stakes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  trade_id UUID REFERENCES managed_trades(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  stake_amount NUMERIC NOT NULL,
  direction TEXT NOT NULL DEFAULT 'call', -- 'call' | 'put'
  status TEXT NOT NULL DEFAULT 'active', -- 'active' | 'paid_out' | 'lost' | 'refunded'
  created_at TIMESTAMPTZ DEFAULT NOW(),
  paid_out_at TIMESTAMPTZ,
  UNIQUE(trade_id, user_id)
);

ALTER TABLE managed_trade_stakes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view own stakes" ON managed_trade_stakes
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Admins full access to managed_trade_stakes" ON managed_trade_stakes
  FOR ALL USING (
    EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin')
  );
