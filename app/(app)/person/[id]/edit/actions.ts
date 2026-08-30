"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { people } from "@/db/schema";
import { requireMember } from "@/lib/access";
import { canEditPerson } from "@/lib/profile";

const s = (v: FormDataEntryValue | null, max = 400) => String(v ?? "").trim().slice(0, max);

export async function updatePerson(formData: FormData) {
  const { tree, user, role } = await requireMember();
  const id = String(formData.get("id") ?? "");

  const [person] = await db
    .select()
    .from(people)
    .where(and(eq(people.treeId, tree.id), eq(people.id, id)));
  if (!person) redirect("/people");
  if (!canEditPerson(role, person, user.id)) redirect(`/person/${id}?error=forbidden`);

  const genderRaw = s(formData.get("gender"), 1).toUpperCase();
  const deathDate = s(formData.get("deathDate"), 40);

  await db
    .update(people)
    .set({
      given: s(formData.get("given"), 120),
      surname: s(formData.get("surname"), 120),
      prefix: s(formData.get("prefix"), 120),
      suffix: s(formData.get("suffix"), 60),
      title: s(formData.get("title"), 60),
      nick: s(formData.get("nick"), 60),
      gender: genderRaw === "M" || genderRaw === "F" ? genderRaw : "U",
      birthDate: s(formData.get("birthDate"), 40),
      deathDate,
      living: !deathDate,
      bio: s(formData.get("bio"), 4000),
      photoUrl: s(formData.get("photoUrl"), 600),
      updatedAt: new Date(),
    })
    .where(and(eq(people.treeId, tree.id), eq(people.id, id)));

  revalidatePath("/", "layout");
  redirect(`/person/${id}?msg=saved`);
}
