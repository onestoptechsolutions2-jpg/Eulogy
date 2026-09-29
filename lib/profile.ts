import { and, eq, or, sql as dsql } from "drizzle-orm";
import { db } from "@/db";
import { people, users, families, familyChildren } from "@/db/schema";
import type { Person } from "@/db/schema";

/** The person this user is. Every user has exactly one (users.person_id). */
export async function getClaimedPerson(
  treeId: string,
  userId: string,
): Promise<Person | null> {
  const [row] = await db
    .select({ p: people })
    .from(users)
    .innerJoin(people, and(eq(people.id, users.personId), eq(people.treeId, users.treeId)))
    .where(and(eq(users.id, userId), eq(users.treeId, treeId)));
  return row?.p ?? null;
}

/** Ids of people in this family who have a login. */
export async function linkedPersonIds(treeId: string): Promise<Set<string>> {
  const rows = await db.select({ id: users.personId }).from(users).where(eq(users.treeId, treeId));
  return new Set(rows.map((r) => r.id));
}

export function canEditPerson(
  role: string,
  person: Pick<Person, "id">,
  user: { personId: string },
): boolean {
  if (role === "owner" || role === "editor") return true;
  return person.id === user.personId;
}

/** A person nobody has filled in yet: no relatives, no photo, bio or dates. */
export async function isPlaceholder(treeId: string, person: Person): Promise<boolean> {
  if (person.photoUrl || person.bio || person.birthDate || person.deathDate) return false;
  const [rel] = await db
    .select({ id: families.id })
    .from(families)
    .where(
      and(
        eq(families.treeId, treeId),
        or(eq(families.partner1Id, person.id), eq(families.partner2Id, person.id)),
      ),
    )
    .limit(1);
  if (rel) return false;
  const [child] = await db
    .select({ id: familyChildren.childId })
    .from(familyChildren)
    .where(eq(familyChildren.childId, person.id))
    .limit(1);
  return !child;
}

export type LinkResult = "ok" | "notfound" | "taken" | "already-filled";

/**
 * Point this account at a different, existing person in the same family
 * ("this is me"). Refused if someone else already is that person, or if the
 * account's current person holds real data. The account's old, empty
 * placeholder person is deleted so it does not litter the tree.
 */
export async function linkUserToPerson(
  user: { id: string; treeId: string; personId: string },
  targetId: string,
): Promise<LinkResult> {
  if (targetId === user.personId) return "ok";
  const [target] = await db
    .select()
    .from(people)
    .where(and(eq(people.treeId, user.treeId), eq(people.id, targetId)));
  if (!target) return "notfound";

  const [taken] = await db.select({ id: users.id }).from(users).where(eq(users.personId, targetId));
  if (taken) return "taken";

  const [current] = await db
    .select()
    .from(people)
    .where(and(eq(people.treeId, user.treeId), eq(people.id, user.personId)));
  if (current && !(await isPlaceholder(user.treeId, current))) return "already-filled";

  await db.update(users).set({ personId: targetId }).where(eq(users.id, user.id));
  if (current) {
    await db
      .delete(people)
      .where(and(eq(people.treeId, user.treeId), eq(people.id, current.id)));
  }
  return "ok";
}

/** True when an account is this person, so the person must not be deleted. */
export async function personHasAccount(personId: string): Promise<boolean> {
  const [u] = await db
    .select({ n: dsql<number>`1` })
    .from(users)
    .where(eq(users.personId, personId))
    .limit(1);
  return !!u;
}
