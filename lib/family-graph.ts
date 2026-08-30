import { and, eq, inArray, or } from "drizzle-orm";
import { db } from "@/db";
import { families, familyChildren } from "@/db/schema";
import { newId } from "./ids";

// Minimal relationship wiring for self-onboarding. Each call adds one
// first-degree link between two people who already exist. It reuses an
// existing family row when there's an obvious slot, otherwise creates one.
// It deliberately doesn't try to be clever about multiple marriages —
// onboarding only ever wires a person's own parents, one partner, and
// their children.

async function familiesWithPartner(treeId: string, personId: string) {
  return db
    .select()
    .from(families)
    .where(
      and(
        eq(families.treeId, treeId),
        or(eq(families.partner1Id, personId), eq(families.partner2Id, personId)),
      ),
    );
}

async function familiesWithChild(treeId: string, childId: string) {
  const rows = await db
    .select({ familyId: familyChildren.familyId })
    .from(familyChildren)
    .where(eq(familyChildren.childId, childId));
  const ids = rows.map((r) => r.familyId);
  if (ids.length === 0) return [];
  return db
    .select()
    .from(families)
    .where(and(eq(families.treeId, treeId), inArray(families.id, ids)));
}

/** Record that `parentId` is a parent of `childId`. */
export async function linkParent(treeId: string, childId: string, parentId: string) {
  const [fam] = await familiesWithChild(treeId, childId);

  if (fam) {
    if (fam.partner1Id === parentId || fam.partner2Id === parentId) return;
    if (!fam.partner1Id) {
      await db.update(families).set({ partner1Id: parentId }).where(eq(families.id, fam.id));
    } else if (!fam.partner2Id) {
      await db.update(families).set({ partner2Id: parentId }).where(eq(families.id, fam.id));
    }
    return;
  }

  const id = newId();
  await db.insert(families).values({ id, treeId, partner1Id: parentId });
  await db.insert(familyChildren).values({ familyId: id, childId, seq: 0 });
}

/** Record that `aId` and `bId` are partners. */
export async function linkPartner(treeId: string, aId: string, bId: string) {
  const fams = await familiesWithPartner(treeId, aId);
  const existing = fams.find(
    (f) => f.partner1Id === bId || f.partner2Id === bId,
  );
  if (existing) return;

  const open = fams.find((f) => !f.partner1Id || !f.partner2Id);
  if (open) {
    const slot = !open.partner1Id ? "partner1Id" : "partner2Id";
    await db.update(families).set({ [slot]: bId }).where(eq(families.id, open.id));
    return;
  }

  await db.insert(families).values({ id: newId(), treeId, partner1Id: aId, partner2Id: bId });
}

/** Record that `childId` is a child of `parentId`. */
export async function linkChild(treeId: string, parentId: string, childId: string) {
  let [fam] = await familiesWithPartner(treeId, parentId);

  if (!fam) {
    const id = newId();
    await db.insert(families).values({ id, treeId, partner1Id: parentId });
    fam = { id, treeId, grampsId: "", partner1Id: parentId, partner2Id: null, relType: "Unknown" };
  }

  const kids = await db
    .select()
    .from(familyChildren)
    .where(eq(familyChildren.familyId, fam.id));
  if (kids.some((k) => k.childId === childId)) return;

  await db
    .insert(familyChildren)
    .values({ familyId: fam.id, childId, seq: kids.length });
}
