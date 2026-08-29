import { and, asc, eq, isNull } from "drizzle-orm";
import { db } from "@/db";
import { invitations, treeMembers, users, people } from "@/db/schema";
import { requireMember, canEdit, isOwner } from "@/lib/auth";
import { fullName } from "@/lib/names";
import { importGramps, sendInvitation, revokeInvitation, setMemberRole } from "./actions";

export default async function AdminPage({
  searchParams,
}: {
  searchParams: Promise<{ imported?: string; invited?: string; error?: string }>;
}) {
  const { tree, role } = await requireMember();
  const { imported, invited, error } = await searchParams;

  if (!canEdit(role)) {
    return <p className="text-[color:var(--ink-soft)]">Admin is for editors and the owner.</p>;
  }

  const [pending, members, everyone] = await Promise.all([
    db.select().from(invitations).where(and(eq(invitations.treeId, tree.id), isNull(invitations.acceptedAt))),
    db
      .select({ userId: treeMembers.userId, role: treeMembers.role, email: users.email, name: users.name })
      .from(treeMembers)
      .innerJoin(users, eq(users.id, treeMembers.userId))
      .where(eq(treeMembers.treeId, tree.id)),
    db.select().from(people).where(eq(people.treeId, tree.id)).orderBy(asc(people.surname), asc(people.given)),
  ]);

  return (
    <div className="flex flex-col gap-12">
      {imported && <Banner ok>Imported {imported} people.</Banner>}
      {invited && <Banner ok>Invitation sent.</Banner>}
      {error && <Banner>{errorText(error)}</Banner>}

      <section>
        <h1 className="mb-1 text-2xl">Family tree</h1>
        <p className="mb-4 text-sm text-[color:var(--ink-soft)]">
          Upload the family&rsquo;s Gramps file (<code>.gramps</code>, or a Gramps XML export).
          This replaces the whole tree; dates and life notes already entered here are kept.
        </p>
        <form action={importGramps} className="flex flex-wrap items-center gap-3">
          <input type="file" name="file" accept=".gramps,.xml" required className="text-sm" />
          <button className="btn" type="submit">
            Import family tree
          </button>
        </form>
        <p className="label mt-2">{everyone.length} people currently loaded</p>
      </section>

      <section>
        <h2 className="mb-3 text-xl">Invitations</h2>
        <form action={sendInvitation} className="grid gap-3 sm:grid-cols-[1fr_auto_1fr_auto] sm:items-end">
          <label className="flex flex-col gap-1">
            <span className="label">Email</span>
            <input name="email" type="email" required className="field" placeholder="cousin@example.com" />
          </label>
          <label className="flex flex-col gap-1">
            <span className="label">Role</span>
            <select name="role" defaultValue="contributor" className="field">
              <option value="viewer">viewer</option>
              <option value="contributor">contributor</option>
              <option value="editor">editor</option>
            </select>
          </label>
          <label className="flex flex-col gap-1">
            <span className="label">They are (optional)</span>
            <select name="personId" defaultValue="" className="field">
              <option value="">— a person in the tree —</option>
              {everyone.map((p) => (
                <option key={p.id} value={p.id}>
                  {fullName(p)}
                </option>
              ))}
            </select>
          </label>
          <button className="btn" type="submit">
            Invite
          </button>
        </form>

        {pending.length > 0 && (
          <ul className="mt-5 flex flex-col gap-2">
            {pending.map((inv) => (
              <li
                key={inv.id}
                className="flex items-center justify-between gap-4 border-b border-[color:var(--rule)] pb-2 text-sm last:border-b-0"
              >
                <span>
                  {inv.email} <span className="label">· {inv.role}</span>
                </span>
                <form action={revokeInvitation}>
                  <input type="hidden" name="id" value={inv.id} />
                  <button className="btn ghost" type="submit">
                    Revoke
                  </button>
                </form>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h2 className="mb-3 text-xl">Members</h2>
        <ul className="flex flex-col gap-2">
          {members.map((m) => (
            <li
              key={m.userId}
              className="flex items-center justify-between gap-4 border-b border-[color:var(--rule)] pb-2 text-sm last:border-b-0"
            >
              <span>
                {m.name || m.email} <span className="label">· {m.email}</span>
              </span>
              {isOwner(role) ? (
                <form action={setMemberRole} className="flex items-center gap-2">
                  <input type="hidden" name="userId" value={m.userId} />
                  <select name="role" defaultValue={m.role} className="field !w-auto !py-1 text-xs">
                    <option value="owner">owner</option>
                    <option value="editor">editor</option>
                    <option value="contributor">contributor</option>
                    <option value="viewer">viewer</option>
                  </select>
                  <button className="btn ghost" type="submit">
                    Save
                  </button>
                </form>
              ) : (
                <span className="label">{m.role}</span>
              )}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

function Banner({ children, ok = false }: { children: React.ReactNode; ok?: boolean }) {
  return (
    <p
      className="card p-3 text-sm"
      style={{ borderLeft: `3px solid ${ok ? "var(--indigo)" : "var(--earth)"}` }}
    >
      {children}
    </p>
  );
}

function errorText(code: string) {
  return (
    {
      forbidden: "You don't have permission for that.",
      nofile: "Choose a file first.",
      parse: "That file couldn't be read as a Gramps database.",
      empty: "No people found in that file.",
      bademail: "That doesn't look like an email address.",
      lastowner: "You can't remove the last owner.",
    }[code] ?? "Something went wrong."
  );
}
