import { and, eq, sql as dsql } from "drizzle-orm";
import { db } from "@/db";
import { people, families, familyChildren } from "@/db/schema";
import type { Person } from "@/db/schema";
import { buildGraph, type GraphFamily } from "./kinship";

export type GenealogyFamily = GraphFamily & { relType: string; grampsId: string };

export async function loadGenealogy(treeId: string): Promise<{
  people: Person[];
  families: GenealogyFamily[];
}> {
  const [pp, ff, cc] = await Promise.all([
    db.select().from(people).where(eq(people.treeId, treeId)),
    db.select().from(families).where(eq(families.treeId, treeId)),
    db.select().from(familyChildren),
  ]);

  const kids = new Map<string, string[]>();
  for (const row of cc) {
    if (!kids.has(row.familyId)) kids.set(row.familyId, []);
    kids.get(row.familyId)!.push(row.childId);
  }

  return {
    people: pp,
    families: ff.map((f) => ({
      id: f.id,
      partner1Id: f.partner1Id,
      partner2Id: f.partner2Id,
      children: kids.get(f.id) ?? [],
      relType: f.relType,
      grampsId: f.grampsId,
    })),
  };
}

export async function graphFor(treeId: string) {
  const { people: pp, families: ff } = await loadGenealogy(treeId);
  return { graph: buildGraph(pp, ff), people: pp, families: ff };
}

export async function getPerson(treeId: string, id: string): Promise<Person | null> {
  const [p] = await db
    .select()
    .from(people)
    .where(and(eq(people.treeId, treeId), eq(people.id, id)));
  return p ?? null;
}

/** Fuzzy name search via pg_trgm. */
export async function searchPeople(treeId: string, q: string, limit = 25): Promise<Person[]> {
  const term = q.trim();
  if (!term) return [];
  const name = dsql`lower(${people.given} || ' ' || ${people.surname})`;
  return db
    .select()
    .from(people)
    .where(and(eq(people.treeId, treeId), dsql`${name} % lower(${term})`))
    .orderBy(dsql`similarity(${name}, lower(${term})) desc`)
    .limit(limit);
}

export async function countPeople(treeId: string): Promise<number> {
  const [row] = await db
    .select({ n: dsql<number>`count(*)::int` })
    .from(people)
    .where(eq(people.treeId, treeId));
  return row?.n ?? 0;
}
