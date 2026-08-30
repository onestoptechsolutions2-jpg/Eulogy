import { and, asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { eulogies, eulogyEntries } from "@/db/schema";
import type { Eulogy, EulogyEntry } from "@/db/schema";
import { newId, newToken } from "./ids";

export async function getEulogyByPerson(
  treeId: string,
  personId: string,
): Promise<Eulogy | null> {
  const [e] = await db
    .select()
    .from(eulogies)
    .where(and(eq(eulogies.treeId, treeId), eq(eulogies.personId, personId)));
  return e ?? null;
}

export async function getEulogyByToken(token: string): Promise<Eulogy | null> {
  if (!token) return null;
  const [e] = await db.select().from(eulogies).where(eq(eulogies.shareToken, token));
  return e ?? null;
}

/** Get the person's eulogy, creating an empty one on first use. */
export async function ensureEulogy(
  treeId: string,
  personId: string,
  userId: string,
): Promise<Eulogy> {
  const existing = await getEulogyByPerson(treeId, personId);
  if (existing) return existing;
  const [created] = await db
    .insert(eulogies)
    .values({
      id: newId(),
      treeId,
      personId,
      shareToken: newToken(),
      createdByUserId: userId,
    })
    .returning();
  return created;
}

export async function listEntries(
  eulogyId: string,
  statuses: EulogyEntry["status"][] = ["published"],
): Promise<EulogyEntry[]> {
  const rows = await db
    .select()
    .from(eulogyEntries)
    .where(eq(eulogyEntries.eulogyId, eulogyId))
    .orderBy(asc(eulogyEntries.createdAt));
  return rows.filter((r) => statuses.includes(r.status));
}
