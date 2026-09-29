import { eq } from "drizzle-orm";
import { db } from "@/db";
import { users, passwordResetTokens } from "@/db/schema";
import { newToken } from "./ids";
import { hashPassword } from "./password";
import { createUserWithFamily } from "./provision";

export async function emailTaken(email: string): Promise<boolean> {
  const [u] = await db.select().from(users).where(eq(users.email, email.toLowerCase()));
  return !!u;
}

export async function createPasswordUser(opts: {
  email: string;
  name: string;
  password: string;
}) {
  const email = opts.email.toLowerCase();
  return createUserWithFamily({
    email,
    name: opts.name || email.split("@")[0],
    passwordHash: await hashPassword(opts.password),
  });
}

export async function setUserPassword(userId: string, password: string) {
  await db
    .update(users)
    .set({ passwordHash: await hashPassword(password) })
    .where(eq(users.id, userId));
}

export async function createResetToken(userId: string): Promise<string> {
  const token = newToken();
  await db.insert(passwordResetTokens).values({
    token,
    userId,
    expiresAt: new Date(Date.now() + 60 * 60 * 1000),
  });
  return token;
}

/** Validate a reset token, mark it used, return the user id. */
export async function consumeResetToken(token: string): Promise<string | null> {
  const [row] = await db
    .select()
    .from(passwordResetTokens)
    .where(eq(passwordResetTokens.token, token));
  if (!row || row.usedAt || row.expiresAt.getTime() < Date.now()) return null;
  await db
    .update(passwordResetTokens)
    .set({ usedAt: new Date() })
    .where(eq(passwordResetTokens.token, token));
  return row.userId;
}
