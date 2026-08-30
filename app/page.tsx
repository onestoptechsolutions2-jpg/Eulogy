import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";

// A private site — don't let this surface in search results.
export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default async function LandingPage() {
  // Family members who are already signed in go straight to the feed.
  if (await auth()) redirect("/feed");

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-5 py-16">
      <p className="label mb-3">Mizizi</p>
      <h1 className="mb-4 text-4xl">A home for our family</h1>
      <p className="mb-8 text-lg text-[color:var(--ink-soft)]">
        Our family tree and the stories that go with it — who we are, how we&rsquo;re
        connected, and what we want kept. It&rsquo;s private, and it&rsquo;s ours.
      </p>

      <div className="flex flex-col gap-3">
        <Link href="/login" className="btn w-full text-center">
          Sign in
        </Link>
        <p className="text-sm text-[color:var(--ink-soft)]">
          Got an invitation by email? Open the link in it to join.
        </p>
      </div>

      <p className="mt-10 border-t border-[color:var(--rule)] pt-6 text-sm text-[color:var(--ink-soft)]">
        This is a private site for one family. If you think you should have access,
        ask whoever set it up.
      </p>
    </main>
  );
}
