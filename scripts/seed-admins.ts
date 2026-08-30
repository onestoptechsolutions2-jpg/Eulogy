import "dotenv/config";
import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { and, asc, eq } from "drizzle-orm";
import * as schema from "../db/schema.ts";
import { newId } from "../lib/ids.ts";
import { hashPassword, generatePassword } from "../lib/password.ts";

// Usage:
//   npm run seed:admins -- alice@x.com bob@x.com
//   npm run seed:admins -- --role owner --password "Shared-Pass-1" a@x.com b@x.com
//
// Creates (or updates) a password account for each address and makes it a
// member of the family tree with the given role. Prints the credentials.

const args = process.argv.slice(2);
let role = "editor";
let sharedPassword: string | null = null;
const emails: string[] = [];
for (let i = 0; i < args.length; i++) {
  if (args[i] === "--role") role = args[++i];
  else if (args[i] === "--password") sharedPassword = args[++i];
  else emails.push(args[i].toLowerCase());
}

if (!process.env.DATABASE_URL || emails.length === 0) {
  console.error(
    'Usage: npm run seed:admins -- [--role owner|editor|contributor|viewer] [--password "..."] email ...',
  );
  process.exit(1);
}
if (!["owner", "editor", "contributor", "viewer"].includes(role)) {
  console.error(`Bad role: ${role}`);
  process.exit(1);
}

const db = drizzle(neon(process.env.DATABASE_URL), { schema });

let [tree] = await db.select().from(schema.trees).orderBy(asc(schema.trees.createdAt)).limit(1);
if (!tree) {
  console.error("No family tree exists yet. Run `npm run seed` first.");
  process.exit(1);
}

const out: { email: string; password: string; role: string; status: string }[] = [];

for (const email of emails) {
  const password = sharedPassword ?? generatePassword();
  const passwordHash = await hashPassword(password);

  let [user] = await db.select().from(schema.users).where(eq(schema.users.email, email));
  let status: string;
  if (user) {
    await db.update(schema.users).set({ passwordHash }).where(eq(schema.users.id, user.id));
    status = "updated";
  } else {
    [user] = await db
      .insert(schema.users)
      .values({ id: newId(), email, name: email.split("@")[0], passwordHash })
      .returning();
    status = "created";
  }

  const [m] = await db
    .select()
    .from(schema.treeMembers)
    .where(and(eq(schema.treeMembers.treeId, tree.id), eq(schema.treeMembers.userId, user.id)));
  if (m) {
    await db
      .update(schema.treeMembers)
      .set({ role })
      .where(and(eq(schema.treeMembers.treeId, tree.id), eq(schema.treeMembers.userId, user.id)));
  } else {
    await db.insert(schema.treeMembers).values({ treeId: tree.id, userId: user.id, role });
  }

  out.push({ email, password, role, status });
}

console.log(`\nTree: ${tree.name} (${tree.id})\n`);
console.table(out);
console.log("\nShare these once; tell holders to change their password at /forgot or /settings.");
