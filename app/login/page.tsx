import Link from "next/link";
import { redirect } from "next/navigation";
import { auth, signIn } from "@/auth";
import { isRedirect } from "@/lib/redirect-error";

// never serve a stale copy — keeps Server Action IDs in sync with the deploy
export const dynamic = "force-dynamic";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; reset?: string }>;
}) {
  if (await auth()) redirect("/feed");
  const { error, reset } = await searchParams;

  const errorMessage = !error
    ? null
    : error === "badcreds" || error === "CredentialsSignin"
      ? "That email and password don’t match."
      : error === "expired" || error === "SessionRequired"
        ? "Your session ended — please sign in again."
        : error === "OAuthAccountNotLinked"
          ? "That email is already registered with a different sign-in method."
          : "Something went wrong with that sign-in. Please try again.";

  async function passwordSignIn(formData: FormData) {
    "use server";
    const email = String(formData.get("email") ?? "").trim().toLowerCase();
    const password = String(formData.get("password") ?? "");
    try {
      await signIn("credentials", { email, password, redirectTo: "/feed" });
    } catch (err) {
      if (isRedirect(err)) throw err;
      redirect("/login?error=badcreds");
    }
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center px-5 py-16">
      <p className="label mb-3">Mizizi</p>
      <h1 className="mb-2 text-3xl">Sign in</h1>
      <p className="mb-6 text-[color:var(--ink-soft)]">
        A private family tree. New here? You&rsquo;ll join as a viewer.
      </p>

      {reset && (
        <p className="card mb-4 p-3 text-sm" style={{ borderLeft: "3px solid var(--indigo)" }}>
          Password updated. Sign in with it below.
        </p>
      )}
      {errorMessage && (
        <p className="card mb-4 p-3 text-sm" style={{ borderLeft: "3px solid var(--earth)" }}>
          {errorMessage}
        </p>
      )}

      <div className="flex flex-col gap-3">
        <form action={async () => { "use server"; await signIn("google", { redirectTo: "/feed" }); }}>
          <button type="submit" className="btn w-full">Continue with Google</button>
        </form>
        <form action={async () => { "use server"; await signIn("facebook", { redirectTo: "/feed" }); }}>
          <button type="submit" className="btn ghost w-full">Continue with Facebook</button>
        </form>
      </div>

      <div className="my-6 flex items-center gap-3 text-xs text-[color:var(--ink-soft)]">
        <span className="h-px flex-1 bg-[color:var(--rule)]" /> or <span className="h-px flex-1 bg-[color:var(--rule)]" />
      </div>

      <form action={passwordSignIn} className="flex flex-col gap-3">
        <label className="flex flex-col gap-1">
          <span className="label">Email</span>
          <input name="email" type="email" required className="field" autoComplete="email" />
        </label>
        <label className="flex flex-col gap-1">
          <span className="label">Password</span>
          <input name="password" type="password" required className="field" autoComplete="current-password" />
        </label>
        <button type="submit" className="btn ghost">Sign in with password</button>
      </form>

      <p className="mt-5 flex justify-between text-sm text-[color:var(--ink-soft)]">
        <Link href="/signup">Create an account</Link>
        <Link href="/forgot">Forgot password?</Link>
      </p>

      {process.env.NODE_ENV !== "production" && (
        <form
          action={async (formData) => {
            "use server";
            await signIn("dev", { email: String(formData.get("email") ?? ""), redirectTo: "/feed" });
          }}
          className="mt-8 flex gap-2 border-t border-[color:var(--rule)] pt-6"
        >
          <input name="email" type="email" required placeholder="dev sign-in (local only)" className="field text-xs" />
          <button type="submit" className="btn ghost text-xs">Go</button>
        </form>
      )}
    </main>
  );
}
