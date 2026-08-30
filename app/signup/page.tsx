import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { signUp } from "./actions";

export const dynamic = "force-dynamic";

export default async function SignupPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  if (await auth()) redirect("/feed");
  const { error } = await searchParams;

  const message =
    error === "taken"
      ? "There's already an account with that email — sign in instead."
      : error === "email"
        ? "That doesn't look like an email address."
        : error;

  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center px-5 py-16">
      <p className="label mb-3">Mizizi</p>
      <h1 className="mb-2 text-3xl">Create an account</h1>
      <p className="mb-6 text-[color:var(--ink-soft)]">
        Once you&rsquo;re in, you&rsquo;ll find yourself in the family tree — or add
        yourself and your close family.
      </p>

      {message && (
        <p className="card mb-4 p-3 text-sm" style={{ borderLeft: "3px solid var(--earth)" }}>
          {message}
        </p>
      )}

      <form action={signUp} className="flex flex-col gap-3">
        <label className="flex flex-col gap-1">
          <span className="label">Name</span>
          <input name="name" className="field" autoComplete="name" />
        </label>
        <label className="flex flex-col gap-1">
          <span className="label">Email</span>
          <input name="email" type="email" required className="field" autoComplete="email" />
        </label>
        <label className="flex flex-col gap-1">
          <span className="label">Password</span>
          <input
            name="password"
            type="password"
            required
            minLength={8}
            className="field"
            autoComplete="new-password"
          />
        </label>
        <button type="submit" className="btn mt-1">Create account</button>
      </form>

      <p className="mt-6 text-sm text-[color:var(--ink-soft)]">
        Already have one? <Link href="/login">Sign in</Link>.
      </p>
    </main>
  );
}
