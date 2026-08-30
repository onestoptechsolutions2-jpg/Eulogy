import Link from "next/link";
import { requireMember } from "@/lib/access";
import { graphFor } from "@/lib/queries";
import { familyUnits, rootPeople } from "@/lib/relatives";
import { fullName, shortName, lifespan } from "@/lib/names";

export default async function TreePage() {
  const { tree } = await requireMember();
  const { graph, people, families } = await graphFor(tree.id);
  const units = familyUnits(people, families);
  const roots = rootPeople(people, graph);

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-2xl">Family tree</h1>
        <p className="label mt-1">
          {people.length} people · {units.length} family units
        </p>
      </div>

      {people.length === 0 ? (
        <p className="text-[color:var(--ink-soft)]">Nothing loaded yet.</p>
      ) : (
        <>
          {roots.length > 0 && (
            <section>
              <h2 className="label mb-2">Earliest known</h2>
              <ul>
                {roots
                  .sort((a, b) => fullName(a).localeCompare(fullName(b)))
                  .map((p) => (
                    <li key={p.id} className="py-0.5">
                      <Link href={`/person/${p.id}`}>{fullName(p)}</Link>
                      {lifespan(p) && <span className="label ml-2">({lifespan(p)})</span>}
                    </li>
                  ))}
              </ul>
            </section>
          )}

          <section className="flex flex-col gap-3">
            <h2 className="label">Family units</h2>
            {units.map((u) => (
              <div key={u.id} className="card p-4">
                <div className="font-serif">
                  {u.parents.length ? (
                    u.parents.map((p, i) => (
                      <span key={p.id}>
                        {i > 0 && <span className="text-[color:var(--ink-soft)]"> &amp; </span>}
                        <Link href={`/person/${p.id}`} className="no-underline hover:underline">
                          {fullName(p)}
                        </Link>
                      </span>
                    ))
                  ) : (
                    <span className="italic text-[color:var(--ink-soft)]">unknown</span>
                  )}
                  {u.relType && u.relType !== "Unknown" && (
                    <span className="label ml-2">{u.relType.toLowerCase()}</span>
                  )}
                </div>
                {u.children.length > 0 && (
                  <ul className="mt-2 list-disc pl-5 text-sm">
                    {u.children.map((c) => (
                      <li key={c.id} className="py-0.5">
                        <Link href={`/person/${c.id}`}>{shortName(c)}</Link>
                        {lifespan(c) && <span className="label ml-2">({lifespan(c)})</span>}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ))}
          </section>
        </>
      )}
    </div>
  );
}
