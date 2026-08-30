"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { people } from "@/db/schema";
import { requireMember } from "@/lib/access";
import { getClaimedPerson } from "@/lib/profile";
import { linkChild, linkParent, linkPartner } from "@/lib/family-graph";
import { newId } from "@/lib/ids";
import { ONBOARDED_COOKIE } from "@/lib/onboarding";

const s = (v: FormDataEntryValue | null, max = 120) => String(v ?? "").trim().slice(0, max);

function gender(v: FormDataEntryValue | null) {
  const g = s(v, 1).toUpperCase();
  return g === "M" || g === "F" ? g : "U";
}

/** Create the signed-in user's own person and claim it. */
export async function createSelfPerson(formData: FormData) {
  const { tree, user } = await requireMember();
  if (await getClaimedPerson(tree.id, user.id)) redirect("/welcome?step=family");

  const given = s(formData.get("given"));
  const surname = s(formData.get("surname"));
  if (!given && !surname) redirect("/welcome?step=add&error=name");

  await db.insert(people).values({
    id: newId(),
    treeId: tree.id,
    given,
    surname,
    birthDate: s(formData.get("birthYear"), 40),
    gender: gender(formData.get("gender")),
    claimedByUserId: user.id,
  });

  revalidatePath("/", "layout");
  redirect("/welcome?step=family");
}

/** Claim an existing tree person as yourself, then continue to "add family". */
export async function claimSelf(formData: FormData) {
  const { tree, user } = await requireMember();
  if (await getClaimedPerson(tree.id, user.id)) redirect("/welcome?step=family");

  const personId = String(formData.get("personId") ?? "");
  const [target] = await db
    .select()
    .from(people)
    .where(and(eq(people.treeId, tree.id), eq(people.id, personId)));
  if (!target) redirect("/welcome?step=find&error=notfound");
  if (target.claimedByUserId) redirect("/welcome?step=find&error=taken");

  await db
    .update(people)
    .set({ claimedByUserId: user.id, updatedAt: new Date() })
    .where(and(eq(people.treeId, tree.id), eq(people.id, personId)));

  revalidatePath("/", "layout");
  redirect("/welcome?step=family");
}

/** Add one first-degree relative (parent | partner | child) of the user's person. */
export async function addRelative(formData: FormData) {
  const { tree, user } = await requireMember();
  const me = await getClaimedPerson(tree.id, user.id);
  if (!me) redirect("/welcome?step=add");

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

/** "Skip for now" — let the user into the app without a linked profile. */
export async function skipOnboarding() {
  (await cookies()).set(ONBOARDED_COOKIE, "1", {
    maxAge: 60 * 60 * 24 * 365,
    httpOnly: true,
    sameSite: "lax",
    path: "/",
  });
  redirect("/feed");
}
