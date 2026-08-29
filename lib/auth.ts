import { redirect } from "next/navigation";
import { and, asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { users, trees, treeMembers, loginTokens, invitations, people } from "@/db/schema";
import { getSession } from "./session";
import { newId, newToken } from "./ids";

export function appUrl() {
  return (process.env.APP_URL ?? "http://localhost:3000").replace(/\/$/, "");
}

function ownerEmail() {
  return (process.env.OWNER_EMAIL ?? "").trim().toLowerCase();
}

export async function getCurrentUser() {
  const session = await getSession();
  if (!session.userId) return null;
  const [u] = await db.select().from(users).where(eq(users.id, session.userId));
  return u ?? null;
}

export async function requireUser() {
  const u = await getCurrentUser();
  if (!u) redirect("/login");
  return u;
}

/** The one family tree — this deployment is invite-only, single-tree. */
export async function getPrimaryTree() {
  const [t] = await db.select().from(trees).orderBy(asc(trees.createdAt)).limit(1);
  return t ?? null;
}

export type Membership = {
  user: Awaited<ReturnType<typeof getCurrentUser>> & object;
  tree: NonNullable<Awaited<ReturnType<typeof getPrimaryTree>>>;
  role: string;
};

export async function requireMember(): Promise<Membership> {
  const user = await requireUser();
  const tree = await getPrimaryTree();
  if (!tree) redirect("/setup");

  let [m] = await db
    .select()
    .from(treeMembers)
    .where(and(eq(treeMembers.treeId, tree.id), eq(treeMembers.userId, user.id)));

  // invite-only, single tree: any live invitation for this address is
  // adopted on first authenticated visit — no separate "accept" step.
  if (!m) {
    const accepted = await acceptPendingInvites(user.id, user.email, tree.id);
    if (accepted) {
      [m] = await db
        .select()
        .from(treeMembers)
        .where(and(eq(treeMembers.treeId, tree.id), eq(treeMembers.userId, user.id)));
    }
  }

  if (!m) redirect("/no-access");
  return { user, tree, role: m.role };
}

async function acceptPendingInvites(userId: string, email: string, treeId: string): Promise<boolean> {
  const pending = await db
    .select()
    .from(invitations)
    .where(and(eq(invitations.email, email.toLowerCase()), eq(invitations.treeId, treeId)));
  let did = false;
  for (const inv of pending) {
    if (inv.acceptedAt || inv.expiresAt.getTime() < Date.now()) continue;
    await db
      .insert(treeMembers)
      .values({ treeId, userId, role: inv.role })
      .onConflictDoNothing();
    await db.update(invitations).set({ acceptedAt: new Date() }).where(eq(invitations.id, inv.id));
    if (inv.personId) {
      await db
        .update(people)
        .set({ claimedByUserId: userId })
        .where(and(eq(people.treeId, treeId), eq(people.id, inv.personId)));
    }
    did = true;
  }
  return did;
}

export function canEdit(role: string) {
  return role === "owner" || role === "editor";
}
export function isOwner(role: string) {
  return role === "owner";
}

/**
 * Issue a magic-link URL — but only for an address that already belongs to
 * the tree, has a pending invitation, or is the configured OWNER_EMAIL.
 * Returns null otherwise (the caller shows the same "check your email"
 * message either way, so membership isn't leaked).
 */
export async function issueLoginLink(emailRaw: string): Promise<string | null> {
  const email = emailRaw.trim().toLowerCase();
  if (!email || !email.includes("@")) return null;

  const isOwner = email === ownerEmail();
  let [user] = await db.select().from(users).where(eq(users.email, email));

  if (!user) {
    const [invite] = await db.select().from(invitations).where(eq(invitations.email, email));
    if (!isOwner && !invite) return null;
    [user] = await db.insert(users).values({ id: newId(), email }).returning();
  }

  const token = newToken();
  await db.insert(loginTokens).values({
    token,
    userId: user.id,
    expiresAt: new Date(Date.now() + 15 * 60 * 1000),
  });
  return `${appUrl()}/auth/callback?token=${token}`;
}

/** Validate a magic-link token, mark it used, return the user id. */
export async function consumeLoginToken(token: string): Promise<string | null> {
  const [row] = await db.select().from(loginTokens).where(eq(loginTokens.token, token));
  if (!row || row.usedAt || row.expiresAt.getTime() < Date.now()) return null;
  await db.update(loginTokens).set({ usedAt: new Date() }).where(eq(loginTokens.token, token));

  const [u] = await db.select().from(users).where(eq(users.id, row.userId));
  if (u && u.email === ownerEmail()) await ensureOwnerTree(u.id);
  return row.userId;
}

async function ensureOwnerTree(userId: string) {
  const existing = await getPrimaryTree();
  if (existing) {
    await db
      .insert(treeMembers)
      .values({ treeId: existing.id, userId, role: "owner" })
      .onConflictDoNothing();
    return;
  }
  const treeId = newId();
  await db.insert(trees).values({ id: treeId, name: "Family Tree", ownerId: userId });
  await db.insert(treeMembers).values({ treeId, userId, role: "owner" });
}
