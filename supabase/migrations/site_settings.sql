-- Site-wide settings table for admin control
-- Run this in your Supabase SQL Editor

CREATE TABLE IF NOT EXISTS site_settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Seed the default ai_trade_mode setting
INSERT INTO site_settings (key, value)
VALUES ('ai_trade_mode', 'normal')
ON CONFLICT (key) DO NOTHING;

-- Only service role can read/write (used server-side only)
ALTER TABLE site_settings ENABLE ROW LEVEL SECURITY;

-- No public access — server-side only via supabaseAdmin
