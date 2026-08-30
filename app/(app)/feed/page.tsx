import Link from "next/link";
import { asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { people } from "@/db/schema";
import { requireMember, canEdit } from "@/lib/access";
import { getClaimedPerson } from "@/lib/profile";
import { listPosts } from "@/lib/posts";
import { fullName } from "@/lib/names";
import { PostCard } from "@/components/PostCard";
import { createPost } from "./actions";

export default async function FeedPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { tree, user, role } = await requireMember();
  const { error } = await searchParams;

  const [feed, mine, peopleRows] = await Promise.all([
    listPosts(tree.id),
    getClaimedPerson(tree.id, user.id),
    db
      .select({ id: people.id, given: people.given, surname: people.surname, prefix: people.prefix })
      .from(people)
      .where(eq(people.treeId, tree.id))
      .orderBy(asc(people.surname), asc(people.given)),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <section className="card p-4 text-sm" style={{ borderLeft: "3px solid var(--indigo)" }}>
        {mine ? (
          <>
            Signed in as <Link href={`/person/${mine.id}`}>{fullName(mine)}</Link>.{" "}
            <Link href={`/person/${mine.id}/edit`}>Edit your profile</Link>.
          </>
        ) : (
          <>
            Which one are you? <Link href="/claim">Find yourself in the tree</Link> to claim
            your profile.
          </>
        )}
      </section>

      {error === "empty" && (
        <p className="text-sm text-[color:var(--earth-ink)]">Write something first.</p>
      )}
      {error === "forbidden" && (
        <p className="text-sm text-[color:var(--earth-ink)]">You can&rsquo;t do that.</p>
      )}

      <details className="card p-4">
        <summary className="cursor-pointer select-none font-serif text-lg">
          Share something with the family
        </summary>
        <form action={createPost} className="mt-4 flex flex-col gap-3">
          <input name="title" className="field" placeholder="Title (optional)" maxLength={160} />
          <textarea
            name="body"
            required
            className="field min-h-[7rem]"
            placeholder="A story, an update, some news…"
          />
          <div className="grid gap-3 sm:grid-cols-2">
            <input name="photoUrl" className="field" placeholder="Photo URL (optional)" />
            <select name="aboutPersonId" defaultValue="" className="field">
              <option value="">Not about anyone in particular</option>
              {peopleRows.map((p) => (
                <option key={p.id} value={p.id}>
                  {fullName(p)}
                </option>
              ))}
            </select>
          </div>
          <button type="submit" className="btn self-start">Post</button>
        </form>
      </details>

      {feed.length === 0 ? (
        <p className="py-8 text-center text-[color:var(--ink-soft)]">
          Nothing here yet. Be the first to share a story.
        </p>
      ) : (
        <div className="flex flex-col gap-4">
          {feed.map((post) => (
            <PostCard
              key={post.id}
              post={post}
              canModerate={canEdit(role)}
              isAuthor={post.authorUserId === user.id}
            />
          ))}
        </div>
      )}
    </div>
  );
}
