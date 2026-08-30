import { redirect } from "next/navigation";
import { and, asc, eq } from "drizzle-orm";
import { auth } from "@/auth";
import { db } from "@/db";
import { users, trees, treeMembers } from "@/db/schema";

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

/** The one family tree — single-tree deployment. */
export async function getPrimaryTree() {
  const [t] = await db.select().from(trees).orderBy(asc(trees.createdAt)).limit(1);
  return t ?? null;
}

export type Membership = {
  user: NonNullable<Awaited<ReturnType<typeof getCurrentUser>>>;
  tree: NonNullable<Awaited<ReturnType<typeof getPrimaryTree>>>;
  role: string;
};

export async function requireMember(): Promise<Membership> {
  const user = await requireUser();
  const tree = await getPrimaryTree();
  if (!tree) redirect("/setup");

  const [m] = await db
    .select()
    .from(treeMembers)
    .where(and(eq(treeMembers.treeId, tree.id), eq(treeMembers.userId, user.id)));

  // provisionUser adds a membership on sign-in; this is a safety net
  if (!m) redirect("/no-access");
  return { user, tree, role: m.role };
}

export function canEdit(role: string) {
  return role === "owner" || role === "editor";
}
export function isOwner(role: string) {
  return role === "owner";
}
