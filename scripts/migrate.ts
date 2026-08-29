import "dotenv/config";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { neon } from "@neondatabase/serverless";

if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL is not set (put it in .env).");
  process.exit(1);
}

const dir = path.join(process.cwd(), "db", "migrations");
const sql = neon(process.env.DATABASE_URL);

const files = (await readdir(dir)).filter((f) => f.endsWith(".sql")).sort();
for (const file of files) {
  const text = await readFile(path.join(dir, file), "utf8");
  const statements = text
    .split(/;\s*(?:\r?\n|$)/)
    .map((s) => s.trim())
    .filter((s) => s && !s.startsWith("--"));
  process.stdout.write(`${file} … `);
  for (const st of statements) {
    await sql.query(st);
  }
  console.log(`ok (${statements.length} statements)`);
}
console.log("Migrations applied.");
