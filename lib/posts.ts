import { and, desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { posts, people } from "@/db/schema";
import type { Post, Person } from "@/db/schema";

export type FeedItem = Post & { about: Pick<Person, "id" | "given" | "surname" | "prefix"> | null };

export async function listPosts(treeId: string, limit = 50): Promise<FeedItem[]> {
  const rows = await db
    .select()
    .from(posts)
    .where(eq(posts.treeId, treeId))
    .orderBy(desc(posts.pinned), desc(posts.createdAt))
    .limit(limit);

  const ids = [...new Set(rows.map((r) => r.aboutPersonId).filter((x): x is string => !!x))];
  const peopleById = new Map<string, Person>();
  if (ids.length) {
    const ps = await db.select().from(people).where(eq(people.treeId, treeId));
    for (const p of ps) peopleById.set(p.id, p);
  }

  return rows.map((r) => ({
    ...r,
    about: r.aboutPersonId ? peopleById.get(r.aboutPersonId) ?? null : null,
  }));
}

export async function getPost(treeId: string, id: string): Promise<Post | null> {
  const [p] = await db
    .select()
    .from(posts)
    .where(and(eq(posts.treeId, treeId), eq(posts.id, id)));
  return p ?? null;
}

export function timeAgo(date: Date): string {
  const s = Math.floor((Date.now() - date.getTime()) / 1000);
  if (s < 60) return "just now";
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d ago`;
  const w = Math.floor(d / 7);
  if (w < 5) return `${w}w ago`;
  return date.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}
