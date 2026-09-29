import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { auth } from "@/auth";
import { db } from "@/db";
import { users, trees } from "@/db/schema";

export function appUrl() {
  return (process.env.APP_URL ?? "http://localhost:3000").replace(/\/$/, "");
}

export async function getCurrentUser() {
  const session = await auth();
  if (!session?.userId) return null;
  const [u] = await db.select().from(users).where(eq(users.id, session.userId));
  return u ?? null;
}

export async function requireUser() {
  const u = await getCurrentUser();
  if (!u) redirect("/login");
  return u;
}

export type Membership = {
  user: NonNullable<Awaited<ReturnType<typeof getCurrentUser>>>;
  tree: typeof trees.$inferSelect;
  role: string;
};

/** The signed-in user and their one family. users.tree_id is NOT NULL, so
 *  the family always exists; the redirect is only a safety net. */
export async function requireMember(): Promise<Membership> {
  const user = await requireUser();
  const [tree] = await db.select().from(trees).where(eq(trees.id, user.treeId));
  if (!tree) redirect("/no-access");
  return { user, tree, role: user.role };
}

export function canEdit(role: string) {
  return role === "owner" || role === "editor";
}
export function isOwner(role: string) {
  return role === "owner";
}
