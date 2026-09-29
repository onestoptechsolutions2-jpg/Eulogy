import { and, desc, eq, gt, isNull } from "drizzle-orm";
import { db } from "@/db";
import { users, trees, invitations, people } from "@/db/schema";
import { newId } from "./ids";

/** "Amina Wanjiru Kamau" -> given "Amina", surname "Wanjiru Kamau". */
function splitName(full: string) {
  const [given = "", ...rest] = full.trim().split(/s+/);
  return { given, surname: rest.join(" ") };
}

export async function getUserByEmail(email: string) {
  const [u] = await db.select().from(users).where(eq(users.email, email.toLowerCase()));
  return u ?? null;
}

/**
 * The one place a user is created. Every user belongs to exactly one family
 * and is exactly one person:
 *   - a live invitation for this email → joins that family with the invited
 *     role, as the invited person if one was named
 *   - otherwise → a new family of their own, and they own it
 */
export async function createUserWithFamily({
  email,
  name,
  image = "",
  passwordHash = "",
}: {
  email: string;
  name: string;
  image?: string;
  passwordHash?: string;
}) {
  const e = email.toLowerCase();

  const [inv] = await db
    .select()
    .from(invitations)
    .where(
      and(
        eq(invitations.email, e),
        isNull(invitations.acceptedAt),
        gt(invitations.expiresAt, new Date()),
      ),
    )
    .orderBy(desc(invitations.createdAt))
    .limit(1);

  let treeId: string;
  let role: string;
  if (inv) {
    treeId = inv.treeId;
    role = inv.role;
  } else {
    treeId = newId();
    role = "owner";
    await db.insert(trees).values({
      id: treeId,
      name: `${name.trim() || e.split("@")[0]} family`,
    });
  }

  // The user is a person. An invitation may name an existing person to be;
  // otherwise (or if that person already has an account) make a new one.
  let personId: string | null = null;
  if (inv?.personId) {
    const [target] = await db
      .select({ id: people.id })
      .from(people)
      .where(and(eq(people.treeId, treeId), eq(people.id, inv.personId)));
    const [taken] = target
      ? await db.select({ id: users.id }).from(users).where(eq(users.personId, target.id))
      : [];
    if (target && !taken) personId = target.id;
  }
  if (!personId) {
    personId = newId();
    const { given, surname } = splitName(name || e.split("@")[0]);
    await db.insert(people).values({ id: personId, treeId, given, surname });
  }

  const [user] = await db
    .insert(users)
    .values({ id: newId(), email: e, name, image, passwordHash, treeId, role, personId })
    .returning();

  if (!inv) {
    await db.update(trees).set({ ownerId: user.id }).where(eq(trees.id, treeId));
  } else {
    await db.update(invitations).set({ acceptedAt: new Date() }).where(eq(invitations.id, inv.id));
  }

  return user;
}

/**
 * Called on every sign-in. Creates the user (and their family) on first
 * sign-in, and refreshes their name and photo afterwards.
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
  const user = await getUserByEmail(email);
  if (!user) return createUserWithFamily({ email, name, image });

  if ((name && name !== user.name) || (image && image !== user.image)) {
    await db
      .update(users)
      .set({ name: name || user.name, image: image || user.image })
      .where(eq(users.id, user.id));
  }
  return user;
}
