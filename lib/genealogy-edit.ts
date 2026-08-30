import { and, eq, sql as dsql } from "drizzle-orm";
import { db } from "@/db";
import { people, families, familyChildren } from "@/db/schema";
import { newId } from "./ids";

// All parent/child relationships go THROUGH a family (union) record — the
// standard genealogy model (GEDCOM FAM, Gramps). There are no direct
// person→person parent edges.

export type PersonInput = {
  given?: string;
  surname?: string;
  prefix?: string;
  suffix?: string;
  title?: string;
  nick?: string;
  gender?: string;
  birthDate?: string;
  deathDate?: string;
};

const s = (v: string | undefined, max = 200) => (v ?? "").trim().slice(0, max);

export async function createPerson(treeId: string, input: PersonInput): Promise<string> {
  const id = newId();
  const g = s(input.gender, 1).toUpperCase();
  const deathDate = s(input.deathDate, 40);
  await db.insert(people).values({
    id,
    treeId,
    given: s(input.given, 120),
    surname: s(input.surname, 120),
    prefix: s(input.prefix, 120),
    suffix: s(input.suffix, 60),
    title: s(input.title, 60),
    nick: s(input.nick, 60),
    gender: g === "M" || g === "F" ? g : "U",
    birthDate: s(input.birthDate, 40),
    deathDate,
    living: !deathDate,
  });
  return id;
}

const REL_TYPES = ["Married", "Partners", "Civil Union", "Unknown"];

export async function createFamily(
  treeId: string,
  opts: { partner1Id?: string | null; partner2Id?: string | null; relType?: string },
): Promise<string> {
  const id = newId();
  await db.insert(families).values({
    id,
    treeId,
    partner1Id: opts.partner1Id || null,
    partner2Id: opts.partner2Id || null,
    relType: REL_TYPES.includes(opts.relType ?? "") ? opts.relType! : "Unknown",
  });
  return id;
}

export async function updateFamily(
  treeId: string,
  familyId: string,
  patch: { partner1Id?: string | null; partner2Id?: string | null; relType?: string },
) {
  const set: Record<string, unknown> = {};
  if ("partner1Id" in patch) set.partner1Id = patch.partner1Id || null;
  if ("partner2Id" in patch) set.partner2Id = patch.partner2Id || null;
  if (patch.relType && REL_TYPES.includes(patch.relType)) set.relType = patch.relType;
  if (Object.keys(set).length === 0) return;
  await db.update(families).set(set).where(and(eq(families.treeId, treeId), eq(families.id, familyId)));
}

export async function addChild(treeId: string, familyId: string, childId: string) {
  const [fam] = await db
    .select()
    .from(families)
    .where(and(eq(families.treeId, treeId), eq(families.id, familyId)));
  if (!fam) return;
  const [child] = await db
    .select({ id: people.id })
    .from(people)
    .where(and(eq(people.treeId, treeId), eq(people.id, childId)));
  if (!child) return;
  const [{ max }] = await db
    .select({ max: dsql<number>`coalesce(max(${familyChildren.seq}), -1)::int` })
    .from(familyChildren)
    .where(eq(familyChildren.familyId, familyId));
  await db
    .insert(familyChildren)
    .values({ familyId, childId, seq: (max ?? -1) + 1 })
    .onConflictDoNothing();
}

export async function removeChild(familyId: string, childId: string) {
  await db
    .delete(familyChildren)
    .where(and(eq(familyChildren.familyId, familyId), eq(familyChildren.childId, childId)));
}

export async function deleteFamily(treeId: string, familyId: string) {
  await db.delete(familyChildren).where(eq(familyChildren.familyId, familyId));
  await db.delete(families).where(and(eq(families.treeId, treeId), eq(families.id, familyId)));
}

/**
 * Delete a person and tidy up: drop them from any family's child list, clear
 * partner slots that pointed at them, then delete empty families.
 */
export async function deletePerson(treeId: string, personId: string) {
  await db.delete(familyChildren).where(eq(familyChildren.childId, personId));
  await db
    .update(families)
    .set({ partner1Id: null })
    .where(and(eq(families.treeId, treeId), eq(families.partner1Id, personId)));
  await db
    .update(families)
    .set({ partner2Id: null })
    .where(and(eq(families.treeId, treeId), eq(families.partner2Id, personId)));
  await db.delete(people).where(and(eq(people.treeId, treeId), eq(people.id, personId)));

  // remove families that now have no partners and no children
  const fams = await db.select().from(families).where(eq(families.treeId, treeId));
  for (const f of fams) {
    if (f.partner1Id || f.partner2Id) continue;
    const kids = await db
      .select({ n: dsql<number>`count(*)::int` })
      .from(familyChildren)
      .where(eq(familyChildren.familyId, f.id));
    if ((kids[0]?.n ?? 0) === 0) {
      await db.delete(families).where(eq(families.id, f.id));
    }
  }
}

export { REL_TYPES };
