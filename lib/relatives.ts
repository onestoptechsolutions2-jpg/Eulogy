import type { FamilyGraph } from "./kinship";
import type { GenealogyFamily } from "./queries";
import type { Person } from "@/db/schema";

export function relativesOf(g: FamilyGraph, id: string) {
  const parents = [...(g.parentsOf.get(id) ?? [])];
  const partners = [...(g.partnersOf.get(id) ?? [])];
  const children = [...(g.childrenOf.get(id) ?? [])];
  const siblings = new Set<string>();
  for (const p of parents) {
    for (const c of g.childrenOf.get(p) ?? []) if (c !== id) siblings.add(c);
  }
  return { parents, partners, children, siblings: [...siblings] };
}

export type FamilyUnit = {
  id: string;
  relType: string;
  parents: Person[];
  children: Person[];
};

/** Flat, legible list of family units for the read-only tree page. */
export function familyUnits(peopleList: Person[], fams: GenealogyFamily[]): FamilyUnit[] {
  const byId = new Map(peopleList.map((p) => [p.id, p]));
  return fams
    .map((f) => ({
      id: f.grampsId || f.id,
      relType: f.relType,
      parents: [f.partner1Id, f.partner2Id]
        .filter((x): x is string => !!x)
        .map((x) => byId.get(x))
        .filter((x): x is Person => !!x),
      children: f.children.map((c) => byId.get(c)).filter((x): x is Person => !!x),
    }))
    .sort((a, b) => {
      const an = a.parents[0]?.surname ?? "";
      const bn = b.parents[0]?.surname ?? "";
      return an.localeCompare(bn);
    });
}

/** People who are never listed as a child anywhere — the top of the tree. */
export function rootPeople(peopleList: Person[], g: FamilyGraph): Person[] {
  return peopleList.filter((p) => (g.parentsOf.get(p.id)?.size ?? 0) === 0);
}
