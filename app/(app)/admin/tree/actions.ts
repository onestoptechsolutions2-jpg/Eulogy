"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireMember, canEdit } from "@/lib/access";
import {
  createPerson,
  createFamily,
  updateFamily,
  addChild,
  removeChild,
  deleteFamily,
  deletePerson,
} from "@/lib/genealogy-edit";

async function guard() {
  const m = await requireMember();
  if (!canEdit(m.role)) redirect("/admin/tree?error=forbidden");
  return m;
}

function done(msg: string) {
  revalidatePath("/", "layout");
  redirect(`/admin/tree?ok=${msg}`);
}

export async function addPerson(formData: FormData) {
  const { tree } = await guard();
  const given = String(formData.get("given") ?? "").trim();
  const surname = String(formData.get("surname") ?? "").trim();
  if (!given && !surname) redirect("/admin/tree?error=name");
  await createPerson(tree.id, {
    given,
    surname,
    gender: String(formData.get("gender") ?? "U"),
    birthDate: String(formData.get("birthDate") ?? ""),
    deathDate: String(formData.get("deathDate") ?? ""),
  });
  done("person-added");
}

export async function addFamily(formData: FormData) {
  const { tree } = await guard();
  await createFamily(tree.id, {
    partner1Id: String(formData.get("partner1Id") ?? "") || null,
    partner2Id: String(formData.get("partner2Id") ?? "") || null,
    relType: String(formData.get("relType") ?? "Unknown"),
  });
  done("family-added");
}

export async function editFamily(formData: FormData) {
  const { tree } = await guard();
  const familyId = String(formData.get("familyId") ?? "");
  await updateFamily(tree.id, familyId, {
    partner1Id: String(formData.get("partner1Id") ?? "") || null,
    partner2Id: String(formData.get("partner2Id") ?? "") || null,
    relType: String(formData.get("relType") ?? "Unknown"),
  });
  done("family-updated");
}

export async function addChildAction(formData: FormData) {
  const { tree } = await guard();
  await addChild(tree.id, String(formData.get("familyId") ?? ""), String(formData.get("childId") ?? ""));
  done("child-added");
}

export async function removeChildAction(formData: FormData) {
  await guard();
  await removeChild(String(formData.get("familyId") ?? ""), String(formData.get("childId") ?? ""));
  done("child-removed");
}

export async function deleteFamilyAction(formData: FormData) {
  const { tree } = await guard();
  await deleteFamily(tree.id, String(formData.get("familyId") ?? ""));
  done("family-deleted");
}

export async function deletePersonAction(formData: FormData) {
  const { tree } = await guard();
  await deletePerson(tree.id, String(formData.get("personId") ?? ""));
  done("person-deleted");
}
