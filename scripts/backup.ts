import "dotenv/config";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { neon } from "@neondatabase/serverless";

// Usage: npm run db:backup
// Dumps every public table to backups/<timestamp>/<table>.json. This is a
// data snapshot (no schema); the schema lives in db/migrations.
if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL is not set (put it in .env).");
  process.exit(1);
}
const sql = neon(process.env.DATABASE_URL);

const tables = (await sql`
  SELECT table_name FROM information_schema.tables
  WHERE table_schema = 'public' AND table_type = 'BASE TABLE' ORDER BY 1`) as { table_name: string }[];

const dir = path.join(process.cwd(), "backups", new Date().toISOString().replace(/[:.]/g, "-"));
await mkdir(dir, { recursive: true });

for (const { table_name } of tables) {
  // table names come from information_schema, not user input
  const q = `SELECT * FROM "${table_name}"`;
  const rows = (await sql(Object.assign([q], { raw: [q] }) as unknown as TemplateStringsArray)) as unknown[];
  await writeFile(path.join(dir, `${table_name}.json`), JSON.stringify(rows));
  console.log(`${table_name.padEnd(24)} ${rows.length} rows`);
}
console.log(`\nBackup written to ${dir}`);
