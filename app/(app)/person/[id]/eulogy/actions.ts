"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { eulogies, eulogyEntries, people } from "@/db/schema";
import { requireMember, canEdit } from "@/lib/access";
import { ensureEulogy } from "@/lib/eulogy";
import { newId } from "@/lib/ids";

const s = (v: FormDataEntryValue | null, max = 400) => String(v ?? "").trim().slice(0, max);

async function ctx(personId: string) {
  const { tree, user, role } = await requireMember();
  const [person] = await db
    .select()
    .from(people)
    .where(and(eq(people.treeId, tree.id), eq(people.id, personId)));
  if (!person) redirect("/people");
  return { tree, user, role, person };
}

async function loadEulogy(treeId: string, eulogyId: string) {
  const [e] = await db
    .select()
    .from(eulogies)
    .where(and(eq(eulogies.treeId, treeId), eq(eulogies.id, eulogyId)));
  return e ?? null;
}

export async function createEulogy(formData: FormData) {
  const personId = s(formData.get("personId"), 40);
  const { tree, user } = await ctx(personId);
  await ensureEulogy(tree.id, personId, user.id);
  revalidatePath("/", "layout");
  redirect(`/person/${personId}/eulogy`);
}

/** Owner/editor: title, intro, share-link + tribute toggles. */
export async function updateEulogy(formData: FormData) {
  const personId = s(formData.get("personId"), 40);
  const { tree, role } = await ctx(personId);
  if (!canEdit(role)) redirect(`/person/${personId}/eulogy?error=forbidden`);

  const e = await loadEulogy(tree.id, s(formData.get("eulogyId"), 40));
  if (!e) redirect(`/person/${personId}/eulogy`);

  await db
    .update(eulogies)
    .set({
      title: s(formData.get("title"), 160),
      intro: s(formData.get("intro"), 4000),
      linkEnabled: formData.get("linkEnabled") === "on",
      allowTributes: formData.get("allowTributes") === "on",
      updatedAt: new Date(),
    })
    .where(eq(eulogies.id, e.id));

  revalidatePath("/", "layout");
  redirect(`/person/${personId}/eulogy?msg=saved`);
}

/** Any member adds their own tribute — published immediately. */
export async function addMemberEntry(formData: FormData) {
  const personId = s(formData.get("personId"), 40);
  const { tree, user } = await ctx(personId);
  const e = await loadEulogy(tree.id, s(formData.get("eulogyId"), 40));
  if (!e) redirect(`/person/${personId}/eulogy`);

  const body = s(formData.get("body"), 6000);
  if (!body) redirect(`/person/${personId}/eulogy?error=empty`);

  await db.insert(eulogyEntries).values({
    id: newId(),
    eulogyId: e.id,
    authorUserId: user.id,
    authorName: user.name || user.email,
    relationship: s(formData.get("relationship"), 80),
    body,
    status: "published",
    source: "member",
  });

  revalidatePath("/", "layout");
  redirect(`/person/${personId}/eulogy?msg=added`);
}

export async function removeEntry(formData: FormData) {
  const personId = s(formData.get("personId"), 40);
  const { tree, user, role } = await ctx(personId);
  const e = await loadEulogy(tree.id, s(formData.get("eulogyId"), 40));
  if (!e) redirect(`/person/${personId}/eulogy`);

  const [entry] = await db
    .select()
    .from(eulogyEntries)
    .where(and(eq(eulogyEntries.eulogyId, e.id), eq(eulogyEntries.id, s(formData.get("id"), 40))));
  if (entry && (canEdit(role) || entry.authorUserId === user.id)) {
    await db.delete(eulogyEntries).where(eq(eulogyEntries.id, entry.id));
  }

  revalidatePath("/", "layout");
  redirect(`/person/${personId}/eulogy?msg=added`);
}

/** Owner/editor: approve or dismiss a tribute submitted through the share link. */
export async function moderateEntry(formData: FormData) {
  const personId = s(formData.get("personId"), 40);
  const { tree, role } = await ctx(personId);
  if (!canEdit(role)) redirect(`/person/${personId}/eulogy?error=forbidden`);

  const e = await loadEulogy(tree.id, s(formData.get("eulogyId"), 40));
  if (!e) redirect(`/person/${personId}/eulogy`);

  const decision = s(formData.get("decision"), 10);
  const status = decision === "approve" ? "published" : "dismissed";
  await db
    .update(eulogyEntries)
    .set({ status })
    .where(and(eq(eulogyEntries.eulogyId, e.id), eq(eulogyEntries.id, s(formData.get("id"), 40))));

  revalidatePath("/", "layout");
  redirect(`/person/${personId}/eulogy?msg=moderated`);
}
