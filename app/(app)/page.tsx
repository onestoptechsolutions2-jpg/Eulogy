import Link from "next/link";
import { desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { people } from "@/db/schema";
import { requireMember } from "@/lib/access";
import { countPeople } from "@/lib/queries";
import { getClaimedPerson } from "@/lib/profile";
import { PersonRow } from "@/components/people";
import { fullName } from "@/lib/names";

export default async function Dashboard() {
  const { tree, user } = await requireMember();
  const [count, recent, mine] = await Promise.all([
    countPeople(tree.id),
    db.select().from(people).where(eq(people.treeId, tree.id)).orderBy(desc(people.updatedAt)).limit(6),
    getClaimedPerson(tree.id, user.id),
  ]);

  return (
    <div className="flex flex-col gap-10">
      {count > 0 && (
        <section
          className="card p-4 text-sm"
          style={{ borderLeft: "3px solid var(--indigo)" }}
        >
          {mine ? (
            <>
              You&rsquo;re <Link href={`/person/${mine.id}`}>{fullName(mine)}</Link> in this
              tree. <Link href={`/person/${mine.id}/edit`}>Edit your profile</Link>.
            </>
          ) : (
            <>
              Which one are you? <Link href="/claim">Find yourself and claim your profile</Link>{" "}
              &mdash; then you can edit it.
            </>
          )}
        </section>
      )}

      <section>
        <form action="/people" className="flex gap-2">
          <input
            name="q"
            className="field"
            placeholder="Search people by name…"
            aria-label="Search people"
          />
          <button className="btn" type="submit">
            Search
          </button>
        </form>
        <p className="label mt-2">
          {count} {count === 1 ? "person" : "people"} in the tree
        </p>
      </section>

      <section className="grid gap-3 sm:grid-cols-3">
        <Link href="/people" className="card no-underline p-4">
          <span className="label">Browse</span>
          <span className="mt-1 block font-serif text-lg">Everyone</span>
        </Link>
        <Link href="/relate" className="card no-underline p-4">
          <span className="label">Find</span>
          <span className="mt-1 block font-serif text-lg">How two people connect</span>
        </Link>
        <Link href="/tree" className="card no-underline p-4">
          <span className="label">View</span>
          <span className="mt-1 block font-serif text-lg">The whole tree</span>
        </Link>
      </section>

      {recent.length > 0 && (
        <section>
          <h2 className="label mb-2">Recently updated</h2>
          <ul>
            {recent.map((p) => (
              <PersonRow key={p.id} p={p} />
            ))}
          </ul>
        </section>
      )}

      {count === 0 && (
        <p className="text-[color:var(--ink-soft)]">
          Nothing loaded yet. Import the family&rsquo;s Gramps file from{" "}
          <Link href="/admin">Admin</Link>.
        </p>
      )}
    </div>
  );
}
