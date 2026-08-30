import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getEulogyByToken, listEntries } from "@/lib/eulogy";
import { getPerson } from "@/lib/queries";
import { fullName, lifespan } from "@/lib/names";
import { submitTribute } from "./actions";

export const metadata: Metadata = { robots: { index: false, follow: false } };

export default async function PublicEulogyPage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ sent?: string; error?: string }>;
}) {
  const { token } = await params;
  const { sent, error } = await searchParams;

  const eulogy = await getEulogyByToken(token);
  if (!eulogy || !eulogy.linkEnabled) notFound();

  const person = await getPerson(eulogy.treeId, eulogy.personId);
  if (!person) notFound();

  const entries = await listEntries(eulogy.id, ["published"]);
  const span = lifespan(person);

  return (
    <main className="mx-auto max-w-2xl px-5 py-16">
      {person.coverUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={person.coverUrl} alt="" className="mb-8 h-48 w-full rounded-lg object-cover" />
      )}

      <div className="flex items-center gap-4">
        {person.photoUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={person.photoUrl}
            alt={fullName(person)}
            className="h-20 w-20 rounded-full object-cover"
          />
        )}
        <div>
          <p className="label">In memory of</p>
          <h1 className="text-3xl">{eulogy.title || fullName(person)}</h1>
          {span && <p className="label mt-1">{span}</p>}
        </div>
      </div>

      {eulogy.intro && (
        <p className="mt-8 whitespace-pre-wrap text-lg text-[color:var(--ink-soft)]">
          {eulogy.intro}
        </p>
      )}

      <section className="mt-10 flex flex-col gap-6">
        {entries.length === 0 ? (
          <p className="text-[color:var(--ink-soft)]">Be the first to write a tribute.</p>
        ) : (
          entries.map((e) => (
            <div key={e.id} className="border-l-2 border-[color:var(--rule)] pl-4">
              <p className="whitespace-pre-wrap">{e.body}</p>
              <p className="label mt-2">
                — {e.authorName || "Anonymous"}
                {e.relationship && `, ${e.relationship}`}
              </p>
            </div>
          ))
        )}
      </section>

      {eulogy.allowTributes && (
        <section className="mt-12 border-t border-[color:var(--rule)] pt-8">
          <h2 className="text-xl">Add a tribute</h2>
          {sent ? (
            <p className="card mt-4 p-3 text-sm" style={{ borderLeft: "3px solid var(--indigo)" }}>
              Thank you. Your tribute will appear once the family approves it.
            </p>
          ) : (
            <form action={submitTribute} className="mt-4 flex flex-col gap-3">
              <input type="hidden" name="token" value={token} />
              {error && (
                <p className="card p-3 text-sm" style={{ borderLeft: "3px solid var(--earth)" }}>
                  Please add your name and a message.
                </p>
              )}
              <input name="name" required className="field" placeholder="Your name" maxLength={120} />
              <input
                name="relationship"
                className="field"
                placeholder="How you knew them (optional)"
                maxLength={80}
              />
              <textarea
                name="body"
                required
                className="field min-h-[8rem]"
                placeholder="Your tribute…"
              />
              {/* honeypot */}
              <input
                type="text"
                name="website"
                tabIndex={-1}
                autoComplete="off"
                className="hidden"
                aria-hidden="true"
              />
              <button type="submit" className="btn self-start">Submit</button>
            </form>
          )}
        </section>
      )}
    </main>
  );
}
