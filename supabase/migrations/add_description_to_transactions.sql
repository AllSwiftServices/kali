-- Add description column to transactions table
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS description TEXT;
