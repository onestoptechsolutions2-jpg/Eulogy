import Link from "next/link";
import { redirect } from "next/navigation";
import { requireMember } from "@/lib/access";
import { getClaimedPerson } from "@/lib/profile";
import { searchPeople } from "@/lib/queries";
import { db } from "@/db";
import { people } from "@/db/schema";
import { asc, eq } from "drizzle-orm";
import { fullName, lifespan } from "@/lib/names";
import { claimPerson } from "./actions";

export default async function ClaimPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; error?: string }>;
}) {
  const { tree, user } = await requireMember();
  const mine = await getClaimedPerson(tree.id, user.id);
  if (mine) redirect(`/person/${mine.id}`);

  const { q, error } = await searchParams;
  const query = (q ?? "").trim();
  const results = query
    ? await searchPeople(tree.id, query, 40)
    : await db
        .select()
        .from(people)
        .where(eq(people.treeId, tree.id))
        .orderBy(asc(people.surname), asc(people.given));

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="mb-1 text-2xl">Which one are you?</h1>
        <p className="text-[color:var(--ink-soft)]">
          Find yourself in the tree and claim your profile. You can edit it afterwards.
          Not in the tree yet? Ask whoever runs it to add you.
        </p>
      </div>

      {error === "taken" && (
        <p className="card p-3 text-sm" style={{ borderLeft: "3px solid var(--earth)" }}>
          Someone has already claimed that profile. If that&rsquo;s a mistake, ask the tree owner.
        </p>
      )}

      <form action="/claim" className="flex gap-2">
        <input name="q" defaultValue={query} className="field" placeholder="Type your name…" aria-label="Search" />
        <button className="btn" type="submit">Search</button>
      </form>

      <ul className="flex flex-col">
        {results.map((p) => (
          <li
            key={p.id}
            className="flex items-center justify-between gap-4 border-b border-[color:var(--rule)] py-2 last:border-b-0"
          >
            <span>
              <Link href={`/person/${p.id}`}>{fullName(p)}</Link>
              {lifespan(p) && <span className="label ml-2">({lifespan(p)})</span>}
              {p.claimedByUserId && <span className="label ml-2">· claimed</span>}
            </span>
            {!p.claimedByUserId && (
              <form action={claimPerson}>
                <input type="hidden" name="personId" value={p.id} />
                <button className="btn ghost" type="submit">This is me</button>
              </form>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
