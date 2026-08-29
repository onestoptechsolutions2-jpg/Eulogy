export default function NoAccessPage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-5 py-16">
      <p className="label mb-2">No access</p>
      <h1 className="mb-3 text-2xl">You&rsquo;re signed in, but not on this tree</h1>
      <p className="mb-4 text-[color:var(--ink-soft)]">
        This family tree is invite only. Ask whoever manages it to invite the address
        you signed in with.
      </p>
      <a href="/logout" className="btn ghost self-start">
        Sign out
      </a>
    </main>
  );
}
