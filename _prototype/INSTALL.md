# Installation guide

You set this up once. The family just gets a link.

Three services, all free-tier: **Neon** (database), **Vercel** (hosting +
photo storage). No servers, no Docker, no build tools.

---

## 1. Create the Neon database

1. Sign up at <https://neon.tech> → **New Project**.
2. On the project dashboard, open **Connection Details**.
3. Copy the connection string that has **`-pooler`** in the host — it
   looks like:
   ```
   postgresql://user:pass@ep-xxx-pooler.us-east-1.aws.neon.tech/neondb?sslmode=require
   ```
   Keep it handy — this is `DATABASE_URL`.

You don't create any tables. The app does that itself the first time it runs.

---

## 2. Deploy to Vercel

1. Put this folder in a Git repo (GitHub/GitLab/Bitbucket) and push it.
2. At <https://vercel.com> → **Add New → Project** → import that repo.
3. Framework preset: **Other**. Leave build/output settings empty — the
   `vercel.json` in this repo already routes everything to `api/index.js`.
4. **Environment Variables** — add these three before the first deploy:

   | Name | Value |
   |---|---|
   | `DATABASE_URL` | the Neon `-pooler` string from step 1 |
   | `ADMIN_PASSWORD` | a long pass-phrase you choose — this unlocks `/admin` |
   | `SESSION_SECRET` | 32+ random characters (command below) |

   Generate the session secret:
   ```
   node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
   ```
5. **Deploy.**

### Turn on photo storage

1. In the Vercel project → **Storage** → **Create** → **Blob**.
2. Connect it to this project. Vercel adds `BLOB_READ_WRITE_TOKEN`
   automatically.
3. **Redeploy** (Deployments → ⋯ → Redeploy) so the new variable is picked up.

Until you do this, everything works except photo uploads.

---

## 3. Load the family tree

You need the family's **`.gramps`** file. In Gramps: **Family Trees →
Make Backup...**, or **Export → Gramps XML (.gramps)**. (A timestamped
one already exists under the tree's `Backup/` folder.)

Then either:

- **From the admin page (easiest):** open `https://your-site.vercel.app/admin`,
  log in, go to **Family tree**, choose the `.gramps` file, click
  **Import family tree**.
- **From your computer:**
  ```
  npm install
  echo "DATABASE_URL=...the neon pooler string..." > .env
  npm run import:gramps -- "C:/path/to/Family.gramps"
  ```

Importing **replaces** the whole tree. Any birth/death dates and life
notes typed into the admin page are kept across re-imports.

---

## 4. Set up the memorial

Open `/admin`, log in, and under **Site content**:

- Fill in the person's **name, dates, life story**, upload a **hero photo**
  and gallery photos, add **service details**.
- Set **"This memorial is for"** to that person in the family tree — the
  homepage then shows their parents, siblings, partner, and children.

Under **Family tree → Dates & life notes**, add the birth/death years the
Gramps file is missing (it usually has almost none).

Send the family `https://your-site.vercel.app`. They share memories at
`/share`; you approve them under **Contributions**.

---

## Running it locally (optional)

```
npm install
cp .env.example .env      # fill in DATABASE_URL, ADMIN_PASSWORD, SESSION_SECRET
npm run dev               # http://localhost:3000
```

`npm install` needs no C/C++ build tools — every dependency ships a
prebuilt binary. Local photo uploads also need `BLOB_READ_WRITE_TOKEN` in
`.env` (Vercel dashboard → Storage → your Blob store → `.env.local` tab).

---

## Notes / limits

- **First request after a deploy is slow** (~1–2s): the app is creating
  the database schema. After that it's cached.
- **No rate limiting.** A public form with a weak `ADMIN_PASSWORD` is the
  only real risk — make the password strong.
- **Re-importing a Gramps file** wipes and reloads people/families;
  it never touches submitted memories or the guestbook.
- **Gramps media isn't imported** — the export references image paths on
  the original PC. Add photos through the admin page instead.
