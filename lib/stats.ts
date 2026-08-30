import type { Person } from "@/db/schema";
import type { GenealogyFamily } from "./queries";

export type TreeStats = {
  people: number;
  families: number;
  avgChildren: number;
  gender: { F: number; M: number; U: number };
  living: number;
  deceased: number;
  completeness: { birth: number; death: number; parents: number; surname: number };
  surnames: { name: string; count: number }[];
  generations: { gen: number; count: number }[];
  siblingGroups: { parents: string; count: number }[];
};

export function computeStats(
  people: Person[],
  families: GenealogyFamily[],
  nameOfFamily: (f: GenealogyFamily) => string,
): TreeStats {
  const n = people.length || 1;
  const byId = new Map(people.map((p) => [p.id, p]));

  const gender = { F: 0, M: 0, U: 0 };
  for (const p of people) gender[(["F", "M"].includes(p.gender) ? p.gender : "U") as "F" | "M" | "U"]++;

  const deceased = people.filter((p) => !!p.deathDate || !p.living).length;

  const withBirth = people.filter((p) => p.birthDate).length;
  const withDeath = people.filter((p) => p.deathDate).length;
  const withSurname = people.filter((p) => p.surname).length;

  const hasParent = new Set<string>();
  for (const f of families) for (const c of f.children) hasParent.add(c);

  // surnames
  const scount = new Map<string, number>();
  for (const p of people) {
    const key = [p.prefix, p.surname].filter(Boolean).join(" ").trim() || "(no surname)";
    scount.set(key, (scount.get(key) ?? 0) + 1);
  }
  const surnames = [...scount.entries()]
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 12);

  // generations (roots = 0, child = max(parent)+1)
  const parentsOf = new Map<string, string[]>();
  for (const f of families) {
    const ps = [f.partner1Id, f.partner2Id].filter((x): x is string => !!x);
    for (const c of f.children) parentsOf.set(c, (parentsOf.get(c) ?? []).concat(ps));
  }
  const gen = new Map<string, number>();
  for (const p of people) if (!parentsOf.get(p.id)?.length) gen.set(p.id, 0);
  for (let i = 0; i < people.length + 2; i++) {
    let changed = false;
    for (const f of families) {
      const pg = [f.partner1Id, f.partner2Id]
        .filter((x): x is string => !!x)
        .map((x) => gen.get(x) ?? 0);
      const base = pg.length ? Math.max(...pg) : 0;
      for (const c of f.children) {
        if ((gen.get(c) ?? -1) < base + 1) {
          gen.set(c, base + 1);
          changed = true;
        }
      }
    }
    if (!changed) break;
  }
  for (const p of people) if (!gen.has(p.id)) gen.set(p.id, 0);
  const gcount = new Map<number, number>();
  for (const v of gen.values()) gcount.set(v, (gcount.get(v) ?? 0) + 1);
  const generations = [...gcount.entries()]
    .map(([g, count]) => ({ gen: g, count }))
    .sort((a, b) => a.gen - b.gen);

  const siblingGroups = families
    .filter((f) => f.children.length >= 3)
    .map((f) => ({ parents: nameOfFamily(f), count: f.children.length }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 6);

  const totalChildren = families.reduce((s, f) => s + f.children.length, 0);

  return {
    people: people.length,
    families: families.length,
    avgChildren: families.length ? totalChildren / families.length : 0,
    gender,
    living: people.length - deceased,
    deceased,
    completeness: {
      birth: Math.round((withBirth / n) * 100),
      death: Math.round((withDeath / n) * 100),
      parents: Math.round((hasParent.size / n) * 100),
      surname: Math.round((withSurname / n) * 100),
    },
    surnames,
    generations,
    siblingGroups,
  };
}
