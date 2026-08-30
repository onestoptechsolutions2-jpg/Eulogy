import { and, asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { users, trees, treeMembers, invitations, people } from "@/db/schema";
import { newId } from "./ids";

export async function getUserByEmail(email: string) {
  const [u] = await db.select().from(users).where(eq(users.email, email.toLowerCase()));
  return u ?? null;
}

function ownerEmail() {
  return (process.env.OWNER_EMAIL ?? "").trim().toLowerCase();
}

/**
 * Called on every sign-in. Upserts the user, then makes sure they belong
 * to the family tree:
 *   - OWNER_EMAIL  → owner (and creates the tree if it doesn't exist yet)
 *   - has a live invitation → the role it specifies (and claims its person)
 *   - anyone else → viewer
 */
export async function provisionUser({
  email,
  name,
  image,
}: {
  email: string;
  name: string;
  image: string;
}) {
  const e = email.toLowerCase();
  let user = await getUserByEmail(e);

  if (!user) {
    [user] = await db.insert(users).values({ id: newId(), email: e, name, image }).returning();
  } else if ((name && name !== user.name) || (image && image !== user.image)) {
    await db
      .update(users)
      .set({ name: name || user.name, image: image || user.image })
      .where(eq(users.id, user.id));
  }

  const isOwner = e === ownerEmail();
  let [tree] = await db.select().from(trees).orderBy(asc(trees.createdAt)).limit(1);

  if (!tree) {
    if (!isOwner) return user; // no tree and not the owner — nothing to join yet
    [tree] = await db
      .insert(trees)
      .values({ id: newId(), name: "Family Tree", ownerId: user.id })
      .returning();
  }

  const [existing] = await db
    .select()
    .from(treeMembers)
    .where(and(eq(treeMembers.treeId, tree.id), eq(treeMembers.userId, user.id)));

  if (existing) {
    if (isOwner && existing.role !== "owner") {
      await db
        .update(treeMembers)
        .set({ role: "owner" })
        .where(and(eq(treeMembers.treeId, tree.id), eq(treeMembers.userId, user.id)));
    }
    return user;
  }

  let role = isOwner ? "owner" : "viewer";
  let claimPersonId: string | null = null;

  if (!isOwner) {
    const [inv] = await db
      .select()
      .from(invitations)
      .where(and(eq(invitations.email, e), eq(invitations.treeId, tree.id)));
    if (inv && !inv.acceptedAt && inv.expiresAt.getTime() > Date.now()) {
      role = inv.role;
      claimPersonId = inv.personId ?? null;
      await db.update(invitations).set({ acceptedAt: new Date() }).where(eq(invitations.id, inv.id));
    }
  }

  await db
    .insert(treeMembers)
    .values({ treeId: tree.id, userId: user.id, role })
    .onConflictDoNothing();

  if (claimPersonId) {
    await db
      .update(people)
      .set({ claimedByUserId: user.id })
      .where(and(eq(people.treeId, tree.id), eq(people.id, claimPersonId)));
  }

  return user;
}
