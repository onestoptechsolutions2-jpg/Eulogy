import "dotenv/config";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { neon } from "@neondatabase/serverless";

if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL is not set (put it in .env).");
  process.exit(1);
}

const sql = neon(process.env.DATABASE_URL);

// The neon HTTP client only exposes the tagged-template form; our migration
// statements carry no parameters, so run each as a literal.
function run(statement: string) {
  const arr = Object.assign([statement], { raw: [statement] }) as unknown as TemplateStringsArray;
  return sql(arr);
}

const dir = path.join(process.cwd(), "db", "migrations");
const files = (await readdir(dir)).filter((f) => f.endsWith(".sql")).sort();

for (const file of files) {
  const raw = await readFile(path.join(dir, file), "utf8");
  // strip whole-line `--` comments first, then split on statement terminators
  const body = raw
    .split(/\r?\n/)
    .filter((line) => !line.trim().startsWith("--"))
    .join("\n");
  const statements = body
    .split(/;\s*(?:\r?\n|$)/)
    .map((s) => s.trim())
    .filter(Boolean);
  process.stdout.write(`${file} … `);
  for (const st of statements) await run(st);
  console.log(`ok (${statements.length} statements)`);
}
console.log("Migrations applied.");
