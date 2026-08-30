import Link from "next/link";
import type { FeedItem } from "@/lib/posts";
import { timeAgo } from "@/lib/posts";
import { fullName } from "@/lib/names";
import { deletePost, togglePin } from "@/app/(app)/feed/actions";

export function PostCard({
  post,
  canModerate,
  isAuthor,
  permalink = false,
}: {
  post: FeedItem;
  canModerate: boolean;
  isAuthor: boolean;
  permalink?: boolean;
}) {
  const paras = post.body.split(/\n\n+/);

  return (
    <article className="card p-5">
      <header className="mb-2 flex items-baseline justify-between gap-3">
        <div className="text-sm">
          <span className="font-medium">{post.authorName || "Someone"}</span>
          <span className="label ml-2">{timeAgo(new Date(post.createdAt))}</span>
          {post.pinned && <span className="label ml-2 text-[color:var(--earth-ink)]">· pinned</span>}
        </div>
        {(canModerate || isAuthor) && (
          <div className="flex gap-2">
            {canModerate && (
              <form action={togglePin}>
                <input type="hidden" name="id" value={post.id} />
                <button className="label hover:underline" type="submit">
                  {post.pinned ? "unpin" : "pin"}
                </button>
              </form>
            )}
            <form action={deletePost}>
              <input type="hidden" name="id" value={post.id} />
              <button className="label hover:underline" type="submit">
                delete
              </button>
            </form>
          </div>
        )}
      </header>

      {post.title && (
        <h2 className="mb-1 font-serif text-xl">
          {permalink ? (
            post.title
          ) : (
            <Link href={`/post/${post.id}`} className="no-underline hover:underline">
              {post.title}
            </Link>
          )}
        </h2>
      )}

      {post.about && (
        <p className="label mb-2">
          about <Link href={`/person/${post.about.id}`}>{fullName(post.about)}</Link>
        </p>
      )}

      {post.photoUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={post.photoUrl}
          alt=""
          className="mb-3 max-h-[28rem] w-full rounded object-cover"
        />
      )}

      <div className="flex flex-col gap-2 whitespace-pre-wrap leading-relaxed">
        {(permalink ? paras : paras.slice(0, 4)).map((p, i) => (
          <p key={i}>{p}</p>
        ))}
        {!permalink && paras.length > 4 && (
          <Link href={`/post/${post.id}`} className="text-sm">
            Read more →
          </Link>
        )}
      </div>
    </article>
  );
}
