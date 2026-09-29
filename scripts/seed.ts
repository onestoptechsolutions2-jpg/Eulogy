import "dotenv/config";
import { readFile } from "node:fs/promises";
import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { asc, eq } from "drizzle-orm";
import * as schema from "../db/schema.ts";
import { parseGramps } from "../lib/gramps.ts";
import { replaceGenealogy } from "../lib/import.ts";
import { newId } from "../lib/ids.ts";

const email = (process.env.OWNER_EMAIL ?? "").trim().toLowerCase();
if (!process.env.DATABASE_URL || !email) {
  console.error("Set DATABASE_URL and OWNER_EMAIL in .env first.");
  process.exit(1);
}

const db = drizzle(neon(process.env.DATABASE_URL), { schema });

let [tree] = await db.select().from(schema.trees).orderBy(asc(schema.trees.createdAt)).limit(1);
if (!tree) {
  [tree] = await db.insert(schema.trees).values({ id: newId(), name: "Family Tree" }).returning();
}

let [user] = await db.select().from(schema.users).where(eq(schema.users.email, email));
if (!user) {
  const personId = newId();
  await db.insert(schema.people).values({ id: personId, treeId: tree.id, given: "Owner" });
  [user] = await db
    .insert(schema.users)
    .values({ id: newId(), email, name: "Owner", treeId: tree.id, role: "owner", personId })
    .returning();
} else {
  await db.update(schema.users).set({ role: "owner" }).where(eq(schema.users.id, user.id));
}
await db.update(schema.trees).set({ ownerId: user.id }).where(eq(schema.trees.id, tree.id));

const file = process.argv[2];
if (file) {
  const parsed = parseGramps(await readFile(file));
  const counts = await replaceGenealogy(tree.id, parsed);
  console.log(`Imported ${counts.people} people, ${counts.families} families.`);
}

console.log(`Owner ${email} is set. Tree "${tree.name}" (${tree.id}). Sign in at /login.`);
