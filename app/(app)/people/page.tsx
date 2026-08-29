import { asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { people } from "@/db/schema";
import { requireMember } from "@/lib/auth";
import { searchPeople } from "@/lib/queries";
import { PersonRow } from "@/components/people";

export default async function PeoplePage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { tree } = await requireMember();
  const { q } = await searchParams;
  const query = (q ?? "").trim();

  const results = query
    ? await searchPeople(tree.id, query)
    : await db
        .select()
        .from(people)
        .where(eq(people.treeId, tree.id))
        .orderBy(asc(people.surname), asc(people.given));

  return (
    <div className="flex flex-col gap-6">
      <form action="/people" className="flex gap-2">
        <input
          name="q"
          defaultValue={query}
          className="field"
          placeholder="Search people by name…"
          aria-label="Search people"
        />
        <button className="btn" type="submit">
          Search
        </button>
      </form>

      <p className="label">
        {query ? `${results.length} match${results.length === 1 ? "" : "es"} for “${query}”` : `${results.length} people`}
      </p>

      {results.length === 0 ? (
        <p className="text-[color:var(--ink-soft)]">
          {query ? "No one by that name." : "The tree is empty."}
        </p>
      ) : (
        <ul>
          {results.map((p) => (
            <PersonRow key={p.id} p={p} />
          ))}
        </ul>
      )}
    </div>
  );
}
