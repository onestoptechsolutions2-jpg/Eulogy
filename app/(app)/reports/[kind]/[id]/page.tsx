import Link from "next/link";
import { notFound } from "next/navigation";
import { requireMember } from "@/lib/auth";
import { graphFor, getPerson } from "@/lib/queries";
import { ancestorDistances, descendantDistances } from "@/lib/kinship";
import { fullName, lifespan } from "@/lib/names";
import type { Person } from "@/db/schema";

const KINDS = ["ancestors", "descendants"] as const;
type Kind = (typeof KINDS)[number];

export default async function ReportPage({
  params,
}: {
  params: Promise<{ kind: string; id: string }>;
}) {
  const { kind, id } = await params;
  if (!KINDS.includes(kind as Kind)) notFound();
  const { tree } = await requireMember();

  const person = await getPerson(tree.id, id);
  if (!person) notFound();

  const { graph, people } = await graphFor(tree.id);
  const byId = new Map(people.map((p) => [p.id, p]));

  const dist =
    kind === "ancestors" ? ancestorDistances(graph, id) : descendantDistances(graph, id);

  const byGen = new Map<number, Person[]>();
  for (const [pid, gen] of dist) {
    if (gen === 0) continue;
    const p = byId.get(pid);
    if (!p) continue;
    if (!byGen.has(gen)) byGen.set(gen, []);
    byGen.get(gen)!.push(p);
  }
  const gens = [...byGen.keys()].sort((x, y) => x - y);

  const genLabel = (n: number) =>
    kind === "ancestors"
      ? n === 1 ? "Parents" : n === 2 ? "Grandparents" : `${"Great-".repeat(n - 2)}Grandparents`
      : n === 1 ? "Children" : n === 2 ? "Grandchildren" : `${"Great-".repeat(n - 2)}Grandchildren`;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <p className="label">{kind === "ancestors" ? "Ancestors of" : "Descendants of"}</p>
        <h1 className="text-2xl">
          <Link href={`/person/${person.id}`}>{fullName(person)}</Link>
        </h1>
      </div>

      {gens.length === 0 ? (
        <p className="text-[color:var(--ink-soft)]">
          None recorded {kind === "ancestors" ? "above" : "below"} this person.
        </p>
      ) : (
        gens.map((g) => (
          <section key={g}>
            <h2 className="label mb-1">
              {genLabel(g)} <span className="opacity-60">· gen {g}</span>
            </h2>
            <ul>
              {byGen
                .get(g)!
                .sort((a, b) => fullName(a).localeCompare(fullName(b)))
                .map((p) => (
                  <li key={p.id} className="py-0.5">
                    <Link href={`/person/${p.id}`}>{fullName(p)}</Link>
                    {lifespan(p) && <span className="label ml-2">({lifespan(p)})</span>}
                  </li>
                ))}
            </ul>
          </section>
        ))
      )}
    </div>
  );
}
