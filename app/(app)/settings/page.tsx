import Link from "next/link";
import { requireMember } from "@/lib/access";
import { getClaimedPerson } from "@/lib/profile";
import { fullName } from "@/lib/names";
import { changePassword } from "./actions";

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ pw?: string }>;
}) {
  const { tree, user, role } = await requireMember();
  const mine = await getClaimedPerson(tree.id, user.id);
  const { pw } = await searchParams;
  const hasPassword = !!user.passwordHash;

  const pwMsg =
    pw === "ok"
      ? "Password updated."
      : pw === "wrong"
        ? "Your current password is wrong."
        : pw
          ? pw
          : null;

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
          <dt className="label">Sign-in</dt>
          <dd>{hasPassword ? "Email + password (and any linked social login)" : "Google / Facebook"}</dd>
        </dl>
      </section>

      <section>
        <h2 className="label mb-2">{hasPassword ? "Change password" : "Set a password"}</h2>
        <p className="mb-3 text-sm text-[color:var(--ink-soft)]">
          {hasPassword
            ? "You can also sign in with email and password."
            : "Add one so you can sign in without Google or Facebook."}
        </p>
        {pwMsg && (
          <p
            className="card mb-3 p-3 text-sm"
            style={{ borderLeft: `3px solid ${pw === "ok" ? "var(--indigo)" : "var(--earth)"}` }}
          >
            {pwMsg}
          </p>
        )}
        <form action={changePassword} className="flex flex-col gap-3">
          {hasPassword && (
            <label className="flex flex-col gap-1">
              <span className="label">Current password</span>
              <input name="current" type="password" required className="field" autoComplete="current-password" />
            </label>
          )}
          <label className="flex flex-col gap-1">
            <span className="label">New password</span>
            <input name="next" type="password" required minLength={8} className="field" autoComplete="new-password" />
          </label>
          <button type="submit" className="btn self-start">
            {hasPassword ? "Change password" : "Set password"}
          </button>
        </form>
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
