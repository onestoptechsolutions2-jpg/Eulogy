import Link from "next/link";
import { requireMember } from "@/lib/auth";
import { graphFor } from "@/lib/queries";
import { kinship, shortestPath, type PathStep } from "@/lib/kinship";
import { fullName, shortName } from "@/lib/names";
import type { Person } from "@/db/schema";

export default async function RelatePage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string }>;
}) {
  const { tree } = await requireMember();
  const { from, to } = await searchParams;
  const { graph, people } = await graphFor(tree.id);
  const byId = new Map(people.map((p) => [p.id, p]));
  const sorted = [...people].sort((a, b) => fullName(a).localeCompare(fullName(b)));

  const a = from ? byId.get(from) : undefined;
  const b = to ? byId.get(to) : undefined;
  const result = a && b ? kinship(graph, a.id, b.id) : null;
  const path = a && b ? shortestPath(graph, a.id, b.id) : null;

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="mb-1 text-2xl">How are two people related?</h1>
        <p className="text-[color:var(--ink-soft)]">
          Pick two people and Mizizi works out the connection.
        </p>
      </div>

      <form action="/relate" className="grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
        <label className="flex flex-col gap-1">
          <span className="label">Person A</span>
          <select name="from" defaultValue={from ?? ""} className="field">
            <option value="">Choose…</option>
            {sorted.map((p) => (
              <option key={p.id} value={p.id}>
                {fullName(p)}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1">
          <span className="label">Person B</span>
          <select name="to" defaultValue={to ?? ""} className="field">
            <option value="">Choose…</option>
            {sorted.map((p) => (
              <option key={p.id} value={p.id}>
                {fullName(p)}
              </option>
            ))}
          </select>
        </label>
        <button className="btn" type="submit">
          Show
        </button>
      </form>

      {a && b && result && (
        <section className="card p-5">
          <p className="text-lg">
            <Link href={`/person/${b.id}`}>{shortName(b)}</Link> is{" "}
            <Link href={`/person/${a.id}`}>{shortName(a)}</Link>&rsquo;s{" "}
            <strong>{result.label}</strong>.
          </p>
          {result.label !== result.reverse && (
            <p className="mt-1 text-sm text-[color:var(--ink-soft)]">
              ({shortName(a)} is {shortName(b)}&rsquo;s {result.reverse}.)
            </p>
          )}

          {result.commonAncestorIds.length > 0 && (
            <p className="mt-3 text-sm">
              <span className="label">Common ancestor{result.commonAncestorIds.length > 1 ? "s" : ""}: </span>
              {result.commonAncestorIds.map((id, i) => {
                const p = byId.get(id);
                return (
                  <span key={id}>
                    {i > 0 && ", "}
                    {p ? <Link href={`/person/${id}`}>{shortName(p)}</Link> : id}
                  </span>
                );
              })}
            </p>
          )}

          {path && path.length > 1 && (
            <p className="mt-3 text-sm">
              <span className="label">Path: </span>
              {renderPath(path, byId)}
            </p>
          )}
        </section>
      )}

      {a && b && !result && (
        <p className="text-[color:var(--ink-soft)]">Select both people.</p>
      )}
    </div>
  );
}

const REL_WORD: Record<PathStep["relToPrev"], string> = {
  "": "",
  parent: "child of",
  child: "parent of",
  partner: "partner of",
};

function renderPath(path: PathStep[], byId: Map<string, Person>) {
  return path.map((step, i) => {
    const p = byId.get(step.id);
    const name = p ? shortName(p) : step.id;
    return (
      <span key={step.id}>
        {i > 0 && <span className="text-[color:var(--ink-soft)]"> → {REL_WORD[step.relToPrev]} → </span>}
        {name}
      </span>
    );
  });
}
