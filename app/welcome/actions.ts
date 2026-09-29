"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { people, users } from "@/db/schema";
import { requireMember } from "@/lib/access";
import { getClaimedPerson, linkUserToPerson } from "@/lib/profile";
import { linkChild, linkParent, linkPartner } from "@/lib/family-graph";
import { newId } from "@/lib/ids";

const s = (v: FormDataEntryValue | null, max = 120) => String(v ?? "").trim().slice(0, max);

function gender(v: FormDataEntryValue | null) {
  const g = s(v, 1).toUpperCase();
  return g === "M" || g === "F" ? g : "U";
}

/** Confirm or correct the signed-in user's own person, then move on to family. */
export async function saveSelf(formData: FormData) {
  const { tree, user } = await requireMember();

  const given = s(formData.get("given"));
  const surname = s(formData.get("surname"));
  if (!given && !surname) redirect("/welcome?error=name");

  await db
    .update(people)
    .set({
      given,
      surname,
      birthDate: s(formData.get("birthYear"), 40),
      gender: gender(formData.get("gender")),
      updatedAt: new Date(),
    })
    .where(and(eq(people.treeId, tree.id), eq(people.id, user.personId)));

  revalidatePath("/", "layout");
  redirect("/welcome?step=family");
}

/** "I'm already in the tree": become an existing person instead of a new one. */
export async function claimSelf(formData: FormData) {
  const { user } = await requireMember();
  const result = await linkUserToPerson(user, String(formData.get("personId") ?? ""));
  if (result === "notfound") redirect("/welcome?step=find&error=notfound");
  if (result === "taken") redirect("/welcome?step=find&error=taken");
  if (result === "already-filled") redirect("/welcome?step=find&error=filled");

  revalidatePath("/", "layout");
  redirect("/welcome?step=family");
}

/** Add one first-degree relative (parent | partner | child) of the user's person. */
export async function addRelative(formData: FormData) {
  const { tree, user } = await requireMember();
  const me = await getClaimedPerson(tree.id, user.id);
  if (!me) redirect("/welcome");

  const relation = s(formData.get("relation"), 10);
  if (!["parent", "partner", "child"].includes(relation)) {
    redirect("/welcome?step=family");
  }

  const given = s(formData.get("given"));
  const surname = s(formData.get("surname"));
  if (!given && !surname) redirect("/welcome?step=family&error=name");

  const id = newId();
  await db.insert(people).values({
    id,
    treeId: tree.id,
    given,
    surname,
    birthDate: s(formData.get("birthYear"), 40),
    gender: gender(formData.get("gender")),
  });

  if (relation === "parent") await linkParent(tree.id, me.id, id);
  else if (relation === "partner") await linkPartner(tree.id, me.id, id);
  else await linkChild(tree.id, me.id, id);

  revalidatePath("/", "layout");
  redirect("/welcome?step=family&added=1");
}

/** Onboarding is done; let the user into the app. */
export async function finishOnboarding() {
  const { user } = await requireMember();
  await db.update(users).set({ onboardedAt: new Date() }).where(eq(users.id, user.id));
  revalidatePath("/", "layout");
  redirect("/feed");
}
