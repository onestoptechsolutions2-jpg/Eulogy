import Link from "next/link";
import { notFound } from "next/navigation";
import { requireMember, canEdit, appUrl } from "@/lib/access";
import { getPerson } from "@/lib/queries";
import { getEulogyByPerson, listEntries } from "@/lib/eulogy";
import { fullName, lifespan } from "@/lib/names";
import {
  createEulogy,
  updateEulogy,
  addMemberEntry,
  removeEntry,
  moderateEntry,
} from "./actions";

export default async function EulogyPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ msg?: string; error?: string }>;
}) {
  const { id } = await params;
  const { msg, error } = await searchParams;
  const { tree, user, role } = await requireMember();

  const person = await getPerson(tree.id, id);
  if (!person) notFound();

  const eulogy = await getEulogyByPerson(tree.id, id);
  const editor = canEdit(role);

  return (
    <div className="flex max-w-measure flex-col gap-8">
      <div>
        <Link href={`/person/${id}`} className="text-sm">← {fullName(person)}</Link>
        <h1 className="mt-1 text-3xl">Eulogy</h1>
        <p className="label mt-1">{lifespan(person) || (person.living ? "living" : "")}</p>
      </div>

      {(msg || error) && (
        <p
          className="card p-3 text-sm"
          style={{ borderLeft: `3px solid ${error ? "var(--earth)" : "var(--indigo)"}` }}
        >
          {error === "forbidden"
            ? "Only the family's editors can change that."
            : error === "empty"
              ? "Write something first."
              : "Done."}
        </p>
      )}

      {!eulogy ? (
        <form action={createEulogy} className="card flex flex-col gap-3 p-5">
          <input type="hidden" name="personId" value={id} />
          <p className="text-[color:var(--ink-soft)]">
            Start a shared page where the family can write tributes to{" "}
            {person.given || fullName(person)}. You can turn on a public link to share it
            with people who don&rsquo;t have an account.
          </p>
          <button type="submit" className="btn self-start">Start the eulogy</button>
        </form>
      ) : (
        <EulogyBody
          personId={id}
          personName={fullName(person)}
          eulogy={eulogy}
          editor={editor}
          userId={user.id}
        />
      )}
    </div>
  );
}

async function EulogyBody({
  personId,
  personName,
  eulogy,
  editor,
  userId,
}: {
  personId: string;
  personName: string;
  eulogy: NonNullable<Awaited<ReturnType<typeof getEulogyByPerson>>>;
  editor: boolean;
  userId: string;
}) {
  const [published, pending] = await Promise.all([
    listEntries(eulogy.id, ["published"]),
    listEntries(eulogy.id, ["pending"]),
  ]);
  const shareLink = `${appUrl()}/eulogy/${eulogy.shareToken}`;

  return (
    <>
      {/* Settings (owner/editor) */}
      {editor && (
        <form action={updateEulogy} className="card flex flex-col gap-3 p-5">
          <h2 className="label">Settings</h2>
          <input type="hidden" name="personId" value={personId} />
          <input type="hidden" name="eulogyId" value={eulogy.id} />
          <label className="flex flex-col gap-1">
            <span className="label">Heading</span>
            <input
              name="title"
              defaultValue={eulogy.title}
              className="field"
              placeholder={`In memory of ${personName}`}
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="label">Opening words</span>
            <textarea name="intro" defaultValue={eulogy.intro} className="field min-h-[8rem]" />
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="linkEnabled" defaultChecked={eulogy.linkEnabled} />
            Public share link is on
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="allowTributes" defaultChecked={eulogy.allowTributes} />
            Let people with the link submit a tribute (you approve each one)
          </label>
          <button type="submit" className="btn ghost self-start">Save settings</button>
        </form>
      )}

      {/* Share link */}
      <section className="flex flex-col gap-2">
        <h2 className="label">Share link</h2>
        {eulogy.linkEnabled ? (
          <>
            <input readOnly value={shareLink} className="field font-mono text-xs" />
            <p className="text-sm text-[color:var(--ink-soft)]">
              Anyone with this link can read the eulogy
              {eulogy.allowTributes ? " and submit a tribute for approval." : "."}
            </p>
          </>
        ) : (
          <p className="text-sm text-[color:var(--ink-soft)]">
            The public link is off{editor ? " — turn it on in settings." : "."}
          </p>
        )}
      </section>

      {/* Pending tributes (owner/editor) */}
      {editor && pending.length > 0 && (
        <section className="flex flex-col gap-3">
          <h2 className="label">Awaiting approval ({pending.length})</h2>
          {pending.map((e) => (
            <div key={e.id} className="card p-4">
              <p className="text-sm">
                <strong>{e.authorName || "Someone"}</strong>
                {e.relationship && (
                  <span className="text-[color:var(--ink-soft)]"> · {e.relationship}</span>
                )}
              </p>
              <p className="mt-2 whitespace-pre-wrap text-sm">{e.body}</p>
              <div className="mt-3 flex gap-2">
                <form action={moderateEntry}>
                  <input type="hidden" name="personId" value={personId} />
                  <input type="hidden" name="eulogyId" value={eulogy.id} />
                  <input type="hidden" name="id" value={e.id} />
                  <input type="hidden" name="decision" value="approve" />
                  <button className="btn ghost text-xs" type="submit">Approve</button>
                </form>
                <form action={moderateEntry}>
                  <input type="hidden" name="personId" value={personId} />
                  <input type="hidden" name="eulogyId" value={eulogy.id} />
                  <input type="hidden" name="id" value={e.id} />
                  <input type="hidden" name="decision" value="dismiss" />
                  <button className="text-xs text-[color:var(--earth-ink)] underline" type="submit">
                    Dismiss
                  </button>
                </form>
              </div>
            </div>
          ))}
        </section>
      )}

      {/* Published tributes */}
      <section className="flex flex-col gap-4">
        <h2 className="label">Tributes ({published.length})</h2>
        {published.length === 0 && (
          <p className="text-sm text-[color:var(--ink-soft)]">Nothing written yet.</p>
        )}
        {published.map((e) => (
          <div key={e.id} className="border-l-2 border-[color:var(--rule)] pl-4">
            <p className="whitespace-pre-wrap">{e.body}</p>
            <p className="label mt-2">
              — {e.authorName || "Anonymous"}
              {e.relationship && `, ${e.relationship}`}
              {e.source === "link" && " · via link"}
            </p>
            {(editor || e.authorUserId === userId) && (
              <form action={removeEntry} className="mt-1">
                <input type="hidden" name="personId" value={personId} />
                <input type="hidden" name="eulogyId" value={eulogy.id} />
                <input type="hidden" name="id" value={e.id} />
                <button className="text-xs text-[color:var(--earth-ink)] underline" type="submit">
                  remove
                </button>
              </form>
            )}
          </div>
        ))}
      </section>

      {/* Add your own */}
      <form action={addMemberEntry} className="card flex flex-col gap-3 p-5">
        <h2 className="label">Add your tribute</h2>
        <input type="hidden" name="personId" value={personId} />
        <input type="hidden" name="eulogyId" value={eulogy.id} />
        <input
          name="relationship"
          className="field"
          placeholder="How you knew them (e.g. granddaughter)"
          maxLength={80}
        />
        <textarea name="body" required className="field min-h-[8rem]" placeholder="Write your tribute…" />
        <button type="submit" className="btn self-start">Post</button>
      </form>
    </>
  );
}
