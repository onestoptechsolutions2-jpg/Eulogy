"use server";

import { redirect } from "next/navigation";
import { db } from "@/db";
import { eulogyEntries } from "@/db/schema";
import { getEulogyByToken } from "@/lib/eulogy";
import { newId } from "@/lib/ids";

const s = (v: FormDataEntryValue | null, max = 400) => String(v ?? "").trim().slice(0, max);

/** Public: a link visitor submits a tribute. Held for editor approval. */
export async function submitTribute(formData: FormData) {
  const token = s(formData.get("token"), 120);

  // honeypot — bots fill hidden fields
  if (s(formData.get("website"), 200)) redirect(`/eulogy/${token}?sent=1`);

  const eulogy = await getEulogyByToken(token);
  if (!eulogy || !eulogy.linkEnabled || !eulogy.allowTributes) {
    redirect(`/eulogy/${token}`);
  }

  const name = s(formData.get("name"), 120);
  const body = s(formData.get("body"), 6000);
  if (!name || !body) redirect(`/eulogy/${token}?error=1`);

  await db.insert(eulogyEntries).values({
    id: newId(),
    eulogyId: eulogy.id,
    authorName: name,
    relationship: s(formData.get("relationship"), 80),
    body,
    status: "pending",
    source: "link",
  });

  redirect(`/eulogy/${token}?sent=1`);
}
