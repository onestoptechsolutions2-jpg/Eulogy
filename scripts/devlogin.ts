// Dev helper: mint a magic-link URL for OWNER_EMAIL without sending email.
import "dotenv/config";
import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { eq } from "drizzle-orm";
import * as schema from "../db/schema.ts";
import { newToken } from "../lib/ids.ts";

const email = (process.argv[2] || process.env.OWNER_EMAIL || "").toLowerCase();
const db = drizzle(neon(process.env.DATABASE_URL!), { schema });

const [user] = await db.select().from(schema.users).where(eq(schema.users.email, email));
if (!user) {
  console.error(`No user for ${email}`);
  process.exit(1);
}
const token = newToken();
await db.insert(schema.loginTokens).values({
  token,
  userId: user.id,
  expiresAt: new Date(Date.now() + 15 * 60 * 1000),
});
console.log(`${process.env.APP_URL}/auth/callback?token=${token}`);
