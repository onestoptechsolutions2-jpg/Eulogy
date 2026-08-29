export default function SetupPage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-5 py-16">
      <p className="label mb-2">Setup</p>
      <h1 className="mb-3 text-2xl">No family tree yet</h1>
      <p className="mb-4 text-[color:var(--ink-soft)]">
        The tree is created the first time the owner signs in. Sign in at{" "}
        <a href="/login">/login</a> using the address set as <code>OWNER_EMAIL</code>, then
        import the family&rsquo;s Gramps file from the admin page.
      </p>
      <p className="text-xs text-[color:var(--ink-soft)]">
        If you&rsquo;ve run <code>npm run seed</code> with a file path, the tree already
        exists &mdash; just sign in.
      </p>
    </main>
  );
}
