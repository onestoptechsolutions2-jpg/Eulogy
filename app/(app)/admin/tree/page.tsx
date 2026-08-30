import Link from "next/link";
import { asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { people } from "@/db/schema";
import { requireMember, canEdit } from "@/lib/access";
import { loadGenealogy } from "@/lib/queries";
import { fullName } from "@/lib/names";
import { REL_TYPES } from "@/lib/genealogy-edit";
import {
  addPerson,
  addFamily,
  editFamily,
  addChildAction,
  removeChildAction,
  deleteFamilyAction,
} from "./actions";

export const dynamic = "force-dynamic";

export default async function AdminTreePage({
  searchParams,
}: {
  searchParams: Promise<{ ok?: string; error?: string }>;
}) {
  const { tree, role } = await requireMember();
  if (!canEdit(role)) {
    return <p className="text-[color:var(--ink-soft)]">This page is for editors and the owner.</p>;
  }
  const { ok, error } = await searchParams;

  const [genealogy, allPeople] = await Promise.all([
    loadGenealogy(tree.id),
    db.select().from(people).where(eq(people.treeId, tree.id)).orderBy(asc(people.surname), asc(people.given)),
  ]);
  const byId = new Map(genealogy.people.map((p) => [p.id, p]));
  const families = [...genealogy.families].sort((a, b) => {
    const an = byId.get(a.partner1Id ?? "")?.surname ?? "";
    const bn = byId.get(b.partner1Id ?? "")?.surname ?? "";
    return an.localeCompare(bn);
  });

  const PersonOptions = () => (
    <>
      <option value="">—</option>
      {allPeople.map((p) => (
        <option key={p.id} value={p.id}>
          {fullName(p)}
        </option>
      ))}
    </>
  );

  return (
    <div className="flex flex-col gap-10">
      <div className="flex items-baseline justify-between">
        <h1 className="text-2xl">Edit the tree</h1>
        <Link href="/admin" className="text-sm">← Admin</Link>
      </div>

      {ok && (
        <p className="card p-3 text-sm" style={{ borderLeft: "3px solid var(--indigo)" }}>
          Saved ({ok.replace(/-/g, " ")}).
        </p>
      )}
      {error && (
        <p className="card p-3 text-sm" style={{ borderLeft: "3px solid var(--earth)" }}>
          {error === "forbidden" ? "You don't have permission." : "Enter at least a first or last name."}
        </p>
      )}

      <section>
        <h2 className="mb-3 text-lg">Add a person</h2>
        <form action={addPerson} className="grid gap-3 sm:grid-cols-[1fr_1fr_auto_auto_auto_auto] sm:items-end">
          <input name="given" placeholder="First name" className="field" />
          <input name="surname" placeholder="Surname" className="field" />
          <select name="gender" defaultValue="U" className="field">
            <option value="U">?</option>
            <option value="F">F</option>
            <option value="M">M</option>
          </select>
          <input name="birthDate" placeholder="Born" className="field !w-24" />
          <input name="deathDate" placeholder="Died" className="field !w-24" />
          <button className="btn" type="submit">Add</button>
        </form>
        <p className="label mt-2">Fill in the rest on the person&rsquo;s page afterward.</p>
      </section>

      <section>
        <h2 className="mb-3 text-lg">Create a family (marriage / union)</h2>
        <form action={addFamily} className="grid gap-3 sm:grid-cols-[1fr_1fr_auto_auto] sm:items-end">
          <label className="flex flex-col gap-1">
            <span className="label">Partner 1</span>
            <select name="partner1Id" className="field"><PersonOptions /></select>
          </label>
          <label className="flex flex-col gap-1">
            <span className="label">Partner 2</span>
            <select name="partner2Id" className="field"><PersonOptions /></select>
          </label>
          <label className="flex flex-col gap-1">
            <span className="label">Type</span>
            <select name="relType" defaultValue="Married" className="field">
              {REL_TYPES.map((r) => <option key={r} value={r}>{r}</option>)}
            </select>
          </label>
          <button className="btn" type="submit">Create</button>
        </form>
        <p className="label mt-2">Leave one partner blank for a single-parent family.</p>
      </section>

      <section>
        <h2 className="mb-3 text-lg">Families ({families.length})</h2>
        <div className="flex flex-col gap-4">
          {families.map((f) => (
            <div key={f.id} className="card p-4">
              <form action={editFamily} className="grid gap-2 sm:grid-cols-[1fr_1fr_auto_auto] sm:items-end">
                <input type="hidden" name="familyId" value={f.id} />
                <label className="flex flex-col gap-1">
                  <span className="label">Partner 1</span>
                  <select name="partner1Id" defaultValue={f.partner1Id ?? ""} className="field"><PersonOptions /></select>
                </label>
                <label className="flex flex-col gap-1">
                  <span className="label">Partner 2</span>
                  <select name="partner2Id" defaultValue={f.partner2Id ?? ""} className="field"><PersonOptions /></select>
                </label>
                <label className="flex flex-col gap-1">
                  <span className="label">Type</span>
                  <select name="relType" defaultValue={f.relType} className="field">
                    {REL_TYPES.map((r) => <option key={r} value={r}>{r}</option>)}
                  </select>
                </label>
                <button className="btn ghost" type="submit">Save</button>
              </form>

              <div className="mt-3">
                <p className="label mb-1">Children</p>
                <ul className="mb-2 flex flex-col gap-1 text-sm">
                  {f.children.map((cid) => (
                    <li key={cid} className="flex items-center justify-between">
                      <Link href={`/person/${cid}`}>{fullName(byId.get(cid))}</Link>
                      <form action={removeChildAction}>
                        <input type="hidden" name="familyId" value={f.id} />
                        <input type="hidden" name="childId" value={cid} />
                        <button className="label hover:underline" type="submit">remove</button>
                      </form>
                    </li>
                  ))}
                  {f.children.length === 0 && <li className="text-[color:var(--ink-soft)]">none</li>}
                </ul>
                <form action={addChildAction} className="flex gap-2">
                  <input type="hidden" name="familyId" value={f.id} />
                  <select name="childId" className="field"><PersonOptions /></select>
                  <button className="btn ghost" type="submit">Add child</button>
                </form>
              </div>

              <form action={deleteFamilyAction} className="mt-3">
                <input type="hidden" name="familyId" value={f.id} />
                <button className="label text-[color:var(--earth-ink)] hover:underline" type="submit">
                  delete this family
                </button>
              </form>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
