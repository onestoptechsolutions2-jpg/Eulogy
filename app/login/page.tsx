import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import { redirect } from "next/navigation";
import { requestLink } from "./actions";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ sent?: string; error?: string }>;
}) {
  if (await getCurrentUser()) redirect("/");
  const { sent, error } = await searchParams;

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-5 py-16">
      <p className="label mb-3">Mizizi</p>
      <h1 className="mb-2 text-3xl">A private family tree</h1>
      <p className="mb-8 text-[color:var(--ink-soft)]">
        Invite only. Enter the email address the family has for you and we&rsquo;ll send a
        sign-in link.
      </p>

      {sent ? (
        <div className="card p-5">
          <p className="mb-1 font-medium">Check your email</p>
          <p className="text-sm text-[color:var(--ink-soft)]">
            If that address is on the tree, a one-time sign-in link is on its way. It
            expires in 15 minutes.
          </p>
        </div>
      ) : (
        <form action={requestLink} className="flex flex-col gap-3">
          {error === "expired" && (
            <p className="text-sm text-[color:var(--earth-ink)]">
              That link was invalid or expired. Request a new one.
            </p>
          )}
          <label className="label" htmlFor="email">
            Email
          </label>
          <input
            id="email"
            name="email"
            type="email"
            required
            autoComplete="email"
            className="field"
            placeholder="you@example.com"
          />
          <button type="submit" className="btn mt-1 self-start">
            Send sign-in link
          </button>
        </form>
      )}

      <p className="mt-10 text-xs text-[color:var(--ink-soft)]">
        Been invited but stuck? <Link href="/login">Try again</Link>, or ask whoever set up
        the tree to re-send the invitation.
      </p>
    </main>
  );
}
