import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: './.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function migrate() {
  console.log("Running migration for flexible durations...");
  
  // Note: RPC would be ideal for DDL, but if not available we can try raw SQL via a helper if it exists.
  // However, for this project, I'll use the supabase.rpc if a 'exec_sql' helper exists, 
  // but if not, I'll inform the user that I've prepared the changes and need them to run the SQL in the dashboard.
  
  // Let's attempt to run the migration.
  const { error } = await supabase.rpc('exec_sql', {
    sql_query: `
      ALTER TABLE managed_trade_stakes ADD COLUMN IF NOT EXISTS ends_at TIMESTAMPTZ;
      ALTER TABLE managed_trade_stakes DROP CONSTRAINT IF EXISTS managed_trade_stakes_trade_id_user_id_key;
    `
  });

  if (error) {
    console.error("Migration failed via RPC (likely exec_sql not defined):", error);
    console.log("--- MANUAL SQL REQUIRED ---");
    console.log("ALTER TABLE managed_trade_stakes ADD COLUMN IF NOT EXISTS ends_at TIMESTAMPTZ;");
    console.log("ALTER TABLE managed_trade_stakes DROP CONSTRAINT IF EXISTS managed_trade_stakes_trade_id_user_id_key;");
    console.log("----------------------------");
  } else {
    console.log("Migration successful!");
  }
}

migrate();
