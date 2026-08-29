import Link from "next/link";
import { notFound } from "next/navigation";
import { requireMember } from "@/lib/auth";
import { graphFor, getPerson } from "@/lib/queries";
import { relativesOf } from "@/lib/relatives";
import { fullName, lifespan } from "@/lib/names";
import { KinList } from "@/components/people";
import type { Person } from "@/db/schema";

export default async function PersonPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { tree } = await requireMember();

  const person = await getPerson(tree.id, id);
  if (!person) notFound();

  const { graph, people } = await graphFor(tree.id);
  const byId = new Map(people.map((p) => [p.id, p]));
  const rel = relativesOf(graph, id);
  const pick = (ids: string[]): Person[] =>
    ids.map((h) => byId.get(h)).filter((p): p is Person => !!p);

  const events = [
    person.birthDate && { label: "Born", date: person.birthDate },
    person.deathDate && { label: "Died", date: person.deathDate },
  ].filter(Boolean) as { label: string; date: string }[];

  return (
    <article className="flex flex-col gap-8">
      <header>
        <h1 className="text-3xl">{fullName(person)}</h1>
        <p className="label mt-1">
          {person.nick && <span>“{person.nick}” · </span>}
          {lifespan(person) || (person.living ? "living" : "dates unknown")}
          {person.claimedByUserId && <span> · profile claimed</span>}
        </p>
      </header>

      {person.bio && (
        <div className="max-w-measure whitespace-pre-wrap">{person.bio}</div>
      )}

      {events.length > 0 && (
        <section>
          <h2 className="label mb-2">Timeline</h2>
          <ul className="flex flex-col gap-1">
            {events.map((e) => (
              <li key={e.label} className="flex gap-3">
                <span className="label w-12 shrink-0">{e.label}</span>
                <span>{e.date}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="grid gap-6 sm:grid-cols-2">
        <KinList title="Parents" people={pick(rel.parents)} />
        <KinList title="Brothers & sisters" people={pick(rel.siblings)} />
        <KinList title="Partner" people={pick(rel.partners)} />
        <KinList title="Children" people={pick(rel.children)} />
      </section>

      <nav className="flex flex-wrap gap-4 border-t border-[color:var(--rule)] pt-4 text-sm">
        <Link href={`/relate?to=${person.id}`}>How is someone related to {person.given || "them"}?</Link>
        <Link href={`/reports/ancestors/${person.id}`}>Ancestors</Link>
        <Link href={`/reports/descendants/${person.id}`}>Descendants</Link>
      </nav>
    </article>
  );
}
