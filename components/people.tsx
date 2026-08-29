import Link from "next/link";
import type { Person } from "@/db/schema";
import { fullName, shortName, lifespan } from "@/lib/names";

export function PersonLink({ p, short = false }: { p: Person; short?: boolean }) {
  return (
    <Link href={`/person/${p.id}`} className="no-underline hover:underline">
      {short ? shortName(p) : fullName(p)}
    </Link>
  );
}

export function PersonRow({ p }: { p: Person }) {
  const span = lifespan(p);
  return (
    <li className="flex items-baseline justify-between gap-4 border-b border-[color:var(--rule)] py-2 last:border-b-0">
      <PersonLink p={p} />
      {span && <span className="label shrink-0">{span}</span>}
    </li>
  );
}

export function KinList({ title, people }: { title: string; people: Person[] }) {
  if (!people.length) return null;
  return (
    <div>
      <h3 className="label mb-1">{title}</h3>
      <ul>
        {people.map((p) => (
          <li key={p.id} className="py-0.5">
            <PersonLink p={p} short />
            {lifespan(p) && (
              <span className="label ml-2">({lifespan(p)})</span>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
