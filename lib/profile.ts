import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { people } from "@/db/schema";
import type { Person } from "@/db/schema";

/** The tree person this user has claimed as themselves, if any. */
export async function getClaimedPerson(
  treeId: string,
  userId: string,
): Promise<Person | null> {
  const [p] = await db
    .select()
    .from(people)
    .where(and(eq(people.treeId, treeId), eq(people.claimedByUserId, userId)));
  return p ?? null;
}

export function canEditPerson(
  role: string,
  person: Pick<Person, "claimedByUserId">,
  userId: string,
): boolean {
  if (role === "owner" || role === "editor") return true;
  return person.claimedByUserId === userId;
}
