"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { people } from "@/db/schema";
import { requireMember } from "@/lib/access";
import { canEditPerson } from "@/lib/profile";
import { deleteImage, mediaIdFromUrl, saveImage, UploadError } from "@/lib/media";

async function editablePerson(personId: string) {
  const { tree, user, role } = await requireMember();
  const [person] = await db
    .select()
    .from(people)
    .where(and(eq(people.treeId, tree.id), eq(people.id, personId)));
  if (!person) redirect("/people");
  if (!canEditPerson(role, person, user.id)) redirect(`/person/${personId}?error=forbidden`);
  return { tree, user, person };
}

const back = (id: string, q: string) => redirect(`/person/${id}/edit?${q}`);

/** Upload and set the profile photo or background image. */
export async function setPersonImage(formData: FormData) {
  const personId = String(formData.get("personId") ?? "");
  const field = String(formData.get("field") ?? "");
  if (field !== "photoUrl" && field !== "coverUrl") back(personId, "error=badfield");

  const { tree, user, person } = await editablePerson(personId);
  const file = formData.get("file");
  const isAvatar = field === "photoUrl";

  try {
    const { url } = await saveImage({
      treeId: tree.id,
      uploadedBy: user.id,
      file: file as File,
      kind: isAvatar ? "avatar" : "cover",
      personId,
    });
    // drop the previous image if it was one of ours
    const oldId = mediaIdFromUrl((isAvatar ? person.photoUrl : person.coverUrl) ?? "");
    if (oldId) await deleteImage(tree.id, oldId);

    await db
      .update(people)
      .set(isAvatar ? { photoUrl: url, updatedAt: new Date() } : { coverUrl: url, updatedAt: new Date() })
      .where(and(eq(people.treeId, tree.id), eq(people.id, personId)));
  } catch (e) {
    if (e instanceof UploadError) back(personId, `error=${encodeURIComponent(e.message)}`);
    throw e;
  }

  revalidatePath("/", "layout");
  back(personId, "msg=photo");
}

/** Clear the profile photo or background image. */
export async function clearPersonImage(formData: FormData) {
  const personId = String(formData.get("personId") ?? "");
  const field = String(formData.get("field") ?? "");
  if (field !== "photoUrl" && field !== "coverUrl") back(personId, "error=badfield");

  const { tree, person } = await editablePerson(personId);
  const isAvatar = field === "photoUrl";
  const oldId = mediaIdFromUrl((isAvatar ? person.photoUrl : person.coverUrl) ?? "");
  if (oldId) await deleteImage(tree.id, oldId);

  await db
    .update(people)
    .set(isAvatar ? { photoUrl: "", updatedAt: new Date() } : { coverUrl: "", updatedAt: new Date() })
    .where(and(eq(people.treeId, tree.id), eq(people.id, personId)));

  revalidatePath("/", "layout");
  back(personId, "msg=photo");
}

/** Add a photo to the person's gallery. */
export async function addGalleryPhoto(formData: FormData) {
  const personId = String(formData.get("personId") ?? "");
  const { tree, user } = await editablePerson(personId);
  const file = formData.get("file");

  try {
    await saveImage({
      treeId: tree.id,
      uploadedBy: user.id,
      file: file as File,
      kind: "gallery",
      personId,
      caption: String(formData.get("caption") ?? ""),
    });
  } catch (e) {
    if (e instanceof UploadError) back(personId, `error=${encodeURIComponent(e.message)}`);
    throw e;
  }

  revalidatePath("/", "layout");
  back(personId, "msg=gallery");
}

export async function removeGalleryPhoto(formData: FormData) {
  const personId = String(formData.get("personId") ?? "");
  const mediaId = String(formData.get("mediaId") ?? "");
  const { tree } = await editablePerson(personId);
  await deleteImage(tree.id, mediaId);
  revalidatePath("/", "layout");
  back(personId, "msg=gallery");
}
