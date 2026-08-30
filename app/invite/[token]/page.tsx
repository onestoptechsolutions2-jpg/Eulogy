import Link from "next/link";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { invitations, trees } from "@/db/schema";
import { getCurrentUser } from "@/lib/access";
import { redirect } from "next/navigation";

export default async function InvitePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const [inv] = await db.select().from(invitations).where(eq(invitations.token, token));

  if (!inv || inv.expiresAt.getTime() < Date.now()) {
    return (
      <Shell>
        <h1 className="mb-2 text-2xl">This invitation isn&rsquo;t valid</h1>
        <p className="text-[color:var(--ink-soft)]">
          It may have expired or already been used. Ask whoever set up the tree to send a new one.
        </p>
      </Shell>
    );
  }

  const [tree] = await db.select().from(trees).where(eq(trees.id, inv.treeId));
  const user = await getCurrentUser();

  // The role upgrade + person-claim happens on sign-in (provisionUser), so
  // once you're in as the invited address there's nothing left to do here.
  if (user && user.email.toLowerCase() === inv.email.toLowerCase()) redirect("/");

  return (
    <Shell>
      <p className="label mb-2">You&rsquo;re invited</p>
      <h1 className="mb-3 text-2xl">Join the {tree?.name ?? "family"} tree</h1>
      <p className="mb-6 text-[color:var(--ink-soft)]">
        This invitation is for <strong>{inv.email}</strong> as{" "}
        <strong>{inv.role}</strong>. Sign in with that address (Google or Facebook) and
        you&rsquo;ll be set up automatically.
      </p>
      <Link href="/login" className="btn">
        Sign in
      </Link>
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-5 py-16">
      {children}
    </main>
  );
}
