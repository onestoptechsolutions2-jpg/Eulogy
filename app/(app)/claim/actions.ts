"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireMember } from "@/lib/access";
import { linkUserToPerson } from "@/lib/profile";

/** "This is me": link the signed-in account to an existing person. */
export async function claimPerson(formData: FormData) {
  const { user } = await requireMember();
  const personId = String(formData.get("personId") ?? "");

  const result = await linkUserToPerson(user, personId);
  if (result === "notfound") redirect("/claim?error=notfound");
  if (result === "taken") redirect("/claim?error=taken");
  if (result === "already-filled") redirect("/claim?error=filled");

  revalidatePath("/", "layout");
  redirect(`/person/${personId}?msg=claimed`);
}
