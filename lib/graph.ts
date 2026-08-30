import type { Person } from "@/db/schema";
import type { GenealogyFamily } from "./queries";
import { shortName } from "./names";

// A genealogy graph is best drawn as a BIPARTITE graph: person nodes plus
// small "union" (family) nodes. Every parent→child link routes through a
// union node, which is what makes remarriages and single parents render
// cleanly (this is how Gramps' graph view and most serious tools do it).

export type GNode =
  | { kind: "person"; id: string; x: number; y: number; label: string; gender: string; dead: boolean }
  | { kind: "union"; id: string; x: number; y: number; rel: string };

export type GEdge = { from: string; to: string; kind: "partner" | "child" };

export type GraphLayout = {
  nodes: GNode[];
  edges: GEdge[];
  width: number;
  height: number;
};

const COL = 150;
const ROW = 66; // half-generation step; persons on even rows, unions on odd

export function buildLayout(people: Person[], families: GenealogyFamily[]): GraphLayout {
  const byId = new Map(people.map((p) => [p.id, p]));
  const parentsOf = new Map<string, string[]>();
  const partnerFamilies = new Map<string, GenealogyFamily[]>();
  for (const f of families) {
    for (const pid of [f.partner1Id, f.partner2Id]) {
      if (!pid) continue;
      if (!partnerFamilies.has(pid)) partnerFamilies.set(pid, []);
      partnerFamilies.get(pid)!.push(f);
    }
    for (const c of f.children) {
      const ps = [f.partner1Id, f.partner2Id].filter((x): x is string => !!x);
      parentsOf.set(c, (parentsOf.get(c) ?? []).concat(ps));
    }
  }

  // generation numbers: roots (no parents) = 0; child = max(parent)+1
  const gen = new Map<string, number>();
  for (const p of people) if (!(parentsOf.get(p.id)?.length)) gen.set(p.id, 0);
  for (let iter = 0; iter < people.length + 2; iter++) {
    let changed = false;
    for (const f of families) {
      const pg = [f.partner1Id, f.partner2Id]
        .filter((x): x is string => !!x)
        .map((x) => gen.get(x) ?? 0);
      const base = pg.length ? Math.max(...pg) : Math.min(...f.children.map((c) => gen.get(c) ?? 1)) - 1;
      for (const c of f.children) {
        const want = base + 1;
        if ((gen.get(c) ?? -Infinity) < want) {
          gen.set(c, want);
          changed = true;
        }
      }
    }
    if (!changed) break;
  }
  for (const p of people) if (!gen.has(p.id)) gen.set(p.id, 0);
  const minG = Math.min(...[...gen.values()], 0);
  for (const [k, v] of gen) gen.set(k, v - minG);

  // DFS order from roots, so family clusters stay adjacent
  const order: string[] = [];
  const seen = new Set<string>();
  const visit = (pid: string) => {
    if (seen.has(pid) || !byId.has(pid)) return;
    seen.add(pid);
    order.push(pid);
    for (const f of partnerFamilies.get(pid) ?? []) for (const c of f.children) visit(c);
  };
  people
    .filter((p) => (gen.get(p.id) ?? 0) === 0)
    .sort((a, b) => shortName(a).localeCompare(shortName(b)))
    .forEach((p) => visit(p.id));
  for (const p of people) visit(p.id);

  // x per generation, in DFS order
  const rows = new Map<number, string[]>();
  for (const pid of order) {
    const g = gen.get(pid) ?? 0;
    if (!rows.has(g)) rows.set(g, []);
    rows.get(g)!.push(pid);
  }
  const px = new Map<string, number>();
  const py = new Map<string, number>();
  let maxCols = 0;
  for (const [g, ids] of rows) {
    maxCols = Math.max(maxCols, ids.length);
    ids.forEach((pid, i) => {
      px.set(pid, i * COL);
      py.set(pid, g * 2 * ROW);
    });
  }

  const nodes: GNode[] = people
    .filter((p) => px.has(p.id))
    .map((p) => ({
      kind: "person",
      id: p.id,
      x: px.get(p.id)!,
      y: py.get(p.id)!,
      label: shortName(p),
      gender: p.gender,
      dead: !!p.deathDate || !p.living,
    }));

  const edges: GEdge[] = [];
  for (const f of families) {
    const partners = [f.partner1Id, f.partner2Id].filter((x): x is string => !!x).filter((x) => px.has(x));
    const kids = f.children.filter((c) => px.has(c));
    if (!partners.length && !kids.length) continue;
    const anchorXs = (partners.length ? partners : kids).map((x) => px.get(x)!);
    const anchorGs = (partners.length ? partners : kids).map((x) => (gen.get(x) ?? 0));
    const ux = anchorXs.reduce((s, v) => s + v, 0) / anchorXs.length;
    const ug = partners.length ? Math.max(...anchorGs) : Math.min(...anchorGs) - 1;
    const uy = ug * 2 * ROW + ROW;
    const uid = `u:${f.id}`;
    nodes.push({ kind: "union", id: uid, x: ux, y: uy, rel: f.relType });
    for (const pid of partners) edges.push({ from: pid, to: uid, kind: "partner" });
    for (const c of kids) edges.push({ from: uid, to: c, kind: "child" });
  }

  const maxG = Math.max(...[...gen.values()], 0);
  return {
    nodes,
    edges,
    width: Math.max(maxCols, 1) * COL + COL,
    height: (maxG * 2 + 1) * ROW + ROW,
  };
}
