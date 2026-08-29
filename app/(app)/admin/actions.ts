"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { invitations, treeMembers } from "@/db/schema";
import { requireMember, canEdit, isOwner, appUrl } from "@/lib/auth";
import { parseGramps } from "@/lib/gramps";
import { replaceGenealogy } from "@/lib/import";
import { sendInvite } from "@/lib/email";
import { newId, newToken } from "@/lib/ids";

export async function importGramps(formData: FormData) {
  const { tree, role } = await requireMember();
  if (!canEdit(role)) redirect("/admin?error=forbidden");

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) redirect("/admin?error=nofile");

  let parsed;
  try {
    parsed = parseGramps(Buffer.from(await (file as File).arrayBuffer()));
  } catch {
    redirect("/admin?error=parse");
  }
  if (!parsed!.people.length) redirect("/admin?error=empty");

  const counts = await replaceGenealogy(tree.id, parsed!);
  revalidatePath("/", "layout");
  redirect(`/admin?imported=${counts.people}`);
}

export async function sendInvitation(formData: FormData) {
  const { tree, role, user } = await requireMember();
  if (!canEdit(role)) redirect("/admin?error=forbidden");

  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const inviteRole = String(formData.get("role") ?? "contributor");
  const personId = String(formData.get("personId") ?? "") || null;
  if (!email.includes("@")) redirect("/admin?error=bademail");

  const token = newToken();
  await db.insert(invitations).values({
    id: newId(),
    email,
    treeId: tree.id,
    role: ["editor", "contributor", "viewer"].includes(inviteRole) ? inviteRole : "contributor",
    personId,
    token,
    invitedBy: user.id,
    expiresAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
  });
  await sendInvite(email, `${appUrl()}/invite/${token}`, tree.name, user.name || user.email);

  revalidatePath("/admin");
  redirect("/admin?invited=1");
}

export async function revokeInvitation(formData: FormData) {
  const { tree, role } = await requireMember();
  if (!canEdit(role)) redirect("/admin?error=forbidden");
  const id = String(formData.get("id") ?? "");
  await db.delete(invitations).where(and(eq(invitations.id, id), eq(invitations.treeId, tree.id)));
  revalidatePath("/admin");
  redirect("/admin");
}

export async function setMemberRole(formData: FormData) {
  const { tree, role } = await requireMember();
  if (!isOwner(role)) redirect("/admin?error=forbidden");

  const userId = String(formData.get("userId") ?? "");
  const newRole = String(formData.get("role") ?? "");
  if (!["owner", "editor", "contributor", "viewer"].includes(newRole)) redirect("/admin");

  // never leave the tree with no owner
  if (newRole !== "owner") {
    const owners = await db
      .select()
      .from(treeMembers)
      .where(and(eq(treeMembers.treeId, tree.id), eq(treeMembers.role, "owner")));
    if (owners.length <= 1 && owners[0]?.userId === userId) redirect("/admin?error=lastowner");
  }

  await db
    .update(treeMembers)
    .set({ role: newRole })
    .where(and(eq(treeMembers.treeId, tree.id), eq(treeMembers.userId, userId)));
  revalidatePath("/admin");
  redirect("/admin");
}
