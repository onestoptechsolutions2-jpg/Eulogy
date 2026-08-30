import { signOut } from "@/auth";

export default function NoAccessPage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-5 py-16">
      <p className="label mb-2">No access</p>
      <h1 className="mb-3 text-2xl">You&rsquo;re signed in, but not on this tree yet</h1>
      <p className="mb-4 text-[color:var(--ink-soft)]">
        This usually clears itself on your next sign-in. If it doesn&rsquo;t, ask whoever
        manages the tree to check your address.
      </p>
      <form
        action={async () => {
          "use server";
          await signOut({ redirectTo: "/login" });
        }}
      >
        <button type="submit" className="btn ghost self-start">
          Sign out
        </button>
      </form>
    </main>
  );
}
