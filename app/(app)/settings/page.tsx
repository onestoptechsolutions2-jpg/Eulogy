import Link from "next/link";
import { requireMember } from "@/lib/access";
import { getClaimedPerson } from "@/lib/profile";
import { fullName } from "@/lib/names";

export default async function SettingsPage() {
  const { tree, user, role } = await requireMember();
  const mine = await getClaimedPerson(tree.id, user.id);

  return (
    <div className="flex max-w-measure flex-col gap-8">
      <h1 className="text-2xl">Your account</h1>

      <section className="card p-5">
        <dl className="grid grid-cols-[7rem_1fr] gap-x-4 gap-y-2 text-sm">
          <dt className="label">Name</dt>
          <dd>{user.name || "—"}</dd>
          <dt className="label">Email</dt>
          <dd>{user.email}</dd>
          <dt className="label">Role</dt>
          <dd>{role}</dd>
        </dl>
        <p className="mt-4 text-xs text-[color:var(--ink-soft)]">
          You signed in with Google or Facebook — your name, email and password are
          managed there, not here. To use a different address, sign out and sign in
          with that account.
        </p>
      </section>

      <section>
        <h2 className="label mb-2">Your profile in the tree</h2>
        {mine ? (
          <p>
            You&rsquo;re <Link href={`/person/${mine.id}`}>{fullName(mine)}</Link>.{" "}
            <Link href={`/person/${mine.id}/edit`}>Edit it</Link>.
          </p>
        ) : (
          <p>
            You haven&rsquo;t claimed a profile yet.{" "}
            <Link href="/claim">Find yourself in the tree</Link>.
          </p>
        )}
      </section>
    </div>
  );
}
