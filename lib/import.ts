import { neon } from "@neondatabase/serverless";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { people } from "@/db/schema";
import type { ParsedGramps } from "./gramps";

/**
 * Wipe and reload the three genealogy tables for one tree from parsed
 * Gramps data, in a single atomic transaction (raw neon client — the
 * drizzle neon-http driver has no transaction support). Family-entered
 * fields on people (birth/death/bio/photo/living) are read first and
 * merged back so re-importing an updated export doesn't erase them.
 */
export async function replaceGenealogy(treeId: string, parsed: ParsedGramps) {
  const sql = neon(process.env.DATABASE_URL!);

  const prior = await db.select().from(people).where(eq(people.treeId, treeId));
  const priorBy = new Map(prior.map((p) => [p.id, p]));

  const queries = [
    sql`DELETE FROM family_children WHERE family_id IN (SELECT id FROM families WHERE tree_id = ${treeId})`,
    sql`DELETE FROM families WHERE tree_id = ${treeId}`,
    // people with a login are kept (and updated below if the file has them)
    sql`DELETE FROM people WHERE tree_id = ${treeId} AND id NOT IN (SELECT person_id FROM users WHERE tree_id = ${treeId})`,
  ];

  for (const p of parsed.people) {
    const kept = priorBy.get(p.handle);
    const birth = p.birthDate || kept?.birthDate || "";
    const death = p.deathDate || kept?.deathDate || "";
    const living = kept?.living === false ? false : !death;
    queries.push(sql`
      INSERT INTO people
        (id, tree_id, gramps_id, given, surname, prefix, suffix, title, nick,
         gender, birth_date, death_date, living, photo_url, bio, updated_at)
      VALUES
        (${p.handle}, ${treeId}, ${p.grampsId}, ${p.given}, ${p.surname}, ${p.prefix},
         ${p.suffix}, ${p.title}, ${p.nick}, ${p.gender}, ${birth}, ${death}, ${living},
         ${kept?.photoUrl ?? ""}, ${kept?.bio ?? ""}, now())
      ON CONFLICT (id) DO UPDATE SET
        gramps_id = EXCLUDED.gramps_id, given = EXCLUDED.given, surname = EXCLUDED.surname,
        prefix = EXCLUDED.prefix, suffix = EXCLUDED.suffix, title = EXCLUDED.title,
        nick = EXCLUDED.nick, gender = EXCLUDED.gender, birth_date = EXCLUDED.birth_date,
        death_date = EXCLUDED.death_date, living = EXCLUDED.living, updated_at = now()`);
  }

  for (const f of parsed.families) {
    queries.push(sql`
      INSERT INTO families (id, tree_id, gramps_id, partner1_id, partner2_id, rel_type)
      VALUES (${f.handle}, ${treeId}, ${f.grampsId}, ${f.partner1}, ${f.partner2}, ${f.relType})`);
  }

  for (const c of parsed.children) {
    queries.push(sql`
      INSERT INTO family_children (family_id, child_id, seq)
      VALUES (${c.familyHandle}, ${c.childHandle}, ${c.seq})`);
  }

  await sql.transaction(queries);
  return {
    people: parsed.people.length,
    families: parsed.families.length,
    children: parsed.children.length,
  };
}
