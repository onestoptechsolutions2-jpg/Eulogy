"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { posts } from "@/db/schema";
import { requireMember, canEdit } from "@/lib/access";
import { newId } from "@/lib/ids";

const clip = (v: FormDataEntryValue | null, max: number) => String(v ?? "").trim().slice(0, max);

export async function createPost(formData: FormData) {
  const { tree, user } = await requireMember();
  const body = clip(formData.get("body"), 8000);
  if (!body) redirect("/feed?error=empty");

  await db.insert(posts).values({
    id: newId(),
    treeId: tree.id,
    authorUserId: user.id,
    authorName: user.name || user.email,
    title: clip(formData.get("title"), 160),
    body,
    photoUrl: clip(formData.get("photoUrl"), 600),
    aboutPersonId: clip(formData.get("aboutPersonId"), 40) || null,
  });

  revalidatePath("/feed");
  redirect("/feed");
}

export async function deletePost(formData: FormData) {
  const { tree, user, role } = await requireMember();
  const id = String(formData.get("id") ?? "");
  const [post] = await db
    .select()
    .from(posts)
    .where(and(eq(posts.treeId, tree.id), eq(posts.id, id)));
  if (!post) redirect("/feed");
  if (post.authorUserId !== user.id && !canEdit(role)) redirect("/feed?error=forbidden");

  await db.delete(posts).where(and(eq(posts.treeId, tree.id), eq(posts.id, id)));
  revalidatePath("/feed");
  redirect("/feed");
}

export async function togglePin(formData: FormData) {
  const { tree, role } = await requireMember();
  if (!canEdit(role)) redirect("/feed?error=forbidden");
  const id = String(formData.get("id") ?? "");
  const [post] = await db
    .select()
    .from(posts)
    .where(and(eq(posts.treeId, tree.id), eq(posts.id, id)));
  if (!post) redirect("/feed");

  await db
    .update(posts)
    .set({ pinned: !post.pinned })
    .where(and(eq(posts.treeId, tree.id), eq(posts.id, id)));
  revalidatePath("/feed");
  redirect("/feed");
}
