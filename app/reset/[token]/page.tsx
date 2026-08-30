import { resetPassword } from "./actions";

export default async function ResetPage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { token } = await params;
  const { error } = await searchParams;

  const message =
    error === "match"
      ? "The two passwords don't match."
      : error === "expired"
        ? "That link has expired or was already used. Request a new one."
        : error;

  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center px-5 py-16">
      <p className="label mb-3">Mizizi</p>
      <h1 className="mb-4 text-3xl">Choose a new password</h1>

      {message && (
        <p className="card mb-4 p-3 text-sm" style={{ borderLeft: "3px solid var(--earth)" }}>
          {message}
        </p>
      )}

      <form action={resetPassword} className="flex flex-col gap-3">
        <input type="hidden" name="token" value={token} />
        <label className="flex flex-col gap-1">
          <span className="label">New password</span>
          <input name="password" type="password" required minLength={8} className="field" autoComplete="new-password" />
        </label>
        <label className="flex flex-col gap-1">
          <span className="label">Confirm</span>
          <input name="confirm" type="password" required minLength={8} className="field" autoComplete="new-password" />
        </label>
        <button type="submit" className="btn mt-1">Set password</button>
      </form>
    </main>
  );
}
