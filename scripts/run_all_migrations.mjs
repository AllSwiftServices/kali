import { readFileSync, existsSync } from "fs";
import { resolve } from "path";
import { Client } from "pg";
import dotenv from "dotenv";

dotenv.config();

let connectionString = process.env.POSTGRES_URL_NON_POOLING || process.env.POSTGRES_URL;
if (!connectionString) {
  console.error("❌ Error: Neither POSTGRES_URL_NON_POOLING nor POSTGRES_URL found in .env");
  process.exit(1);
}

// Strip parameters that conflict with node-pg ssl config
connectionString = connectionString.split("?")[0];

const client = new Client({
  connectionString,
  ssl: { rejectUnauthorized: false }
});

const migrationFiles = [
  "supabase/migrations/00000000000000_initial_schema.sql",
  "supabase/migrations/00000000000001_fix_verification_codes_unique.sql",
  "supabase/migrations/00000000000002_fix_upsert_unique_constraints.sql",
  "supabase/migrations/00000000000003_add_missing_rls_policies.sql",
  "supabase/migrations/00000000000004_add_admin_users_policy.sql",
  "supabase/migrations/00000000000005_fix_infinite_recursion_admin_check.sql",
  "supabase/migrations/20240321200000_add_plain_password.sql",
  "supabase/migrations/20260319_create_notifications_table.sql",
  "supabase/migrations/add_description_to_transactions.sql",
  "supabase/migrations/site_settings.sql",
  "scripts/20260319_create_settings_tabe.sql",
  "ai_trades_setup.sql",
  "ai_trades_update.sql",
  "managed_trades_setup.sql",
  "add_duration.sql",
  "supabase/migrations/add_user_ends_at_to_stakes.sql",
  "supabase/migrations/adjust_wallet_balance.sql",
  "supabase/migrations/support.sql"
];

async function run() {
  console.log("🔌 Connecting to Supabase PostgreSQL database...");
  await client.connect();
  console.log("✅ Connected successfully.\n");

  let successCount = 0;
  let skipCount = 0;
  let failCount = 0;

  for (const relPath of migrationFiles) {
    const fullPath = resolve(process.cwd(), relPath);
    if (!existsSync(fullPath)) {
      console.log(`⚠️  Skipping missing migration file: ${relPath}`);
      skipCount++;
      continue;
    }

    console.log(`⏳ Applying: ${relPath} ...`);
    const sql = readFileSync(fullPath, "utf8");

    try {
      await client.query(sql);
      console.log(`   ✅ Successfully applied: ${relPath}`);
      successCount++;
    } catch (err) {
      console.error(`   ❌ Failed applying ${relPath}: ${err.message}`);
      failCount++;
    }
  }

  console.log(`\n🎉 Migration Summary: ${successCount} applied, ${skipCount} skipped, ${failCount} failed.`);

  // Verify final list of tables in public schema
  const res = await client.query("SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name");
  console.log("\n📋 Final Public Tables in Supabase Database:");
  res.rows.forEach(r => console.log(`   - ${r.table_name}`));

  await client.end();
}

run().catch(err => {
  console.error("❌ Fatal migration error:", err);
  process.exit(1);
});
