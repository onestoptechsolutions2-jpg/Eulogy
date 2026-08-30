import { redirect } from "next/navigation";
import { auth, signIn } from "@/auth";

export default async function LoginPage() {
  const session = await auth();
  if (session) redirect("/");

  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center px-5 py-16">
      <p className="label mb-3">Mizizi</p>
      <h1 className="mb-2 text-3xl">Sign in</h1>
      <p className="mb-8 text-[color:var(--ink-soft)]">
        A private family tree. Sign in and you&rsquo;re in as a viewer &mdash; whoever runs
        the tree can give you editing rights.
      </p>

      <div className="flex flex-col gap-3">
        <form
          action={async () => {
            "use server";
            await signIn("google", { redirectTo: "/" });
          }}
        >
          <button type="submit" className="btn w-full">
            Continue with Google
          </button>
        </form>
        <form
          action={async () => {
            "use server";
            await signIn("facebook", { redirectTo: "/" });
          }}
        >
          <button type="submit" className="btn ghost w-full">
            Continue with Facebook
          </button>
        </form>
      </div>
    </main>
  );
}
