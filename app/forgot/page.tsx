import Link from "next/link";
import { requestReset } from "./actions";

export const dynamic = "force-dynamic";

export default async function ForgotPage({
  searchParams,
}: {
  searchParams: Promise<{ sent?: string }>;
}) {
  const { sent } = await searchParams;

  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center px-5 py-16">
      <p className="label mb-3">Mizizi</p>
      <h1 className="mb-2 text-3xl">Reset your password</h1>

      {sent ? (
        <div className="card p-5">
          <p className="mb-1 font-medium">Check your email</p>
          <p className="text-sm text-[color:var(--ink-soft)]">
            If that address has a password account, a reset link is on its way. It expires
            in an hour.
          </p>
        </div>
      ) : (
        <form action={requestReset} className="flex flex-col gap-3">
          <label className="flex flex-col gap-1">
            <span className="label">Email</span>
            <input name="email" type="email" required className="field" autoComplete="email" />
          </label>
          <button type="submit" className="btn mt-1">Send reset link</button>
        </form>
      )}

      <p className="mt-6 text-sm text-[color:var(--ink-soft)]">
        <Link href="/login">Back to sign in</Link>
      </p>
    </main>
  );
}
