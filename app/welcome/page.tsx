import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { requireMember } from "@/lib/access";
import { getClaimedPerson, linkedPersonIds } from "@/lib/profile";
import { loadGenealogy, searchPeople } from "@/lib/queries";
import { db } from "@/db";
import { people } from "@/db/schema";
import { asc, eq } from "drizzle-orm";
import { fullName, lifespan, shortName } from "@/lib/names";
import type { Person } from "@/db/schema";
import { addRelative, claimSelf, finishOnboarding, saveSelf } from "./actions";

export const metadata: Metadata = { robots: { index: false, follow: false } };

type Step = "you" | "find" | "family";

export default async function WelcomePage({
  searchParams,
}: {
  searchParams: Promise<{ step?: string; q?: string; error?: string }>;
}) {
  const { tree, user } = await requireMember();
  const { step: rawStep, q, error } = await searchParams;
  const step = (["find", "family"].includes(rawStep ?? "") ? rawStep : "you") as Step;

  const mine = await getClaimedPerson(tree.id, user.id);
  if (!mine) redirect("/no-access");

  // Already through onboarding? The only screen left worth showing is "add family".
  if (user.onboardedAt && step !== "family") redirect("/feed");

  return (
    <main className="mx-auto flex min-h-screen max-w-lg flex-col justify-center px-5 py-16">
      <p className="label mb-3">Welcome to Mizizi</p>

      {step === "you" && <You treeId={tree.id} me={mine} error={error} />}
      {step === "find" && <Find treeId={tree.id} query={(q ?? "").trim()} error={error} />}
      {step === "family" && <AddFamily treeId={tree.id} me={mine} error={error} />}
    </main>
  );
}

async function You({ treeId, me, error }: { treeId: string; me: Person; error?: string }) {
  const others = (await db.select({ id: people.id }).from(people).where(eq(people.treeId, treeId))).length > 1;
  return (
    <>
      <h1 className="mb-2 text-3xl">Is this you?</h1>
      <p className="mb-6 text-[color:var(--ink-soft)]">
        Check your details. You can change anything, and fill in the rest later.
      </p>

      {error === "name" && (
        <p className="card mb-4 p-3 text-sm" style={{ borderLeft: "3px solid var(--earth)" }}>
          Enter at least a first or last name.
        </p>
      )}

      <form action={saveSelf} className="flex flex-col gap-3">
        <PersonFields
          givenDefault={me.given}
          surnameDefault={me.surname}
          birthYearDefault={me.birthDate}
          genderDefault={me.gender === "U" ? "" : me.gender}
        />
        <button type="submit" className="btn mt-1 self-start">Continue</button>
      </form>

      {others && (
        <p className="mt-6 text-sm text-[color:var(--ink-soft)]">
          Already in the tree under another entry? <Link href="/welcome?step=find">Find yourself</Link>.
        </p>
      )}
    </>
  );
}

async function Find({
  treeId,
  query,
  error,
}: {
  treeId: string;
  query: string;
  error?: string;
}) {
  const linked = await linkedPersonIds(treeId);
  const results = query
    ? await searchPeople(treeId, query, 40)
    : await db
        .select()
        .from(people)
        .where(eq(people.treeId, treeId))
        .orderBy(asc(people.surname), asc(people.given));

  return (
    <>
      <h1 className="mb-2 text-3xl">Which one are you?</h1>
      <p className="mb-6 text-[color:var(--ink-soft)]">
        Find yourself and link your account to that entry — you can edit it afterwards.
      </p>

      {error === "taken" && (
        <p className="card mb-4 p-3 text-sm" style={{ borderLeft: "3px solid var(--earth)" }}>
          Someone has already claimed that profile. If that&rsquo;s a mistake, ask the tree owner.
        </p>
      )}
      {error === "filled" && (
        <p className="card mb-4 p-3 text-sm" style={{ borderLeft: "3px solid var(--earth)" }}>
          Your own entry already has details, so it can&rsquo;t be swapped. Ask the tree owner to merge them.
        </p>
      )}
      {error === "notfound" && (
        <p className="card mb-4 p-3 text-sm" style={{ borderLeft: "3px solid var(--earth)" }}>
          That profile couldn&rsquo;t be found — try searching again.
        </p>
      )}

      <form action="/welcome" className="flex gap-2">
        <input type="hidden" name="step" value="find" />
        <input
          name="q"
          defaultValue={query}
          className="field"
          placeholder="Type your name…"
          aria-label="Search"
        />
        <button className="btn" type="submit">Search</button>
      </form>

      <ul className="mt-4 flex flex-col">
        {results.map((p) => (
          <li
            key={p.id}
            className="flex items-center justify-between gap-4 border-b border-[color:var(--rule)] py-2 last:border-b-0"
          >
            <span>
              {fullName(p)}
              {lifespan(p) && <span className="label ml-2">({lifespan(p)})</span>}
              {linked.has(p.id) && <span className="label ml-2">· claimed</span>}
            </span>
            {!linked.has(p.id) && (
              <form action={claimSelf}>
                <input type="hidden" name="personId" value={p.id} />
                <button className="btn ghost" type="submit">This is me</button>
              </form>
            )}
          </li>
        ))}
        {results.length === 0 && (
          <li className="py-2 text-sm text-[color:var(--ink-soft)]">
            {query ? "No one by that name." : "The tree is empty."}
          </li>
        )}
      </ul>

      <p className="mt-6 text-sm">
        <Link href="/welcome">← Back</Link>
      </p>
    </>
  );
}

async function AddFamily({
  treeId,
  me,
  error,
}: {
  treeId: string;
  me: Person;
  error?: string;
}) {
  const { people: pp, families: ff } = await loadGenealogy(treeId);
  const byId = new Map(pp.map((p) => [p.id, p]));

  const rels: { label: string; person: Person }[] = [];
  for (const f of ff) {
    const iAmPartner = f.partner1Id === me.id || f.partner2Id === me.id;
    if (iAmPartner) {
      const other = f.partner1Id === me.id ? f.partner2Id : f.partner1Id;
      if (other && byId.get(other)) rels.push({ label: "partner", person: byId.get(other)! });
      for (const c of f.children) {
        if (byId.get(c)) rels.push({ label: "child", person: byId.get(c)! });
      }
    }
    if (f.children.includes(me.id)) {
      for (const pid of [f.partner1Id, f.partner2Id]) {
        if (pid && byId.get(pid)) rels.push({ label: "parent", person: byId.get(pid)! });
      }
    }
  }

  return (
    <>
      <h1 className="mb-2 text-3xl">You&rsquo;re in — welcome, {shortName(me)}.</h1>
      <p className="mb-6 text-[color:var(--ink-soft)]">
        Add your parents, partner and children now, or come back to it later.
      </p>

      {rels.length > 0 && (
        <ul className="mb-6 flex flex-col gap-1 text-sm">
          {rels.map((r, i) => (
            <li key={i}>
              <span className="label mr-2">{r.label}</span>
              {fullName(r.person)}
            </li>
          ))}
        </ul>
      )}

      {error === "name" && (
        <p className="card mb-4 p-3 text-sm" style={{ borderLeft: "3px solid var(--earth)" }}>
          Enter at least a first or last name.
        </p>
      )}

      <form action={addRelative} className="card flex flex-col gap-3 p-4">
        <label className="flex flex-col gap-1">
          <span className="label">This person is my…</span>
          <select name="relation" defaultValue="parent" className="field">
            <option value="parent">Parent</option>
            <option value="partner">Partner / spouse</option>
            <option value="child">Child</option>
          </select>
        </label>
        <PersonFields surnameDefault={me.surname} />
        <button type="submit" className="btn ghost self-start">Add relative</button>
      </form>

      <form action={finishOnboarding} className="mt-8 flex items-center gap-4">
        <button type="submit" className="btn">Done</button>
        <button type="submit" className="text-sm text-[color:var(--ink-soft)] underline">
          I&rsquo;ll do this later
        </button>
      </form>
    </>
  );
}

function PersonFields({
  givenDefault = "",
  surnameDefault = "",
  birthYearDefault = "",
  genderDefault = "",
}: {
  givenDefault?: string;
  surnameDefault?: string;
  birthYearDefault?: string;
  genderDefault?: string;
}) {
  return (
    <>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="flex flex-col gap-1">
          <span className="label">First name</span>
          <input name="given" defaultValue={givenDefault} className="field" autoComplete="off" />
        </label>
        <label className="flex flex-col gap-1">
          <span className="label">Last name</span>
          <input name="surname" defaultValue={surnameDefault} className="field" autoComplete="off" />
        </label>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="flex flex-col gap-1">
          <span className="label">Birth year (optional)</span>
          <input name="birthYear" defaultValue={birthYearDefault} className="field" inputMode="numeric" placeholder="e.g. 1975" />
        </label>
        <label className="flex flex-col gap-1">
          <span className="label">Gender (optional)</span>
          <select name="gender" defaultValue={genderDefault} className="field">
            <option value="">Prefer not to say</option>
            <option value="F">Female</option>
            <option value="M">Male</option>
          </select>
        </label>
      </div>
    </>
  );
}
