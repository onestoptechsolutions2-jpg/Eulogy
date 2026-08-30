import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { requireMember } from "@/lib/access";
import { getClaimedPerson } from "@/lib/profile";
import { loadGenealogy, searchPeople } from "@/lib/queries";
import { db } from "@/db";
import { people } from "@/db/schema";
import { asc, eq } from "drizzle-orm";
import { fullName, lifespan, shortName } from "@/lib/names";
import type { Person } from "@/db/schema";
import { addRelative, claimSelf, createSelfPerson, skipOnboarding } from "./actions";

export const metadata: Metadata = { robots: { index: false, follow: false } };

type Step = "choice" | "find" | "add" | "family";

export default async function WelcomePage({
  searchParams,
}: {
  searchParams: Promise<{ step?: string; q?: string; error?: string }>;
}) {
  const { tree, user } = await requireMember();
  const { step: rawStep, q, error } = await searchParams;
  const step = (["find", "add", "family"].includes(rawStep ?? "") ? rawStep : "choice") as Step;

  const mine = await getClaimedPerson(tree.id, user.id);

  // Already have a profile? The only screen left is "add family".
  if (mine && step !== "family") redirect("/feed");
  // Can't add family before there's a "you" to hang it off.
  if (!mine && step === "family") redirect("/welcome?step=add");

  return (
    <main className="mx-auto flex min-h-screen max-w-lg flex-col justify-center px-5 py-16">
      <p className="label mb-3">Welcome to Mizizi</p>

      {step === "choice" && <Choice />}
      {step === "find" && <Find treeId={tree.id} query={(q ?? "").trim()} error={error} />}
      {step === "add" && <AddSelf error={error} />}
      {step === "family" && mine && <AddFamily treeId={tree.id} me={mine} error={error} />}
    </main>
  );
}

function Choice() {
  return (
    <>
      <h1 className="mb-2 text-3xl">Let&rsquo;s find you in the family</h1>
      <p className="mb-8 text-[color:var(--ink-soft)]">
        Every account is linked to one person in the tree. Which are you?
      </p>

      <div className="flex flex-col gap-3">
        <Link href="/welcome?step=find" className="card p-4 no-underline">
          <span className="block font-serif text-lg">I&rsquo;m already in the tree</span>
          <span className="block text-sm text-[color:var(--ink-soft)]">
            Search for your name and claim your profile.
          </span>
        </Link>
        <Link href="/welcome?step=add" className="card p-4 no-underline">
          <span className="block font-serif text-lg">Add me to the tree</span>
          <span className="block text-sm text-[color:var(--ink-soft)]">
            Create your profile, then add your parents, partner and children.
          </span>
        </Link>
      </div>

      <form action={skipOnboarding} className="mt-8">
        <button type="submit" className="text-sm text-[color:var(--ink-soft)] underline">
          Skip for now
        </button>
      </form>
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
        Find yourself and claim your profile — you can edit it afterwards.
      </p>

      {error === "taken" && (
        <p className="card mb-4 p-3 text-sm" style={{ borderLeft: "3px solid var(--earth)" }}>
          Someone has already claimed that profile. If that&rsquo;s a mistake, ask the tree owner.
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
              {p.claimedByUserId && <span className="label ml-2">· claimed</span>}
            </span>
            {!p.claimedByUserId && (
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
        <span className="mx-2 text-[color:var(--ink-soft)]">·</span>
        Not in the tree? <Link href="/welcome?step=add">Add yourself</Link>.
      </p>
    </>
  );
}

function AddSelf({ error }: { error?: string }) {
  return (
    <>
      <h1 className="mb-2 text-3xl">Add yourself</h1>
      <p className="mb-6 text-[color:var(--ink-soft)]">
        Just the basics — you can fill in the rest later.
      </p>

      {error === "name" && (
        <p className="card mb-4 p-3 text-sm" style={{ borderLeft: "3px solid var(--earth)" }}>
          Enter at least a first or last name.
        </p>
      )}

      <form action={createSelfPerson} className="flex flex-col gap-3">
        <PersonFields />
        <button type="submit" className="btn mt-1 self-start">Continue</button>
      </form>

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

      <div className="mt-8 flex items-center gap-4">
        <Link href="/feed" className="btn">Done</Link>
        <Link href="/feed" className="text-sm text-[color:var(--ink-soft)]">
          I&rsquo;ll do this later
        </Link>
      </div>
    </>
  );
}

function PersonFields({ surnameDefault = "" }: { surnameDefault?: string }) {
  return (
    <>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="flex flex-col gap-1">
          <span className="label">First name</span>
          <input name="given" className="field" autoComplete="off" />
        </label>
        <label className="flex flex-col gap-1">
          <span className="label">Last name</span>
          <input name="surname" defaultValue={surnameDefault} className="field" autoComplete="off" />
        </label>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="flex flex-col gap-1">
          <span className="label">Birth year (optional)</span>
          <input name="birthYear" className="field" inputMode="numeric" placeholder="e.g. 1975" />
        </label>
        <label className="flex flex-col gap-1">
          <span className="label">Gender (optional)</span>
          <select name="gender" defaultValue="" className="field">
            <option value="">Prefer not to say</option>
            <option value="F">Female</option>
            <option value="M">Male</option>
          </select>
        </label>
      </div>
    </>
  );
}
