import Link from "next/link";
import { requireMember } from "@/lib/access";
import { loadGenealogy } from "@/lib/queries";
import { computeStats } from "@/lib/stats";
import { fullName } from "@/lib/names";

export const dynamic = "force-dynamic";

function Bar({
  label,
  value,
  max,
  suffix = "",
  color = "var(--indigo)",
}: {
  label: string;
  value: number;
  max: number;
  suffix?: string;
  color?: string;
}) {
  const pct = max > 0 ? Math.max(2, (value / max) * 100) : 0;
  return (
    <div className="grid grid-cols-[10rem_1fr_3rem] items-center gap-3 text-sm">
      <span className="truncate text-right text-[color:var(--ink-soft)]">{label}</span>
      <span className="h-4 rounded-sm" style={{ width: `${pct}%`, background: color, minWidth: 2 }} />
      <span className="tabular-nums text-[color:var(--ink-soft)]">
        {value}
        {suffix}
      </span>
    </div>
  );
}

export default async function StatsPage() {
  const { tree } = await requireMember();
  const g = await loadGenealogy(tree.id);
  const byId = new Map(g.people.map((p) => [p.id, p]));
  const nameOfFamily = (f: (typeof g.families)[number]) =>
    [f.partner1Id, f.partner2Id]
      .map((x) => (x ? fullName(byId.get(x)) : null))
      .filter(Boolean)
      .join(" & ") || "unknown";
  const s = computeStats(g.people, g.families, nameOfFamily);

  const surnameMax = Math.max(...s.surnames.map((x) => x.count), 1);
  const genMax = Math.max(...s.generations.map((x) => x.count), 1);
  const genderMax = Math.max(s.gender.F, s.gender.M, s.gender.U, 1);

  return (
    <div className="flex max-w-2xl flex-col gap-10">
      <div className="flex items-baseline justify-between">
        <h1 className="text-2xl">Statistics</h1>
        <Link href="/tree" className="text-sm">← Tree</Link>
      </div>

      <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          ["People", s.people],
          ["Families", s.families],
          ["Avg. children", s.avgChildren.toFixed(1)],
          ["Generations", s.generations.length],
        ].map(([k, v]) => (
          <div key={k} className="card p-4">
            <div className="font-mono text-2xl text-[color:var(--earth-ink)]">{v}</div>
            <div className="label mt-1">{k}</div>
          </div>
        ))}
      </section>

      <section>
        <h2 className="label mb-3">People by generation</h2>
        <div className="flex flex-col gap-1.5">
          {s.generations.map((row) => (
            <Bar key={row.gen} label={`Gen ${row.gen}`} value={row.count} max={genMax} />
          ))}
        </div>
      </section>

      <section>
        <h2 className="label mb-3">Surnames</h2>
        <div className="flex flex-col gap-1.5">
          {s.surnames.map((row) => (
            <Bar key={row.name} label={row.name} value={row.count} max={surnameMax} color="var(--earth)" />
          ))}
        </div>
      </section>

      <section>
        <h2 className="label mb-3">Recorded</h2>
        <div className="flex flex-col gap-1.5">
          <Bar label="Female" value={s.gender.F} max={genderMax} color="var(--earth)" />
          <Bar label="Male" value={s.gender.M} max={genderMax} color="var(--indigo)" />
          <Bar label="Unspecified" value={s.gender.U} max={genderMax} color="var(--ink-soft)" />
          <div className="mt-2" />
          <Bar label="Living" value={s.living} max={s.people} color="var(--indigo)" />
          <Bar label="Deceased" value={s.deceased} max={s.people} color="var(--ink-soft)" />
        </div>
      </section>

      <section>
        <h2 className="label mb-3">Completeness (% of people)</h2>
        <div className="flex flex-col gap-1.5">
          <Bar label="Has birth date" value={s.completeness.birth} max={100} suffix="%" />
          <Bar label="Has death date" value={s.completeness.death} max={100} suffix="%" />
          <Bar label="Linked to a parent" value={s.completeness.parents} max={100} suffix="%" />
          <Bar label="Has a surname" value={s.completeness.surname} max={100} suffix="%" />
        </div>
      </section>

      {s.siblingGroups.length > 0 && (
        <section>
          <h2 className="label mb-3">Largest sibling groups</h2>
          <ul className="flex flex-col gap-1 text-sm">
            {s.siblingGroups.map((row, i) => (
              <li key={i} className="flex justify-between">
                <span>{row.parents}</span>
                <span className="tabular-nums text-[color:var(--ink-soft)]">{row.count} children</span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
