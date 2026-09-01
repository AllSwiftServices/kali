import { readFileSync } from "node:fs";
import { Client } from "pg";
import { config } from "dotenv";

config({ path: new URL("../.env", import.meta.url).pathname });

const file = process.argv[2];
if (!file) {
  console.error("Usage: node scripts/run-migration.mjs <path-to-sql-file>");
  process.exit(1);
}

const connectionString = process.env.POSTGRES_URL_NON_POOLING || process.env.POSTGRES_URL;
if (!connectionString) {
  console.error("POSTGRES_URL_NON_POOLING / POSTGRES_URL not set in .env");
  process.exit(1);
}

const sql = readFileSync(file, "utf8");

const client = new Client({
  connectionString,
  ssl: { rejectUnauthorized: false },
});

try {
  await client.connect();
  console.log(`Connected. Running ${file} ...`);
  await client.query(sql);
  console.log("Migration applied successfully.");
} catch (err) {
  console.error("Migration failed:", err.message);
  process.exitCode = 1;
} finally {
  await client.end();
}
