"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { people } from "@/db/schema";
import { requireMember } from "@/lib/access";
import { getClaimedPerson } from "@/lib/profile";

export async function claimPerson(formData: FormData) {
  const { tree, user } = await requireMember();
  const personId = String(formData.get("personId") ?? "");

  // one claim per user
  const already = await getClaimedPerson(tree.id, user.id);
  if (already) redirect(`/person/${already.id}?msg=already-claimed`);

  const [target] = await db
    .select()
    .from(people)
    .where(and(eq(people.treeId, tree.id), eq(people.id, personId)));
  if (!target) redirect("/claim?error=notfound");
  if (target.claimedByUserId) redirect("/claim?error=taken");

  await db
    .update(people)
    .set({ claimedByUserId: user.id, updatedAt: new Date() })
    .where(and(eq(people.treeId, tree.id), eq(people.id, personId)));

  revalidatePath("/", "layout");
  redirect(`/person/${personId}?msg=claimed`);
}

export async function unclaimPerson(formData: FormData) {
  const { tree, user } = await requireMember();
  const personId = String(formData.get("personId") ?? "");
  await db
    .update(people)
    .set({ claimedByUserId: null, updatedAt: new Date() })
    .where(
      and(
        eq(people.treeId, tree.id),
        eq(people.id, personId),
        eq(people.claimedByUserId, user.id),
      ),
    );
  revalidatePath("/", "layout");
  redirect(`/person/${personId}`);
}
