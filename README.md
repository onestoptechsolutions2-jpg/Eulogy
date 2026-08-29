# Mizizi

A private, invite-only family tree for one family. Next.js + Neon Postgres.

The MVP does four things:

- **Invite-only accounts** — magic-link sign-in; the owner invites relatives by email.
- **Gramps import** — upload the family&rsquo;s `.gramps` file; people, families and
  parent/child links load into Postgres.
- **People & profiles** — browse everyone, open a person to see dates, relatives and a timeline.
- **Relationship finder** — pick any two people and get the kinship term
  (&ldquo;first cousin once removed&rdquo;), the common ancestor, and the path between them;
  plus ancestor / descendant reports.

Strategy and roadmap: [DESIGN.md](DESIGN.md). Earlier prototype (Express): [_prototype/](_prototype/).

## Stack

Next.js 15 (App Router) · Neon serverless Postgres · Drizzle ORM · iron-session
magic links · `pg_trgm` fuzzy search · in-memory BFS for kinship · Tailwind.

## Setup

```bash
npm install
cp .env.example .env        # fill in the four required values
npm run db:migrate          # create the schema in Neon (one time)
npm run seed -- "C:/path/to/Family.gramps"   # owner account + import the tree
npm run dev                 # http://localhost:3000
```

Required env (`.env`):

| Var | What |
|---|---|
| `DATABASE_URL` | Neon pooled connection string (`...-pooler...`) |
| `SESSION_SECRET` | 32+ random chars — `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` |
| `OWNER_EMAIL` | the address that becomes the tree owner on first sign-in |
| `APP_URL` | base URL for links inside emails (`http://localhost:3000` locally) |

`RESEND_API_KEY` is optional — without it, sign-in and invite links are **printed to
the server console** instead of emailed, which is fine for local use.

## How sign-in works

1. Enter your email at `/login`. A one-time link is sent (or logged) — but only if the
   address is `OWNER_EMAIL`, already a member, or has a pending invitation.
2. The link signs you in and drops a session cookie (`iron-session`, no session table).
3. First time the `OWNER_EMAIL` signs in, the tree is created and they become owner.
4. Anyone the owner invites is added to the tree automatically the first time they sign in.

## Import a tree

`/admin` → **Family tree** → upload `.gramps`. Re-importing replaces the whole tree;
birth/death dates and life notes entered in the app are preserved across re-imports.
Gramps media isn&rsquo;t imported (the export points at files on the original PC).

## Deploy (Vercel)

Push to Git, import in Vercel (framework preset: Next.js), set the four env vars
(plus `RESEND_API_KEY` / `EMAIL_FROM` for real email), and run `npm run db:migrate`
once against the production `DATABASE_URL`.

## Tests

```bash
npm test        # kinship engine + Gramps parser (pure functions, no DB)
npm run typecheck
```
