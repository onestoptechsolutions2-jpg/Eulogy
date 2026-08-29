import { neon } from "@neondatabase/serverless";

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL is not set. Copy it from your Neon project's Connection Details " +
    "(the pooled 'postgresql://...' string) into .env locally, or into the Vercel " +
    "project's Environment Variables."
  );
}

// Neon's HTTP driver: one round-trip per query, no connection to keep alive
// — exactly what a serverless function wants. `sql` is a tagged template
// that parameterizes every value, so nothing here is string-concatenated
// into SQL. `sql.transaction([...])` batches many statements into a single
// atomic round-trip (used by the genealogy import).
export const sql = neon(process.env.DATABASE_URL);

// --- schema -------------------------------------------------------------
// There is no "on boot" on Vercel, so the schema is created lazily on the
// first request and cached for the life of the warm function. Every
// statement is idempotent.

let schemaReady;

export function ensureSchema() {
  if (!schemaReady) {
    // One HTTP round-trip (BEGIN … COMMIT) instead of ~15, so it only adds
    // a beat to the first request of a cold function. Genealogy cross-refs
    // are plain text, not SQL foreign keys: the importer is the only writer
    // and reloads all three tables together, so FKs would just add ordering
    // pain. A failed run clears the cache so the next request retries.
    schemaReady = sql
      .transaction([
        sql`CREATE TABLE IF NOT EXISTS site (
          id integer PRIMARY KEY DEFAULT 1 CHECK (id = 1),
          name text NOT NULL DEFAULT 'Their Full Name',
          birth_date text NOT NULL DEFAULT '',
          death_date text NOT NULL DEFAULT '',
          hero_photo text NOT NULL DEFAULT '',
          life_story text NOT NULL DEFAULT 'Their life story goes here.',
          service_details text NOT NULL DEFAULT '',
          donation_link text NOT NULL DEFAULT '',
          donation_label text NOT NULL DEFAULT '',
          gallery_json text NOT NULL DEFAULT '[]',
          subject_handle text NOT NULL DEFAULT ''
        )`,
        sql`ALTER TABLE site ADD COLUMN IF NOT EXISTS subject_handle text NOT NULL DEFAULT ''`,
        sql`CREATE TABLE IF NOT EXISTS contributions (
          id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
          name text NOT NULL,
          relationship text NOT NULL,
          relationship_detail text,
          memory text NOT NULL,
          about_handle text,
          status text NOT NULL DEFAULT 'pending',
          featured integer NOT NULL DEFAULT 0,
          created_at timestamptz NOT NULL DEFAULT now()
        )`,
        sql`ALTER TABLE contributions ADD COLUMN IF NOT EXISTS about_handle text`,
        sql`CREATE TABLE IF NOT EXISTS guestbook (
          id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
          name text NOT NULL,
          message text NOT NULL,
          created_at timestamptz NOT NULL DEFAULT now()
        )`,
        sql`CREATE TABLE IF NOT EXISTS people (
          handle text PRIMARY KEY,
          gramps_id text NOT NULL DEFAULT '',
          first_name text NOT NULL DEFAULT '',
          surname text NOT NULL DEFAULT '',
          prefix text NOT NULL DEFAULT '',
          suffix text NOT NULL DEFAULT '',
          title text NOT NULL DEFAULT '',
          nick text NOT NULL DEFAULT '',
          gender text NOT NULL DEFAULT 'U',
          birth_date text NOT NULL DEFAULT '',
          death_date text NOT NULL DEFAULT '',
          photo_url text NOT NULL DEFAULT '',
          bio text NOT NULL DEFAULT '',
          sort_key text NOT NULL DEFAULT ''
        )`,
        sql`CREATE TABLE IF NOT EXISTS families (
          handle text PRIMARY KEY,
          gramps_id text NOT NULL DEFAULT '',
          father_handle text,
          mother_handle text,
          rel_type text NOT NULL DEFAULT 'Unknown'
        )`,
        sql`CREATE TABLE IF NOT EXISTS family_children (
          family_handle text NOT NULL,
          child_handle text NOT NULL,
          seq integer NOT NULL DEFAULT 0,
          PRIMARY KEY (family_handle, child_handle)
        )`,
        sql`CREATE INDEX IF NOT EXISTS idx_contributions_status ON contributions(status)`,
        sql`CREATE INDEX IF NOT EXISTS idx_guestbook_created ON guestbook(created_at)`,
        sql`CREATE INDEX IF NOT EXISTS idx_family_children_child ON family_children(child_handle)`,
        sql`INSERT INTO site (id) VALUES (1) ON CONFLICT (id) DO NOTHING`,
      ])
      .catch((err) => {
        schemaReady = undefined;
        throw err;
      });
  }
  return schemaReady;
}

// --- site -------------------------------------------------------------

export async function getSite() {
  const rows = await sql`SELECT * FROM site WHERE id = 1`;
  return rows[0];
}

export async function updateSite(body) {
  await sql`
    UPDATE site SET
      name = ${body.name ?? ""},
      birth_date = ${body.birth_date ?? ""},
      death_date = ${body.death_date ?? ""},
      hero_photo = ${body.hero_photo ?? ""},
      life_story = ${body.life_story ?? ""},
      service_details = ${body.service_details ?? ""},
      donation_link = ${body.donation_link ?? ""},
      donation_label = ${body.donation_label ?? ""},
      gallery_json = ${JSON.stringify(body.gallery ?? [])},
      subject_handle = ${body.subject_handle ?? ""}
    WHERE id = 1`;
}

// --- contributions --------------------------------------------------------

export async function addContribution({ name, relationship, relationshipDetail, memory, aboutHandle }) {
  const rows = await sql`
    INSERT INTO contributions (name, relationship, relationship_detail, memory, about_handle)
    VALUES (${name}, ${relationship}, ${relationshipDetail || null}, ${memory}, ${aboutHandle || null})
    RETURNING id`;
  return rows[0];
}

export async function getContribution(id) {
  const rows = await sql`SELECT * FROM contributions WHERE id = ${id}`;
  return rows[0];
}

export async function getAllContributions() {
  return sql`SELECT * FROM contributions ORDER BY created_at DESC`;
}

export async function getApprovedContributions() {
  return sql`
    SELECT name, relationship, relationship_detail, memory, about_handle, featured
    FROM contributions WHERE status = 'approved' ORDER BY created_at ASC`;
}

export async function patchContribution(id, { status, featured }) {
  await sql`
    UPDATE contributions SET
      status = COALESCE(${status ?? null}, status),
      featured = COALESCE(${featured === undefined ? null : featured ? 1 : 0}, featured)
    WHERE id = ${id}`;
}

export async function deleteContribution(id) {
  await sql`DELETE FROM contributions WHERE id = ${id}`;
}

export async function getVoices() {
  const rows = await sql`
    SELECT name, relationship, memory FROM contributions
    WHERE status = 'approved' AND featured = 1 ORDER BY created_at DESC`;
  return rows.map((r) => ({ quote: r.memory, attribution: `${r.name}, ${r.relationship}` }));
}

// --- guestbook ---------------------------------------------------------

export async function getGuestbook(limit = 100) {
  return sql`
    SELECT id, name, message, created_at FROM guestbook
    ORDER BY created_at DESC LIMIT ${limit}`;
}

export async function addGuestbookEntry(name, message) {
  const rows = await sql`
    INSERT INTO guestbook (name, message) VALUES (${name}, ${message}) RETURNING id`;
  return rows[0];
}

export async function deleteGuestbookEntry(id) {
  await sql`DELETE FROM guestbook WHERE id = ${id}`;
}

// --- genealogy -------------------------------------------------------

export async function getGenealogy() {
  const [people, families, kids] = await Promise.all([
    sql`SELECT * FROM people ORDER BY surname, first_name`,
    sql`SELECT * FROM families`,
    sql`SELECT * FROM family_children ORDER BY family_handle, seq`,
  ]);
  const childrenByFamily = {};
  for (const k of kids) (childrenByFamily[k.family_handle] ??= []).push(k.child_handle);
  return {
    people,
    families: families.map((f) => ({ ...f, children: childrenByFamily[f.handle] || [] })),
  };
}

export async function getPerson(handle) {
  if (!handle) return null;
  const rows = await sql`SELECT * FROM people WHERE handle = ${handle}`;
  return rows[0] || null;
}

// Admin can fill in what the Gramps file lacks (most people have no dates).
export async function updatePersonDetails(handle, { birth_date, death_date, bio, photo_url }) {
  await sql`
    UPDATE people SET
      birth_date = COALESCE(${birth_date ?? null}, birth_date),
      death_date = COALESCE(${death_date ?? null}, death_date),
      bio        = COALESCE(${bio ?? null}, bio),
      photo_url  = COALESCE(${photo_url ?? null}, photo_url)
    WHERE handle = ${handle}`;
}

/**
 * Wipe and reload all three genealogy tables from parsed Gramps data, in
 * one atomic transaction. Family-entered fields (birth/death/bio/photo on
 * people) are read first and merged back in, so re-importing an updated
 * Gramps export doesn't erase what the family typed here.
 */
export async function replaceGenealogy({ people, families, children }) {
  const prior = await sql`SELECT handle, birth_date, death_date, bio, photo_url FROM people`;
  const priorBy = Object.fromEntries(prior.map((r) => [r.handle, r]));

  const q = [
    sql`TRUNCATE family_children`,
    sql`TRUNCATE families`,
    sql`TRUNCATE people`,
  ];

  for (const p of people) {
    const kept = priorBy[p.handle] || {};
    q.push(sql`
      INSERT INTO people
        (handle, gramps_id, first_name, surname, prefix, suffix, title, nick,
         gender, birth_date, death_date, photo_url, bio, sort_key)
      VALUES
        (${p.handle}, ${p.gramps_id}, ${p.first_name}, ${p.surname}, ${p.prefix},
         ${p.suffix}, ${p.title}, ${p.nick}, ${p.gender},
         ${p.birth_date || kept.birth_date || ""},
         ${p.death_date || kept.death_date || ""},
         ${kept.photo_url || ""}, ${kept.bio || ""}, ${p.sort_key})`);
  }
  for (const f of families) {
    q.push(sql`
      INSERT INTO families (handle, gramps_id, father_handle, mother_handle, rel_type)
      VALUES (${f.handle}, ${f.gramps_id}, ${f.father_handle || null}, ${f.mother_handle || null}, ${f.rel_type})`);
  }
  for (const c of children) {
    q.push(sql`
      INSERT INTO family_children (family_handle, child_handle, seq)
      VALUES (${c.family_handle}, ${c.child_handle}, ${c.seq})`);
  }

  await sql.transaction(q);
  return { people: people.length, families: families.length, children: children.length };
}
