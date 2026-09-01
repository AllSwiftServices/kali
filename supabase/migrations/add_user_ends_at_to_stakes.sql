-- Migration: Add user_ends_at to managed_trade_stakes
ALTER TABLE managed_trade_stakes
  ADD COLUMN IF NOT EXISTS user_ends_at TIMESTAMPTZ;
