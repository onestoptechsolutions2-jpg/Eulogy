# Compass — design & MVP plan

Working name: **Compass** (from "Gramps' Compass"). A consent-based,
invite-only family history platform for one extended family. This document
is the plan; the current Express app in this folder is the prototype it
replaces.

---

## Decisions

| Question | Answer |
|---|---|
| Audience | **One family, invite-only.** No public signup. The owner imports the Gramps tree and invites relatives by email. |
| First version (MVP) | **Search + relationship finder.** Accounts + invitations, fuzzy people search, "how is X related to Y", ancestor/descendant reports. |
| Stack | **Re-platform** to Next.js (App Router) + Neon + Drizzle. |

## Stack

| Concern | Choice | Why |
|---|---|---|
| Framework | **Next.js 15, App Router** | Vercel-native, React ecosystem for the later tree canvas, server components keep the DB on the server |
| DB | **Neon Postgres** (keep) | Already chosen; recursive CTEs do the genealogy queries |
| ORM | **Drizzle** | SQL-first, type-safe, no serverless cold-start baggage |
| Auth | **Hand-rolled magic link** | Invite-only + one family — email a signed token, set an `iron-session` cookie. No passwords. Auth.js is overkill; Lucia is sunset. |
| Email | **Resend** | Simple API, free tier; sends invitations + login links |
| Search | **Postgres `pg_trgm`** | Fuzzy name match, no external service |
| Relationship paths | **Recursive CTE** over a `relationship_edges` view | Scales past the 44-person sample |
| Tree canvas (later) | `@xyflow/react` + `elkjs` layout | Interactive pedigree editor, post-MVP |
| Gramps import | Port `src/lib/gramps.js` as-is | Pure JS already |
| Hosting | Vercel | Unchanged |

---

## Schema (MVP)

```
users(id, email UNIQUE, name, created_at)

login_tokens(token PK, user_id, expires_at, used_at)          -- magic link
invitations(id, email, tree_id, role, person_id NULL,          -- person_id: auto-claim on accept
            token UNIQUE, invited_by, expires_at, accepted_at, created_at)

trees(id, name, owner_id, created_at)
tree_members(tree_id, user_id, role, PRIMARY KEY (tree_id, user_id))
            -- role: owner | editor | contributor | viewer

people(id, tree_id, gramps_handle, gramps_id,
       given, surname, prefix, suffix, title, nick,
       gender, birth_date, death_date, living BOOL,
       claimed_by_user_id NULL, photo_url, bio,
       created_at, updated_at)
       -- GIN trigram index on (given || ' ' || surname)

families(id, tree_id, gramps_handle, gramps_id,
         partner1_id NULL, partner2_id NULL, rel_type)
family_children(family_id, child_id, seq, PRIMARY KEY (family_id, child_id))

edit_suggestions(id, person_id, suggested_by_user_id, field, value,
                 status, created_at)   -- review queue for non-owners
```

Session is an `iron-session` cookie (`{ userId }`) — no session table in
the MVP; add one if we need remote logout.

### Derived edge view for path-finding

```sql
CREATE VIEW relationship_edges AS
  -- parent -> child
  SELECT f.partner1_id AS a, fc.child_id AS b, 'parent' AS kind
  FROM families f JOIN family_children fc ON fc.family_id = f.id
  WHERE f.partner1_id IS NOT NULL
  UNION ALL
  SELECT f.partner2_id, fc.child_id, 'parent'
  FROM families f JOIN family_children fc ON fc.family_id = f.id
  WHERE f.partner2_id IS NOT NULL
  UNION ALL
  -- partner <-> partner (both directions)
  SELECT partner1_id, partner2_id, 'partner' FROM families
  WHERE partner1_id IS NOT NULL AND partner2_id IS NOT NULL
  UNION ALL
  SELECT partner2_id, partner1_id, 'partner' FROM families
  WHERE partner1_id IS NOT NULL AND partner2_id IS NOT NULL;
```

Child→parent and sibling edges are the inverse / a join away; the BFS CTE
walks both directions.

---

## The two MVP algorithms

### 1. Fuzzy people search

- `pg_trgm` GIN index on the full name.
- `SELECT ... WHERE (given || ' ' || surname) % :q ORDER BY similarity(...) DESC LIMIT 20`
- Filter to trees the user is a member of.
- Also match on `nick` and on `birth_date` prefix (year).

### 2. "How is X related to Y?"

1. **Shortest path** — recursive CTE / BFS over `relationship_edges`
   (plus inverse child→parent), capped at ~15 hops. Render as a chain:
   *X → child of → A → parent of → B → partner of → Y*.
2. **Common ancestor** — ancestor set of X ∩ ancestor set of Y (two
   recursive CTEs climbing `parent` edges), pick the nearest.
3. **Kinship label** — from generation distance to the common ancestor on
   each side: 0/1 → parent/child, 1/1 → sibling, 2/1 → aunt-uncle /
   niece-nephew, 2/2 → first cousin, `min-1` cousins with
   `abs(gA-gB)` removed, direct line → grandparent/grandchild ×N.
   Common cases only in the MVP; full kinship naming is a follow-up.
4. Ancestor & descendant **reports** reuse the same climbing/descending
   CTEs, rendered as an indented list.

---

## MVP screens (App Router)

| Route | Who | Purpose |
|---|---|---|
| `/login` | anyone | Enter email → magic link. Only sends if the email is a member or has a live invitation. |
| `/invite/[token]` | invitee | Accept: create `user`, join `tree`, auto-claim `person_id` if the invite carried one. |
| `/` | member | Dashboard: search box, counts, recent edits. |
| `/people` | member | Searchable, filterable list. |
| `/people/[id]` | member | Profile: details, timeline (birth/death), relatives as links, **Claim** / **Edit** / **Suggest edit**. |
| `/people/[id]/edit` | claimant or editor | Edit form. Non-privileged edits go to `edit_suggestions`. |
| `/relate?from=&to=` | member | Relationship path finder — pick two people, show path + kinship + common ancestor. |
| `/reports/ancestors/[id]`, `/reports/descendants/[id]` | member | Indented list reports. |
| `/admin` | owner / editor | Invitations (send / revoke, optional person link), members & roles, **Gramps import** (upload `.gramps`), suggestion queue. |
| `/settings` | member | Own account (name, email). |
| `/tree` | member | **MVP: read-only pedigree** (server-rendered). Interactive `@xyflow` editor is post-MVP. |

## Bootstrap / setup flow

1. `OWNER_EMAIL` env var. First magic-link login from that address creates
   the owner `user` + a default `tree` + `tree_members(owner)`.
2. Owner → `/admin` → upload the family's `.gramps` file → people & families load.
3. Owner sends invitations (email + role; optionally pick the person that
   invitee *is*, so they auto-claim on accept).
4. Invitees log in via magic link, land on their own profile, start editing
   and adding what the Gramps file lacks.

## Env vars

```
DATABASE_URL          Neon pooled connection string
SESSION_SECRET        32+ chars, signs the session cookie
OWNER_EMAIL           bootstraps the owner account
RESEND_API_KEY        transactional email
EMAIL_FROM            e.g. "Compass <compass@yourdomain>"
APP_URL               https://... , for links in emails
```

---

## Roadmap beyond the MVP

| Phase | Adds |
|---|---|
| **P2 — events & places** | `events`, `event_participants`, `places` (hierarchy + coords), `sources` / `citations`. Person / family / place timelines. Extend the Gramps importer to pull events & places (it currently keeps one). |
| **P3 — self-service depth** | Per-field edit permissions, richer claim/approve, media uploads (Vercel Blob) attached to people & events. |
| **P4 — eulogies & memorial mode** | `eulogies` (multiple per person, drafts + published). A person with a death event gets a memorial page: timeline + eulogies + submitted memories + guestbook + gallery. |
| **P5 — interactive tree** | `@xyflow/react` canvas: drag to connect, inline add, auto-layout, focus/zoom on a person. |
| **P6 — interconnect & portability** | Link the same person across trees; GEDCOM import **and** export; opt-in public directory with living-person privacy filtering; opt-out / takedown flow; edit audit log. |

## Open questions

- Kinship naming depth for the MVP — common terms only, or full
  (Nth cousin M times removed, half-relations, step)?
- Read-only pedigree in the MVP: how many generations deep by default?
- Resend needs a verified sending domain — is there one, or use Resend's
  onboarding domain for now?
- Keep the current guestbook / memory-submission feature in the MVP, or
  hold it for P4?
