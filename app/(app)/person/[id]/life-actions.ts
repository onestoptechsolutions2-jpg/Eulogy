"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { events, people } from "@/db/schema";
import { requireMember, canEdit } from "@/lib/access";
import { canEditPerson } from "@/lib/profile";
import { EVENT_KINDS } from "@/lib/events";
import { newId } from "@/lib/ids";

const s = (v: FormDataEntryValue | null, max = 400) => String(v ?? "").trim().slice(0, max);

async function personFor(personId: string, needEditor = false) {
  const { tree, user, role } = await requireMember();
  const [person] = await db
    .select()
    .from(people)
    .where(and(eq(people.treeId, tree.id), eq(people.id, personId)));
  if (!person) redirect("/people");
  const ok = needEditor ? canEdit(role) : canEditPerson(role, person, user.id);
  if (!ok) redirect(`/person/${personId}?error=forbidden`);
  return { tree, user, person };
}

export async function addEvent(formData: FormData) {
  const personId = s(formData.get("personId"), 40);
  const { tree, user } = await personFor(personId);
  const kind = s(formData.get("kind"), 20);

  await db.insert(events).values({
    id: newId(),
    treeId: tree.id,
    personId,
    kind: (EVENT_KINDS as readonly string[]).includes(kind) ? kind : "custom",
    title: s(formData.get("title"), 120),
    date: s(formData.get("date"), 40),
    place: s(formData.get("place"), 160),
    note: s(formData.get("note"), 2000),
    createdByUserId: user.id,
  });

  revalidatePath("/", "layout");
  redirect(`/person/${personId}/edit?msg=event`);
}

export async function deleteEvent(formData: FormData) {
  const personId = s(formData.get("personId"), 40);
  await personFor(personId);
  await db
    .delete(events)
    .where(and(eq(events.id, s(formData.get("id"), 40)), eq(events.personId, personId)));

  revalidatePath("/", "layout");
  redirect(`/person/${personId}/edit?msg=event`);
}

/** Owner/editor only: mark a person as deceased and record a death event. */
export async function markDeceased(formData: FormData) {
  const personId = s(formData.get("personId"), 40);
  const { tree, user } = await personFor(personId, true);
  const date = s(formData.get("deathDate"), 40);
  const place = s(formData.get("place"), 160);

  await db
    .update(people)
    .set({ living: false, deathDate: date, updatedAt: new Date() })
    .where(and(eq(people.treeId, tree.id), eq(people.id, personId)));

  const existing = await db
    .select({ id: events.id })
    .from(events)
    .where(and(eq(events.personId, personId), eq(events.kind, "death")));
  if (existing.length === 0) {
    await db.insert(events).values({
      id: newId(),
      treeId: tree.id,
      personId,
      kind: "death",
      title: "Died",
      date,
      place,
      createdByUserId: user.id,
    });
  }

  revalidatePath("/", "layout");
  redirect(`/person/${personId}/edit?msg=deceased`);
}

export async function markLiving(formData: FormData) {
  const personId = s(formData.get("personId"), 40);
  const { tree } = await personFor(personId, true);
  await db
    .update(people)
    .set({ living: true, deathDate: "", updatedAt: new Date() })
    .where(and(eq(people.treeId, tree.id), eq(people.id, personId)));

  revalidatePath("/", "layout");
  redirect(`/person/${personId}/edit?msg=deceased`);
}
