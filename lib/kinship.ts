// Pure family-graph algorithms — no database, fully unit-testable.
// The MVP works in memory: one family is at most a few hundred people, so
// BFS beats a recursive CTE for correctness and clarity. Swap to SQL later
// if a tree ever gets large.

export type GraphPerson = {
  id: string;
  given?: string;
  surname?: string;
  nick?: string;
  gender?: string; // "M" | "F" | "U"
  birthDate?: string;
  deathDate?: string;
};

export type GraphFamily = {
  id: string;
  partner1Id: string | null;
  partner2Id: string | null;
  children: string[];
};

export type FamilyGraph = {
  people: Map<string, GraphPerson>;
  parentsOf: Map<string, Set<string>>;
  childrenOf: Map<string, Set<string>>;
  partnersOf: Map<string, Set<string>>;
};

function add(map: Map<string, Set<string>>, k: string, v: string) {
  if (!map.has(k)) map.set(k, new Set());
  map.get(k)!.add(v);
}

export function buildGraph(people: GraphPerson[], families: GraphFamily[]): FamilyGraph {
  const g: FamilyGraph = {
    people: new Map(people.map((p) => [p.id, p])),
    parentsOf: new Map(),
    childrenOf: new Map(),
    partnersOf: new Map(),
  };
  for (const f of families) {
    const parents = [f.partner1Id, f.partner2Id].filter((x): x is string => !!x);
    if (parents.length === 2) {
      add(g.partnersOf, parents[0], parents[1]);
      add(g.partnersOf, parents[1], parents[0]);
    }
    for (const child of f.children) {
      for (const parent of parents) {
        add(g.parentsOf, child, parent);
        add(g.childrenOf, parent, child);
      }
    }
  }
  return g;
}

/** handle -> generations up to reach it (self = 0). */
export function ancestorDistances(g: FamilyGraph, id: string): Map<string, number> {
  const dist = new Map<string, number>([[id, 0]]);
  const queue: string[] = [id];
  while (queue.length) {
    const cur = queue.shift()!;
    const d = dist.get(cur)!;
    for (const p of g.parentsOf.get(cur) ?? []) {
      if (!dist.has(p)) {
        dist.set(p, d + 1);
        queue.push(p);
      }
    }
  }
  return dist;
}

/** handle -> generations down to reach it (self = 0). */
export function descendantDistances(g: FamilyGraph, id: string): Map<string, number> {
  const dist = new Map<string, number>([[id, 0]]);
  const queue: string[] = [id];
  while (queue.length) {
    const cur = queue.shift()!;
    const d = dist.get(cur)!;
    for (const c of g.childrenOf.get(cur) ?? []) {
      if (!dist.has(c)) {
        dist.set(c, d + 1);
        queue.push(c);
      }
    }
  }
  return dist;
}

export type PathStep = { id: string; relToPrev: "" | "parent" | "child" | "partner" };

/** Shortest chain of relationships between two people, or null. */
export function shortestPath(g: FamilyGraph, a: string, b: string): PathStep[] | null {
  if (a === b) return [{ id: a, relToPrev: "" }];
  const prev = new Map<string, { from: string; rel: PathStep["relToPrev"] }>();
  const seen = new Set([a]);
  const queue: string[] = [a];
  while (queue.length) {
    const cur = queue.shift()!;
    const neighbours: Array<[string, PathStep["relToPrev"]]> = [];
    for (const p of g.parentsOf.get(cur) ?? []) neighbours.push([p, "parent"]);
    for (const c of g.childrenOf.get(cur) ?? []) neighbours.push([c, "child"]);
    for (const s of g.partnersOf.get(cur) ?? []) neighbours.push([s, "partner"]);
    for (const [next, rel] of neighbours) {
      if (seen.has(next)) continue;
      seen.add(next);
      prev.set(next, { from: cur, rel });
      if (next === b) {
        const chain: PathStep[] = [{ id: b, relToPrev: rel }];
        let step = prev.get(b)!;
        while (step.from !== a) {
          chain.unshift({ id: step.from, relToPrev: prev.get(step.from)!.rel });
          step = prev.get(step.from)!;
        }
        chain.unshift({ id: a, relToPrev: "" });
        return chain;
      }
      queue.push(next);
    }
  }
  return null;
}

// --- naming --------------------------------------------------------------

const ORDINALS = [
  "zeroth", "first", "second", "third", "fourth", "fifth", "sixth",
  "seventh", "eighth", "ninth", "tenth",
];
function ordinal(n: number): string {
  return ORDINALS[n] ?? `${n}th`;
}
function removed(n: number): string {
  if (n === 0) return "";
  if (n === 1) return " once removed";
  if (n === 2) return " twice removed";
  if (n === 3) return " three times removed";
  return ` ${n} times removed`;
}
function greats(n: number): string {
  // n = number of "great"s
  if (n <= 0) return "";
  if (n <= 3) return "great-".repeat(n);
  return `${n}×great-`;
}
function byGender(gender: string | undefined, f: string, m: string, n: string): string {
  if (gender === "F") return f;
  if (gender === "M") return m;
  return n;
}

export type Kinship = {
  /** how B relates to A, e.g. "first cousin once removed", "grandmother" */
  label: string;
  /** the reverse: how A relates to B */
  reverse: string;
  commonAncestorIds: string[];
  /** true when no blood link, but a path exists (in-laws, step, etc.) */
  viaConnectionOnly: boolean;
};

/**
 * Describe how person B relates to person A. Covers the common terms:
 * parent/child lines, siblings, aunt/uncle & niece/nephew, and Nth
 * cousins M times removed. Half / step / in-law naming is intentionally
 * out of scope for the MVP.
 */
export function kinship(g: FamilyGraph, aId: string, bId: string): Kinship {
  if (aId === bId) {
    return { label: "the same person", reverse: "the same person", commonAncestorIds: [], viaConnectionOnly: false };
  }

  const bGender = g.people.get(bId)?.gender;
  const aGender = g.people.get(aId)?.gender;

  if (g.partnersOf.get(aId)?.has(bId)) {
    const spouseB = byGender(bGender, "wife", "husband", "spouse");
    const spouseA = byGender(aGender, "wife", "husband", "spouse");
    return { label: spouseB, reverse: spouseA, commonAncestorIds: [], viaConnectionOnly: false };
  }

  const ancA = ancestorDistances(g, aId);
  const ancB = ancestorDistances(g, bId);

  let bestTotal = Infinity;
  let mrcas: Array<{ id: string; da: number; db: number }> = [];
  for (const [id, da] of ancA) {
    const db = ancB.get(id);
    if (db === undefined) continue;
    const total = da + db;
    if (total < bestTotal) {
      bestTotal = total;
      mrcas = [{ id, da, db }];
    } else if (total === bestTotal) {
      mrcas.push({ id, da, db });
    }
  }

  if (mrcas.length === 0) {
    const path = shortestPath(g, aId, bId);
    return {
      label: path ? "related (through marriage or a step-relationship)" : "no known relationship",
      reverse: path ? "related (through marriage or a step-relationship)" : "no known relationship",
      commonAncestorIds: [],
      viaConnectionOnly: !!path,
    };
  }

  // prefer the MRCA nearest to A, then to B, for the primary label
  mrcas.sort((x, y) => x.da - y.da || x.db - y.db);
  const { da, db } = mrcas[0];

  // a shared couple (two partners) is one ancestral line, not two — only
  // genuinely independent lines (e.g. double cousins) warrant the note
  const lines: string[][] = [];
  for (const m of mrcas) {
    const grp = lines.find((g2) => g2.some((id) => g.partnersOf.get(id)?.has(m.id)));
    if (grp) grp.push(m.id);
    else lines.push([m.id]);
  }
  const extra = lines.length > 1 ? " (related on more than one line)" : "";
  const commonAncestorIds = [...new Set(mrcas.map((m) => m.id))];

  const mk = (label: string, reverse: string): Kinship => ({
    label: label + extra,
    reverse: reverse + extra,
    commonAncestorIds,
    viaConnectionOnly: false,
  });

  // direct line: A is an ancestor of B
  if (da === 0) {
    if (db === 1) return mk(byGender(bGender, "daughter", "son", "child"), byGender(aGender, "mother", "father", "parent"));
    if (db === 2) return mk(byGender(bGender, "granddaughter", "grandson", "grandchild"), byGender(aGender, "grandmother", "grandfather", "grandparent"));
    const gp = greats(db - 2);
    return mk(
      `${gp}${byGender(bGender, "granddaughter", "grandson", "grandchild")}`,
      `${gp}${byGender(aGender, "grandmother", "grandfather", "grandparent")}`,
    );
  }
  // direct line: B is an ancestor of A
  if (db === 0) {
    if (da === 1) return mk(byGender(bGender, "mother", "father", "parent"), byGender(aGender, "daughter", "son", "child"));
    if (da === 2) return mk(byGender(bGender, "grandmother", "grandfather", "grandparent"), byGender(aGender, "granddaughter", "grandson", "grandchild"));
    const gp = greats(da - 2);
    return mk(
      `${gp}${byGender(bGender, "grandmother", "grandfather", "grandparent")}`,
      `${gp}${byGender(aGender, "granddaughter", "grandson", "grandchild")}`,
    );
  }

  if (da === 1 && db === 1) {
    return mk(byGender(bGender, "sister", "brother", "sibling"), byGender(aGender, "sister", "brother", "sibling"));
  }

  // A is one generation below the common ancestor, B is deeper:
  // A is B's (great-)aunt/uncle, so B is A's (great-)niece/nephew.
  if (da === 1 && db >= 2) {
    const gp = greats(db - 2);
    return mk(
      `${gp}${byGender(bGender, "niece", "nephew", "niece or nephew")}`,
      `${gp}${byGender(aGender, "aunt", "uncle", "aunt or uncle")}`,
    );
  }
  // mirror image: B is A's (great-)aunt/uncle.
  if (db === 1 && da >= 2) {
    const gp = greats(da - 2);
    return mk(
      `${gp}${byGender(bGender, "aunt", "uncle", "aunt or uncle")}`,
      `${gp}${byGender(aGender, "niece", "nephew", "niece or nephew")}`,
    );
  }

  // cousins
  const degree = Math.min(da, db) - 1;
  const rem = Math.abs(da - db);
  const term = `${ordinal(degree)} cousin${removed(rem)}`;
  return mk(term, term);
}
