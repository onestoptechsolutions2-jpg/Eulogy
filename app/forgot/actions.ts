"use server";

import { redirect } from "next/navigation";
import { getUserByEmail } from "@/lib/provision";
import { createResetToken } from "@/lib/credentials";
import { sendPasswordReset } from "@/lib/email";
import { appUrl } from "@/lib/access";

export async function requestReset(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  if (email.includes("@")) {
    const user = await getUserByEmail(email);
    if (user && user.passwordHash) {
      const token = await createResetToken(user.id);
      await sendPasswordReset(email, `${appUrl()}/reset/${token}`);
    }
  }
  // same response whether or not the account exists
  redirect("/forgot?sent=1");
}
