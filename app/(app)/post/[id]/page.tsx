import Link from "next/link";
import { notFound } from "next/navigation";
import { requireMember, canEdit } from "@/lib/access";
import { getPost } from "@/lib/posts";
import { db } from "@/db";
import { people } from "@/db/schema";
import { and, eq } from "drizzle-orm";
import { PostCard } from "@/components/PostCard";
import type { FeedItem } from "@/lib/posts";

export default async function PostPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { tree, user, role } = await requireMember();

  const post = await getPost(tree.id, id);
  if (!post) notFound();

  let about: FeedItem["about"] = null;
  if (post.aboutPersonId) {
    const [p] = await db
      .select({ id: people.id, given: people.given, surname: people.surname, prefix: people.prefix })
      .from(people)
      .where(and(eq(people.treeId, tree.id), eq(people.id, post.aboutPersonId)));
    about = p ?? null;
  }

  return (
    <div className="flex flex-col gap-4">
      <Link href="/" className="text-sm">← Back to the feed</Link>
      <PostCard
        post={{ ...post, about }}
        canModerate={canEdit(role)}
        isAuthor={post.authorUserId === user.id}
        permalink
      />
    </div>
  );
}
